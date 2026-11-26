import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from '../config/database';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashToken,
} from '../utils/jwt';
import { createAuditLog } from '../utils/audit';
import { UserStatus, AuditActorType, SchoolStatus } from '@prisma/client';

export class AuthService {
  async login(email: string, password: string, ipAddress?: string, userAgent?: string) {
    const normalizedEmail = email.toLowerCase().trim();

    // 1. Check PlatformUser (case-insensitive for resilience)
    const platformUser = await prisma.platformUser.findFirst({
      where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
    });

    if (platformUser) {
      if (platformUser.status !== UserStatus.ACTIVE) {
        throw new Error('This platform account is inactive or suspended.');
      }

      const isMatch = await bcrypt.compare(password, platformUser.passwordHash);
      if (!isMatch) {
        throw new Error('Invalid email or password.');
      }

      const tokenFamily = crypto.randomUUID();
      const payload = {
        userId: platformUser.id,
        email: platformUser.email,
        role: platformUser.role,
        userType: 'PLATFORM' as const,
      };

      const accessToken = signAccessToken(payload);
      const refreshToken = signRefreshToken(payload, tokenFamily);

      // Store hashed refresh token
      await prisma.refreshToken.create({
        data: {
          tokenHash: hashToken(refreshToken),
          userId: platformUser.id,
          userType: 'PLATFORM',
          family: tokenFamily,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      await prisma.platformUser.update({
        where: { id: platformUser.id },
        data: { lastLoginAt: new Date() },
      });

      await createAuditLog({
        actorId: platformUser.id,
        actorType: AuditActorType.PLATFORM_USER,
        actorEmail: platformUser.email,
        action: 'PLATFORM_LOGIN',
        targetType: 'PLATFORM_USER',
        targetId: platformUser.id,
        ipAddress,
        userAgent,
      });

      return {
        user: {
          id: platformUser.id,
          email: platformUser.email,
          fullName: platformUser.fullName,
          role: platformUser.role,
          status: platformUser.status,
          userType: 'PLATFORM',
        },
        accessToken,
        refreshToken,
      };
    }

    // 2. Check SchoolUser (case-insensitive and prioritizing active tenant accounts)
    const schoolUser = await prisma.schoolUser.findFirst({
      where: {
        email: { equals: normalizedEmail, mode: 'insensitive' },
        status: { not: UserStatus.SUSPENDED },
        school: { status: { not: SchoolStatus.SUSPENDED } },
      },
      include: {
        school: {
          select: { id: true, name: true, schoolId: true, status: true },
        },
        teacherProfile: {
          select: { id: true, teacherCode: true, designation: true },
        },
      },
      orderBy: [
        { lastLoginAt: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    if (!schoolUser) {
      throw new Error('Invalid email or password.');
    }

    if (schoolUser.school.status === SchoolStatus.SUSPENDED) {
      throw new Error('Your school account is currently suspended. Please contact platform support.');
    }

    const isMatch = await bcrypt.compare(password, schoolUser.passwordHash);
    if (!isMatch) {
      throw new Error('Invalid email or password.');
    }

    // Auto-activate pending users (e.g. freshly created faculty or staff) on first login
    if (schoolUser.status === UserStatus.PENDING) {
      await prisma.schoolUser.update({
        where: { id: schoolUser.id },
        data: { status: UserStatus.ACTIVE },
      });
      schoolUser.status = UserStatus.ACTIVE;
    }

    const tokenFamily = crypto.randomUUID();
    const payload = {
      userId: schoolUser.id,
      email: schoolUser.email,
      role: schoolUser.role,
      schoolId: schoolUser.schoolId,
      tenantId: schoolUser.schoolId,
      userType: 'SCHOOL' as const,
    };

    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload, tokenFamily);

    await prisma.refreshToken.create({
      data: {
        tokenHash: hashToken(refreshToken),
        userId: schoolUser.id,
        userType: 'SCHOOL',
        family: tokenFamily,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    await prisma.schoolUser.update({
      where: { id: schoolUser.id },
      data: { lastLoginAt: new Date() },
    });

    await createAuditLog({
      actorId: schoolUser.id,
      actorType: AuditActorType.SCHOOL_USER,
      actorEmail: schoolUser.email,
      action: 'SCHOOL_USER_LOGIN',
      targetType: 'SCHOOL_USER',
      targetId: schoolUser.id,
      tenantId: schoolUser.schoolId,
      ipAddress,
      userAgent,
    });

    return {
      user: {
        id: schoolUser.id,
        email: schoolUser.email,
        fullName: schoolUser.fullName,
        role: schoolUser.role,
        status: schoolUser.status,
        schoolId: schoolUser.schoolId,
        schoolName: schoolUser.school.name,
        teacherProfile: schoolUser.teacherProfile,
        userType: 'SCHOOL',
      },
      accessToken,
      refreshToken,
    };
  }

  async rotateRefreshToken(rawToken: string) {
    let decoded;
    try {
      decoded = verifyRefreshToken(rawToken);
    } catch (e) {
      throw new Error('Invalid or expired refresh token');
    }

    const tokenHash = hashToken(rawToken);
    const storedToken = await prisma.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (!storedToken) {
      throw new Error('Refresh token not found');
    }

    // Reuse detection
    if (storedToken.isRevoked) {
      // Invalidate all tokens in this family
      await prisma.refreshToken.updateMany({
        where: { family: storedToken.family },
        data: { isRevoked: true },
      });
      throw new Error('Security breach detected: Revoked token reused. Session invalidated.');
    }

    if (new Date() > storedToken.expiresAt) {
      throw new Error('Refresh token expired');
    }

    // Revoke old token
    await prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { isRevoked: true },
    });

    // Create new token pair
    const payload = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      userType: decoded.userType,
      schoolId: decoded.schoolId,
      tenantId: decoded.tenantId,
    };

    const newAccessToken = signAccessToken(payload);
    const newRefreshToken = signRefreshToken(payload, storedToken.family);

    await prisma.refreshToken.create({
      data: {
        tokenHash: hashToken(newRefreshToken),
        userId: decoded.userId,
        userType: decoded.userType,
        family: storedToken.family,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  async logout(rawToken?: string) {
    if (!rawToken) return;
    try {
      const tokenHash = hashToken(rawToken);
      await prisma.refreshToken.updateMany({
        where: { tokenHash },
        data: { isRevoked: true },
      });
    } catch (e) {
      // Ignore token hash errors during logout
    }
  }

  async getCurrentUser(userId: string, userType: 'PLATFORM' | 'SCHOOL') {
    if (userType === 'PLATFORM') {
      const user = await prisma.platformUser.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
          status: true,
          phone: true,
          avatarUrl: true,
          createdAt: true,
          lastLoginAt: true,
        },
      });
      if (!user) throw new Error('User not found');
      return { ...user, userType: 'PLATFORM' };
    } else {
      const user = await prisma.schoolUser.findUnique({
        where: { id: userId },
        include: {
          school: {
            select: {
              id: true,
              schoolId: true,
              name: true,
              status: true,
              logoUrl: true,
              type: true,
              board: true,
            },
          },
        },
      });
      if (!user) throw new Error('User not found');
      return {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        status: user.status,
        phone: user.phone,
        school: user.school,
        userType: 'SCHOOL',
      };
    }
  }

  async forgotPassword(email: string) {
    const normalizedEmail = email.toLowerCase().trim();
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Look for platform user or school user
    const platformUser = await prisma.platformUser.findUnique({ where: { email: normalizedEmail } });
    const userType = platformUser ? 'PLATFORM' : 'SCHOOL';

    await prisma.passwordResetToken.create({
      data: {
        tokenHash,
        email: normalizedEmail,
        userType,
        expiresAt,
      },
    });

    // In production this triggers SMTP / SendGrid email
    return { token, email: normalizedEmail };
  }

  async resetPassword(token: string, newPassword: string) {
    const tokenHash = hashToken(token);
    const resetRecord = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });

    if (!resetRecord || resetRecord.usedAt || new Date() > resetRecord.expiresAt) {
      throw new Error('Invalid or expired password reset link.');
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    if (resetRecord.userType === 'PLATFORM') {
      await prisma.platformUser.update({
        where: { email: resetRecord.email },
        data: { passwordHash },
      });
    } else {
      await prisma.schoolUser.updateMany({
        where: { email: resetRecord.email },
        data: { passwordHash },
      });
    }

    await prisma.passwordResetToken.update({
      where: { id: resetRecord.id },
      data: { usedAt: new Date() },
    });

    return { message: 'Password reset successfully. Please log in with your new credentials.' };
  }
}

export const authService = new AuthService();
