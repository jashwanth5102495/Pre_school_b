import { prisma } from '../config/database';
import { AuditActorType } from '@prisma/client';

export interface CreateAuditLogParams {
  actorId: string;
  actorType?: AuditActorType;
  actorEmail: string;
  action: string;
  targetType: string;
  targetId?: string;
  tenantId?: string;
  metadata?: any;
  ipAddress?: string;
  userAgent?: string;
  tx?: any; // Optional Prisma transaction client
}

export async function createAuditLog(params: CreateAuditLogParams) {
  try {
    const client = params.tx || prisma;
    return await client.auditLog.create({
      data: {
        actorId: params.actorId,
        actorType: params.actorType || AuditActorType.PLATFORM_USER,
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
  } catch (error) {
    console.error('[Audit] Failed to create audit log entry:', error);
  }
}
