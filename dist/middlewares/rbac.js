"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requirePlatformRole = requirePlatformRole;
exports.requireSchoolRole = requireSchoolRole;
const response_1 = require("../utils/response");
function requirePlatformRole(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user) {
            return (0, response_1.errorResponse)(res, 'User not authenticated', 401, 'UNAUTHORIZED');
        }
        if (req.user.userType !== 'PLATFORM') {
            return (0, response_1.errorResponse)(res, 'Access denied. Platform credentials required.', 403, 'FORBIDDEN');
        }
        if (!allowedRoles.includes(req.user.role)) {
            return (0, response_1.errorResponse)(res, `Forbidden: Insufficient privileges. Required: [${allowedRoles.join(', ')}]`, 403, 'FORBIDDEN');
        }
        next();
    };
}
function requireSchoolRole(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user) {
            return (0, response_1.errorResponse)(res, 'User not authenticated', 401, 'UNAUTHORIZED');
        }
        if (req.user.userType !== 'SCHOOL') {
            return (0, response_1.errorResponse)(res, 'Access denied. School credentials required.', 403, 'FORBIDDEN');
        }
        if (!allowedRoles.includes(req.user.role)) {
            return (0, response_1.errorResponse)(res, `Forbidden: Insufficient school privileges. Required: [${allowedRoles.join(', ')}]`, 403, 'FORBIDDEN');
        }
        next();
    };
}
