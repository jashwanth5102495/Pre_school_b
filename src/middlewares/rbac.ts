import { Request, Response, NextFunction } from 'express';
import { PlatformRole, SchoolRole } from '@prisma/client';
import { errorResponse } from '../utils/response';

export function requirePlatformRole(...allowedRoles: PlatformRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return errorResponse(res, 'User not authenticated', 401, 'UNAUTHORIZED');
    }

    if (req.user.userType !== 'PLATFORM') {
      return errorResponse(res, 'Access denied. Platform credentials required.', 403, 'FORBIDDEN');
    }

    if (!allowedRoles.includes(req.user.role as PlatformRole)) {
      return errorResponse(
        res,
        `Forbidden: Insufficient privileges. Required: [${allowedRoles.join(', ')}]`,
        403,
        'FORBIDDEN'
      );
    }

    next();
  };
}

export function requireSchoolRole(...allowedRoles: SchoolRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return errorResponse(res, 'User not authenticated', 401, 'UNAUTHORIZED');
    }

    if (req.user.userType !== 'SCHOOL') {
      return errorResponse(res, 'Access denied. School credentials required.', 403, 'FORBIDDEN');
    }

    if (!allowedRoles.includes(req.user.role as SchoolRole)) {
      return errorResponse(
        res,
        `Forbidden: Insufficient school privileges. Required: [${allowedRoles.join(', ')}]`,
        403,
        'FORBIDDEN'
      );
    }

    next();
  };
}
