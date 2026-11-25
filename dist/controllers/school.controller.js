"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.schoolController = exports.SchoolController = void 0;
const school_service_1 = require("../services/school.service");
const response_1 = require("../utils/response");
const school_validator_1 = require("../validators/school.validator");
class SchoolController {
    async listSchools(req, res, next) {
        try {
            const page = parseInt(req.query.page, 10) || 1;
            const limit = parseInt(req.query.limit, 10) || 10;
            const search = req.query.search || undefined;
            const status = req.query.status || undefined;
            const planId = req.query.planId || undefined;
            const sortBy = req.query.sortBy || 'createdAt';
            const sortOrder = req.query.sortOrder || 'desc';
            const result = await school_service_1.schoolService.listSchools({
                page,
                limit,
                search,
                status,
                planId,
                sortBy,
                sortOrder,
            });
            return (0, response_1.paginatedResponse)(res, result.schools, result.total, page, limit);
        }
        catch (err) {
            next(err);
        }
    }
    async getSchoolById(req, res, next) {
        try {
            const schoolId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const school = await school_service_1.schoolService.getSchoolById(schoolId);
            return (0, response_1.successResponse)(res, school);
        }
        catch (err) {
            return (0, response_1.errorResponse)(res, err.message, 404, 'SCHOOL_NOT_FOUND');
        }
    }
    async provisionSchool(req, res, next) {
        try {
            const validated = school_validator_1.createSchoolSchema.parse(req.body);
            const actorId = req.user.userId;
            const actorEmail = req.user.email;
            const result = await school_service_1.schoolService.provisionSchool(validated, actorId, actorEmail);
            return (0, response_1.successResponse)(res, result, 'School provisioned and activated successfully', 201);
        }
        catch (err) {
            if (err.name === 'ZodError')
                return next(err);
            return (0, response_1.errorResponse)(res, err.message, 400, 'PROVISIONING_FAILED');
        }
    }
    async updateSchool(req, res, next) {
        try {
            const validated = school_validator_1.updateSchoolSchema.parse(req.body);
            const actorId = req.user.userId;
            const actorEmail = req.user.email;
            const schoolId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const updated = await school_service_1.schoolService.updateSchool(schoolId, validated, actorId, actorEmail);
            return (0, response_1.successResponse)(res, updated, 'School updated successfully');
        }
        catch (err) {
            if (err.name === 'ZodError')
                return next(err);
            return (0, response_1.errorResponse)(res, err.message, 400, 'UPDATE_FAILED');
        }
    }
    async updateSchoolStatus(req, res, next) {
        try {
            const validated = school_validator_1.updateSchoolStatusSchema.parse(req.body);
            const actorId = req.user.userId;
            const actorEmail = req.user.email;
            const schoolId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const updated = await school_service_1.schoolService.updateSchoolStatus(schoolId, validated.status, validated.reason, actorId, actorEmail);
            return (0, response_1.successResponse)(res, updated, `School status updated to ${validated.status}`);
        }
        catch (err) {
            if (err.name === 'ZodError')
                return next(err);
            return (0, response_1.errorResponse)(res, err.message, 400, 'STATUS_UPDATE_FAILED');
        }
    }
    async resendInvitation(req, res, next) {
        try {
            const actorId = req.user.userId;
            const actorEmail = req.user.email;
            const schoolId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const result = await school_service_1.schoolService.resendInvitation(schoolId, actorId, actorEmail);
            return (0, response_1.successResponse)(res, result, 'School admin invitation regenerated and sent');
        }
        catch (err) {
            return (0, response_1.errorResponse)(res, err.message, 400, 'INVITATION_FAILED');
        }
    }
    async archiveSchool(req, res, next) {
        try {
            const actorId = req.user.userId;
            const actorEmail = req.user.email;
            const schoolId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const result = await school_service_1.schoolService.archiveSchool(schoolId, actorId, actorEmail);
            return (0, response_1.successResponse)(res, result, 'School successfully archived');
        }
        catch (err) {
            return (0, response_1.errorResponse)(res, err.message, 400, 'ARCHIVE_FAILED');
        }
    }
}
exports.SchoolController = SchoolController;
exports.schoolController = new SchoolController();
