"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.operationsService = exports.OperationsService = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const database_1 = require("../config/database");
const audit_1 = require("../utils/audit");
const sockets_1 = require("../sockets");
const client_1 = require("@prisma/client");
class OperationsService {
    // 1. Platform Users
    async listPlatformUsers() {
        return database_1.prisma.platformUser.findMany({
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
    async createPlatformUser(data, actorId, actorEmail) {
        const existing = await database_1.prisma.platformUser.findUnique({
            where: { email: data.email.toLowerCase() },
        });
        if (existing)
            throw new Error('A platform user with this email already exists.');
        const passwordHash = await bcryptjs_1.default.hash(data.password, 12);
        const user = await database_1.prisma.platformUser.create({
            data: {
                email: data.email.toLowerCase(),
                fullName: data.fullName,
                phone: data.phone || null,
                role: data.role,
                passwordHash,
                status: client_1.UserStatus.ACTIVE,
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
        await (0, audit_1.createAuditLog)({
            actorId,
            actorType: client_1.AuditActorType.PLATFORM_USER,
            actorEmail,
            action: 'PLATFORM_USER_CREATED',
            targetType: 'PLATFORM_USER',
            targetId: user.id,
            metadata: { email: user.email, role: user.role },
        });
        return user;
    }
    async updatePlatformUserStatus(userId, status, actorId, actorEmail) {
        if (userId === actorId) {
            throw new Error('You cannot deactivate your own administrative account.');
        }
        const updated = await database_1.prisma.platformUser.update({
            where: { id: userId },
            data: { status },
            select: { id: true, email: true, status: true },
        });
        await (0, audit_1.createAuditLog)({
            actorId,
            actorType: client_1.AuditActorType.PLATFORM_USER,
            actorEmail,
            action: `PLATFORM_USER_STATUS_${status}`,
            targetType: 'PLATFORM_USER',
            targetId: userId,
        });
        return updated;
    }
    // 2. Feature Management
    async listFeatures() {
        return database_1.prisma.featureDefinition.findMany({
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
    async createFeature(data, actorId, actorEmail) {
        const feat = await database_1.prisma.featureDefinition.create({
            data,
        });
        await (0, audit_1.createAuditLog)({
            actorId,
            actorType: client_1.AuditActorType.PLATFORM_USER,
            actorEmail,
            action: 'FEATURE_CREATED',
            targetType: 'FEATURE_DEFINITION',
            targetId: feat.id,
            metadata: { code: feat.code, name: feat.name },
        });
        return feat;
    }
    async overrideSchoolFeature(data, actorId, actorEmail) {
        const override = await database_1.prisma.schoolFeatureOverride.upsert({
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
        await (0, audit_1.createAuditLog)({
            actorId,
            actorType: client_1.AuditActorType.PLATFORM_USER,
            actorEmail,
            action: 'FEATURE_OVERRIDE_SET',
            targetType: 'SCHOOL_FEATURE_OVERRIDE',
            targetId: override.id,
            tenantId: data.schoolId,
            metadata: data,
        });
        (0, sockets_1.broadcastToTenant)(data.schoolId, 'tenant:feature_override', {
            featureCode: data.featureCode,
            isEnabled: data.isEnabled,
        });
        return override;
    }
    // 3. Notifications & Announcements
    async listNotifications() {
        return database_1.prisma.notification.findMany({
            orderBy: { createdAt: 'desc' },
            take: 50,
        });
    }
    async createNotification(data, actorId, actorEmail) {
        const notification = await database_1.prisma.notification.create({
            data: {
                ...data,
                senderId: actorId,
            },
        });
        await (0, audit_1.createAuditLog)({
            actorId,
            actorType: client_1.AuditActorType.PLATFORM_USER,
            actorEmail,
            action: 'ANNOUNCEMENT_BROADCAST',
            targetType: 'NOTIFICATION',
            targetId: notification.id,
            metadata: { title: notification.title, targetType: notification.targetType },
        });
        // Real-time distribution
        if (notification.targetType === 'ALL') {
            (0, sockets_1.broadcastToAll)('platform:announcement', notification);
        }
        else if (notification.targetType === 'SPECIFIC_SCHOOLS' && notification.targetSchoolId) {
            (0, sockets_1.broadcastToTenant)(notification.targetSchoolId, 'tenant:announcement', notification);
        }
        else {
            (0, sockets_1.broadcastToSuperAdmins)('platform:announcement', notification);
        }
        return notification;
    }
    // 4. Audit Logs
    async listAuditLogs(options) {
        const { page = 1, limit = 20, action, targetType, tenantId } = options;
        const skip = (page - 1) * limit;
        const where = {};
        if (action)
            where.action = { contains: action, mode: 'insensitive' };
        if (targetType)
            where.targetType = targetType;
        if (tenantId)
            where.tenantId = tenantId;
        const [logs, total] = await Promise.all([
            database_1.prisma.auditLog.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
            }),
            database_1.prisma.auditLog.count({ where }),
        ]);
        return { logs, total };
    }
}
exports.OperationsService = OperationsService;
exports.operationsService = new OperationsService();
