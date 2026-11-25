import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { errorResponse } from '../utils/response';

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) {
  console.error('[ErrorHandler] Error caught:', err);

  if (err instanceof ZodError) {
    const formattedErrors = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    return errorResponse(res, 'Validation failed for request data', 400, 'VALIDATION_ERROR', formattedErrors);
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const target = (err.meta?.target as string[])?.join(', ') || 'field';
      return errorResponse(res, `A record with this ${target} already exists.`, 409, 'DUPLICATE_RESOURCE');
    }
    if (err.code === 'P2025') {
      return errorResponse(res, 'Requested resource not found.', 404, 'NOT_FOUND');
    }
  }

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal server error';
  const code = err.code || 'INTERNAL_SERVER_ERROR';

  return errorResponse(res, message, statusCode, code);
}
