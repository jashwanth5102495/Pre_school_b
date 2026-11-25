"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAuditLog = createAuditLog;
const database_1 = require("../config/database");
const client_1 = require("@prisma/client");
async function createAuditLog(params) {
    try {
        const client = params.tx || database_1.prisma;
        return await client.auditLog.create({
            data: {
                actorId: params.actorId,
                actorType: params.actorType || client_1.AuditActorType.PLATFORM_USER,
                actorEmail: params.actorEmail,
                action: params.action,
                targetType: params.targetType,
                targetId: params.targetId,
                tenantId: params.tenantId,
                metadata: params.metadata || {},
                ipAddress: params.ipAddress,
                userAgent: params.userAgent,
            },
        });
    }
    catch (error) {
        console.error('[Audit] Failed to create audit log entry:', error);
    }
}
