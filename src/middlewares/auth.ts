import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt';
import { errorResponse } from '../utils/response';

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return errorResponse(res, 'Authentication token missing or invalid', 401, 'UNAUTHORIZED');
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = verifyAccessToken(token);
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role as any,
      userType: decoded.userType,
      schoolId: decoded.schoolId,
      tenantId: decoded.tenantId,
    };

    if (decoded.userType === 'SCHOOL' && decoded.schoolId) {
      req.tenantId = decoded.schoolId;
    }

    next();
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      return errorResponse(res, 'Access token has expired', 401, 'TOKEN_EXPIRED');
    }
    return errorResponse(res, 'Invalid authentication token', 401, 'INVALID_TOKEN');
  }
}
