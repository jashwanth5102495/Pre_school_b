"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = errorHandler;
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
const response_1 = require("../utils/response");
function errorHandler(err, req, res, next) {
    console.error('[ErrorHandler] Error caught:', err);
    if (err instanceof zod_1.ZodError) {
        const formattedErrors = err.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
        }));
        return (0, response_1.errorResponse)(res, 'Validation failed for request data', 400, 'VALIDATION_ERROR', formattedErrors);
    }
    if (err instanceof client_1.Prisma.PrismaClientKnownRequestError) {
        if (err.code === 'P2002') {
            const target = err.meta?.target?.join(', ') || 'field';
            return (0, response_1.errorResponse)(res, `A record with this ${target} already exists.`, 409, 'DUPLICATE_RESOURCE');
        }
        if (err.code === 'P2025') {
            return (0, response_1.errorResponse)(res, 'Requested resource not found.', 404, 'NOT_FOUND');
        }
    }
    const statusCode = err.statusCode || 500;
    const message = err.message || 'Internal server error';
    const code = err.code || 'INTERNAL_SERVER_ERROR';
    return (0, response_1.errorResponse)(res, message, statusCode, code);
}
