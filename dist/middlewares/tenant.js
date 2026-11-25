"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.enforceTenantContext = enforceTenantContext;
const database_1 = require("../config/database");
const response_1 = require("../utils/response");
const client_1 = require("@prisma/client");
async function enforceTenantContext(req, res, next) {
    if (!req.user) {
        return (0, response_1.errorResponse)(res, 'Authentication required', 401, 'UNAUTHORIZED');
    }
    // Super Admin can access tenant context if specifically investigating a school, or pass through
    if (req.user.userType === 'PLATFORM') {
        return next();
    }
    const schoolId = req.user.schoolId;
    if (!schoolId) {
        return (0, response_1.errorResponse)(res, 'Tenant context missing from session', 403, 'TENANT_REQUIRED');
    }
    try {
        const school = await database_1.prisma.school.findUnique({
            where: { id: schoolId },
            select: { id: true, status: true, name: true },
        });
        if (!school) {
            return (0, response_1.errorResponse)(res, 'School tenant does not exist', 404, 'TENANT_NOT_FOUND');
        }
        if (school.status === client_1.SchoolStatus.SUSPENDED) {
            return (0, response_1.errorResponse)(res, 'This school account has been suspended by platform administration.', 403, 'TENANT_SUSPENDED');
        }
        if (school.status === client_1.SchoolStatus.INACTIVE || school.status === client_1.SchoolStatus.ARCHIVED) {
            return (0, response_1.errorResponse)(res, 'This school account is deactivated.', 403, 'TENANT_INACTIVE');
        }
        req.tenantId = school.id;
        next();
    }
    catch (error) {
        console.error('[Tenant] Error verifying tenant context:', error);
        return (0, response_1.errorResponse)(res, 'Failed to verify school tenant state', 500, 'INTERNAL_ERROR');
    }
}
