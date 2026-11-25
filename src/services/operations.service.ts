import bcrypt from 'bcryptjs';
import { prisma } from '../config/database';
import { createAuditLog } from '../utils/audit';
import { broadcastToSuperAdmins, broadcastToTenant, broadcastToAll } from '../sockets';
import { AuditActorType, UserStatus } from '@prisma/client';

export class OperationsService {
  // 1. Platform Users
  async listPlatformUsers() {
    return prisma.platformUser.findMany({
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        status: true,
        phone: true,
        lastLoginAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createPlatformUser(data: any, actorId: string, actorEmail: string) {
    const existing = await prisma.platformUser.findUnique({
      where: { email: data.email.toLowerCase() },
    });
    if (existing) throw new Error('A platform user with this email already exists.');

    const passwordHash = await bcrypt.hash(data.password, 12);
    const user = await prisma.platformUser.create({
      data: {
        email: data.email.toLowerCase(),
        fullName: data.fullName,
        phone: data.phone || null,
        role: data.role,
        passwordHash,
        status: UserStatus.ACTIVE,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });

    await createAuditLog({
      actorId,
      actorType: AuditActorType.PLATFORM_USER,
      actorEmail,
      action: 'PLATFORM_USER_CREATED',
      targetType: 'PLATFORM_USER',
      targetId: user.id,
      metadata: { email: user.email, role: user.role },
    });

    return user;
  }

  async updatePlatformUserStatus(userId: string, status: UserStatus, actorId: string, actorEmail: string) {
    if (userId === actorId) {
      throw new Error('You cannot deactivate your own administrative account.');
    }

    const updated = await prisma.platformUser.update({
      where: { id: userId },
      data: { status },
      select: { id: true, email: true, status: true },
    });

    await createAuditLog({
      actorId,
      actorType: AuditActorType.PLATFORM_USER,
      actorEmail,
      action: `PLATFORM_USER_STATUS_${status}`,
      targetType: 'PLATFORM_USER',
      targetId: userId,
    });

    return updated;
  }

  // 2. Feature Management
  async listFeatures() {
    return prisma.featureDefinition.findMany({
      include: {
        planFeatures: {
          include: { plan: { select: { id: true, name: true, code: true } } },
        },
        schoolOverrides: {
          include: { school: { select: { id: true, name: true, schoolId: true } } },
        },
      },
      orderBy: { category: 'asc' },
    });
  }

  async createFeature(data: any, actorId: string, actorEmail: string) {
    const feat = await prisma.featureDefinition.create({
      data,
    });

    await createAuditLog({
      actorId,
      actorType: AuditActorType.PLATFORM_USER,
      actorEmail,
      action: 'FEATURE_CREATED',
      targetType: 'FEATURE_DEFINITION',
      targetId: feat.id,
      metadata: { code: feat.code, name: feat.name },
    });

    return feat;
  }

  async overrideSchoolFeature(data: any, actorId: string, actorEmail: string) {
    const override = await prisma.schoolFeatureOverride.upsert({
      where: {
        schoolId_featureCode: {
          schoolId: data.schoolId,
          featureCode: data.featureCode,
        },
      },
      update: {
        isEnabled: data.isEnabled,
        reason: data.reason || null,
        validUntil: data.validUntil ? new Date(data.validUntil) : null,
      },
      create: {
        schoolId: data.schoolId,
        featureCode: data.featureCode,
        isEnabled: data.isEnabled,
        reason: data.reason || null,
        validUntil: data.validUntil ? new Date(data.validUntil) : null,
      },
    });

    await createAuditLog({
      actorId,
      actorType: AuditActorType.PLATFORM_USER,
      actorEmail,
      action: 'FEATURE_OVERRIDE_SET',
      targetType: 'SCHOOL_FEATURE_OVERRIDE',
      targetId: override.id,
      tenantId: data.schoolId,
      metadata: data,
    });

    broadcastToTenant(data.schoolId, 'tenant:feature_override', {
      featureCode: data.featureCode,
      isEnabled: data.isEnabled,
    });

    return override;
  }

  // 3. Notifications & Announcements
  async listNotifications() {
    return prisma.notification.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async createNotification(data: any, actorId: string, actorEmail: string) {
    const notification = await prisma.notification.create({
      data: {
        ...data,
        senderId: actorId,
      },
    });

    await createAuditLog({
      actorId,
      actorType: AuditActorType.PLATFORM_USER,
      actorEmail,
      action: 'ANNOUNCEMENT_BROADCAST',
      targetType: 'NOTIFICATION',
      targetId: notification.id,
      metadata: { title: notification.title, targetType: notification.targetType },
    });

    // Real-time distribution
    if (notification.targetType === 'ALL') {
      broadcastToAll('platform:announcement', notification);
    } else if (notification.targetType === 'SPECIFIC_SCHOOLS' && notification.targetSchoolId) {
      broadcastToTenant(notification.targetSchoolId, 'tenant:announcement', notification);
    } else {
      broadcastToSuperAdmins('platform:announcement', notification);
    }

    return notification;
  }

  // 4. Audit Logs
  async listAuditLogs(options: {
    page?: number;
    limit?: number;
    action?: string;
    targetType?: string;
    tenantId?: string;
  }) {
    const { page = 1, limit = 20, action, targetType, tenantId } = options;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (action) where.action = { contains: action, mode: 'insensitive' };
    if (targetType) where.targetType = targetType;
    if (tenantId) where.tenantId = tenantId;

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return { logs, total };
  }
}

export const operationsService = new OperationsService();
