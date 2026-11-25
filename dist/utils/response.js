"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.successResponse = successResponse;
exports.paginatedResponse = paginatedResponse;
exports.errorResponse = errorResponse;
function successResponse(res, data, message, statusCode = 200, meta) {
    return res.status(statusCode).json({
        success: true,
        message,
        data,
        meta,
    });
}
function paginatedResponse(res, data, total, page, limit, message) {
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
function errorResponse(res, message, statusCode = 500, code = 'INTERNAL_ERROR', details) {
    return res.status(statusCode).json({
        success: false,
        error: {
            code,
            message,
            details,
        },
    });
}
