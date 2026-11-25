"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authService = exports.AuthService = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const crypto_1 = __importDefault(require("crypto"));
const database_1 = require("../config/database");
const jwt_1 = require("../utils/jwt");
const audit_1 = require("../utils/audit");
const client_1 = require("@prisma/client");
class AuthService {
    async login(email, password, ipAddress, userAgent) {
        const normalizedEmail = email.toLowerCase().trim();
        // 1. Check PlatformUser
        const platformUser = await database_1.prisma.platformUser.findUnique({
            where: { email: normalizedEmail },
        });
        if (platformUser) {
            if (platformUser.status !== client_1.UserStatus.ACTIVE) {
                throw new Error('This platform account is inactive or suspended.');
            }
            const isMatch = await bcryptjs_1.default.compare(password, platformUser.passwordHash);
            if (!isMatch) {
                throw new Error('Invalid email or password.');
            }
            const tokenFamily = crypto_1.default.randomUUID();
            const payload = {
                userId: platformUser.id,
                email: platformUser.email,
                role: platformUser.role,
                userType: 'PLATFORM',
            };
            const accessToken = (0, jwt_1.signAccessToken)(payload);
            const refreshToken = (0, jwt_1.signRefreshToken)(payload, tokenFamily);
            // Store hashed refresh token
            await database_1.prisma.refreshToken.create({
                data: {
                    tokenHash: (0, jwt_1.hashToken)(refreshToken),
                    userId: platformUser.id,
                    userType: 'PLATFORM',
                    family: tokenFamily,
                    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                },
            });
            await database_1.prisma.platformUser.update({
                where: { id: platformUser.id },
                data: { lastLoginAt: new Date() },
            });
            await (0, audit_1.createAuditLog)({
                actorId: platformUser.id,
                actorType: client_1.AuditActorType.PLATFORM_USER,
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
        // 2. Check SchoolUser
        const schoolUser = await database_1.prisma.schoolUser.findFirst({
            where: { email: normalizedEmail },
            include: {
                school: {
                    select: { id: true, name: true, schoolId: true, status: true },
                },
                teacherProfile: {
                    select: { id: true, teacherCode: true, designation: true },
                },
            },
        });
        if (!schoolUser) {
            throw new Error('Invalid email or password.');
        }
        if (schoolUser.school.status === client_1.SchoolStatus.SUSPENDED) {
            throw new Error('Your school account is currently suspended. Please contact platform support.');
        }
        if (schoolUser.status !== client_1.UserStatus.ACTIVE) {
            throw new Error('Your account is pending activation or suspended.');
        }
        const isMatch = await bcryptjs_1.default.compare(password, schoolUser.passwordHash);
        if (!isMatch) {
            throw new Error('Invalid email or password.');
        }
        const tokenFamily = crypto_1.default.randomUUID();
        const payload = {
            userId: schoolUser.id,
            email: schoolUser.email,
            role: schoolUser.role,
            schoolId: schoolUser.schoolId,
            tenantId: schoolUser.schoolId,
            userType: 'SCHOOL',
        };
        const accessToken = (0, jwt_1.signAccessToken)(payload);
        const refreshToken = (0, jwt_1.signRefreshToken)(payload, tokenFamily);
        await database_1.prisma.refreshToken.create({
            data: {
                tokenHash: (0, jwt_1.hashToken)(refreshToken),
                userId: schoolUser.id,
                userType: 'SCHOOL',
                family: tokenFamily,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            },
        });
        await database_1.prisma.schoolUser.update({
            where: { id: schoolUser.id },
            data: { lastLoginAt: new Date() },
        });
        await (0, audit_1.createAuditLog)({
            actorId: schoolUser.id,
            actorType: client_1.AuditActorType.SCHOOL_USER,
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
    async rotateRefreshToken(rawToken) {
        let decoded;
        try {
            decoded = (0, jwt_1.verifyRefreshToken)(rawToken);
        }
        catch (e) {
            throw new Error('Invalid or expired refresh token');
        }
        const tokenHash = (0, jwt_1.hashToken)(rawToken);
        const storedToken = await database_1.prisma.refreshToken.findUnique({
            where: { tokenHash },
        });
        if (!storedToken) {
            throw new Error('Refresh token not found');
        }
        // Reuse detection
        if (storedToken.isRevoked) {
            // Invalidate all tokens in this family
            await database_1.prisma.refreshToken.updateMany({
                where: { family: storedToken.family },
                data: { isRevoked: true },
            });
            throw new Error('Security breach detected: Revoked token reused. Session invalidated.');
        }
        if (new Date() > storedToken.expiresAt) {
            throw new Error('Refresh token expired');
        }
        // Revoke old token
        await database_1.prisma.refreshToken.update({
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
        const newAccessToken = (0, jwt_1.signAccessToken)(payload);
        const newRefreshToken = (0, jwt_1.signRefreshToken)(payload, storedToken.family);
        await database_1.prisma.refreshToken.create({
            data: {
                tokenHash: (0, jwt_1.hashToken)(newRefreshToken),
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
    async logout(rawToken) {
        if (!rawToken)
            return;
        try {
            const tokenHash = (0, jwt_1.hashToken)(rawToken);
            await database_1.prisma.refreshToken.updateMany({
                where: { tokenHash },
                data: { isRevoked: true },
            });
        }
        catch (e) {
            // Ignore token hash errors during logout
        }
    }
    async getCurrentUser(userId, userType) {
        if (userType === 'PLATFORM') {
            const user = await database_1.prisma.platformUser.findUnique({
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
            if (!user)
                throw new Error('User not found');
            return { ...user, userType: 'PLATFORM' };
        }
        else {
            const user = await database_1.prisma.schoolUser.findUnique({
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
            if (!user)
                throw new Error('User not found');
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
    async forgotPassword(email) {
        const normalizedEmail = email.toLowerCase().trim();
        const token = crypto_1.default.randomBytes(32).toString('hex');
        const tokenHash = (0, jwt_1.hashToken)(token);
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
        // Look for platform user or school user
        const platformUser = await database_1.prisma.platformUser.findUnique({ where: { email: normalizedEmail } });
        const userType = platformUser ? 'PLATFORM' : 'SCHOOL';
        await database_1.prisma.passwordResetToken.create({
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
    async resetPassword(token, newPassword) {
        const tokenHash = (0, jwt_1.hashToken)(token);
        const resetRecord = await database_1.prisma.passwordResetToken.findUnique({
            where: { tokenHash },
        });
        if (!resetRecord || resetRecord.usedAt || new Date() > resetRecord.expiresAt) {
            throw new Error('Invalid or expired password reset link.');
        }
        const passwordHash = await bcryptjs_1.default.hash(newPassword, 12);
        if (resetRecord.userType === 'PLATFORM') {
            await database_1.prisma.platformUser.update({
                where: { email: resetRecord.email },
                data: { passwordHash },
            });
        }
        else {
            await database_1.prisma.schoolUser.updateMany({
                where: { email: resetRecord.email },
                data: { passwordHash },
            });
        }
        await database_1.prisma.passwordResetToken.update({
            where: { id: resetRecord.id },
            data: { usedAt: new Date() },
        });
        return { message: 'Password reset successfully. Please log in with your new credentials.' };
    }
}
exports.AuthService = AuthService;
exports.authService = new AuthService();
