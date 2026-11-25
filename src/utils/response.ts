import { Response } from 'express';

export function successResponse<T>(
  res: Response,
  data: T,
  message?: string,
  statusCode: number = 200,
  meta?: any
) {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    meta,
  });
}

export function paginatedResponse<T>(
  res: Response,
  data: T[],
  total: number,
  page: number,
  limit: number,
  message?: string
) {
  return res.status(200).json({
    success: true,
    message,
    data,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  });
}

export function errorResponse(
  res: Response,
  message: string,
  statusCode: number = 500,
  code: string = 'INTERNAL_ERROR',
  details?: any
) {
  return res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      details,
    },
  });
}
