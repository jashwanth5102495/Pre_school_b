"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = authenticate;
const jwt_1 = require("../utils/jwt");
const response_1 = require("../utils/response");
function authenticate(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return (0, response_1.errorResponse)(res, 'Authentication token missing or invalid', 401, 'UNAUTHORIZED');
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = (0, jwt_1.verifyAccessToken)(token);
        req.user = {
            userId: decoded.userId,
            email: decoded.email,
            role: decoded.role,
            userType: decoded.userType,
            schoolId: decoded.schoolId,
            tenantId: decoded.tenantId,
        };
        if (decoded.userType === 'SCHOOL' && decoded.schoolId) {
            req.tenantId = decoded.schoolId;
        }
        next();
    }
    catch (err) {
        if (err.name === 'TokenExpiredError') {
            return (0, response_1.errorResponse)(res, 'Access token has expired', 401, 'TOKEN_EXPIRED');
        }
        return (0, response_1.errorResponse)(res, 'Invalid authentication token', 401, 'INVALID_TOKEN');
    }
}
