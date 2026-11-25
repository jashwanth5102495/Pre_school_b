import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { errorResponse } from '../utils/response';
import { SchoolStatus } from '@prisma/client';

export async function enforceTenantContext(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return errorResponse(res, 'Authentication required', 401, 'UNAUTHORIZED');
  }

  // Super Admin can access tenant context if specifically investigating a school, or pass through
  if (req.user.userType === 'PLATFORM') {
    return next();
  }

  const schoolId = req.user.schoolId;
  if (!schoolId) {
    return errorResponse(res, 'Tenant context missing from session', 403, 'TENANT_REQUIRED');
  }

  try {
    const school = await prisma.school.findUnique({
      where: { id: schoolId },
      select: { id: true, status: true, name: true },
    });

    if (!school) {
      return errorResponse(res, 'School tenant does not exist', 404, 'TENANT_NOT_FOUND');
    }

    if (school.status === SchoolStatus.SUSPENDED) {
      return errorResponse(res, 'This school account has been suspended by platform administration.', 403, 'TENANT_SUSPENDED');
    }

    if (school.status === SchoolStatus.INACTIVE || school.status === SchoolStatus.ARCHIVED) {
      return errorResponse(res, 'This school account is deactivated.', 403, 'TENANT_INACTIVE');
    }

    req.tenantId = school.id;
    next();
  } catch (error) {
    console.error('[Tenant] Error verifying tenant context:', error);
    return errorResponse(res, 'Failed to verify school tenant state', 500, 'INTERNAL_ERROR');
  }
}
