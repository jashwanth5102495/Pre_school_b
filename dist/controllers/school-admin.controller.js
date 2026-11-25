"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.schoolAdminController = exports.SchoolAdminController = void 0;
const school_admin_service_1 = require("../services/school-admin.service");
const response_1 = require("../utils/response");
class SchoolAdminController {
    async getDashboard(req, res) {
        try {
            const data = await school_admin_service_1.schoolAdminService.getDashboardMetrics(req.tenantId);
            return (0, response_1.successResponse)(res, data, 'School dashboard metrics fetched successfully');
        }
        catch (error) {
            return (0, response_1.errorResponse)(res, error.message || 'Failed to fetch dashboard metrics', 500);
        }
    }
    async getStudents(req, res) {
        try {
            const page = req.query.page ? parseInt(req.query.page) : 1;
            const limit = req.query.limit ? parseInt(req.query.limit) : 20;
            const search = req.query.search;
            const classId = req.query.classId;
            const sectionId = req.query.sectionId;
            const status = req.query.status;
            const result = await school_admin_service_1.schoolAdminService.getStudents(req.tenantId, {
                page,
                limit,
                search,
                classId,
                sectionId,
                status,
            });
            return (0, response_1.successResponse)(res, result.students, 'Students retrieved successfully', 200, result.meta);
        }
        catch (error) {
            return (0, response_1.errorResponse)(res, error.message || 'Failed to retrieve students', 500);
        }
    }
    async getStudentById(req, res) {
        try {
            const studentId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const student = await school_admin_service_1.schoolAdminService.getStudentById(req.tenantId, studentId);
            return (0, response_1.successResponse)(res, student, 'Student profile fetched successfully');
        }
        catch (error) {
            return (0, response_1.errorResponse)(res, error.message || 'Failed to fetch student profile', 404);
        }
    }
    async createStudent(req, res) {
        try {
            const student = await school_admin_service_1.schoolAdminService.createStudent(req.tenantId, req.body);
            return (0, response_1.successResponse)(res, student, 'Student enrolled successfully', 201);
        }
        catch (error) {
            return (0, response_1.errorResponse)(res, error.message || 'Failed to enroll student', 400);
        }
    }
    async updateStudent(req, res) {
        try {
            const studentId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const student = await school_admin_service_1.schoolAdminService.updateStudent(req.tenantId, studentId, req.body);
            return (0, response_1.successResponse)(res, student, 'Student updated successfully');
        }
        catch (error) {
            return (0, response_1.errorResponse)(res, error.message || 'Failed to update student', 400);
        }
    }
    async getStaff(req, res) {
        try {
            const staff = await school_admin_service_1.schoolAdminService.getStaff(req.tenantId);
            return (0, response_1.successResponse)(res, staff, 'Staff retrieved successfully');
        }
        catch (error) {
            return (0, response_1.errorResponse)(res, error.message || 'Failed to retrieve staff', 500);
        }
    }
    async createStaff(req, res) {
        try {
            const user = await school_admin_service_1.schoolAdminService.createStaff(req.tenantId, req.body);
            return (0, response_1.successResponse)(res, user, 'Staff member created successfully', 201);
        }
        catch (error) {
            return (0, response_1.errorResponse)(res, error.message || 'Failed to create staff member', 400);
        }
    }
    async getClasses(req, res) {
        try {
            const classes = await school_admin_service_1.schoolAdminService.getClasses(req.tenantId);
            return (0, response_1.successResponse)(res, classes, 'Classes retrieved successfully');
        }
        catch (error) {
            return (0, response_1.errorResponse)(res, error.message || 'Failed to retrieve classes', 500);
        }
    }
    async getFeesOverview(req, res) {
        try {
            const fees = await school_admin_service_1.schoolAdminService.getFeesOverview(req.tenantId);
            return (0, response_1.successResponse)(res, fees, 'Fee overview fetched successfully');
        }
        catch (error) {
            return (0, response_1.errorResponse)(res, error.message || 'Failed to fetch fee overview', 500);
        }
    }
    async getAttendanceOverview(req, res) {
        try {
            const date = req.query.date;
            const data = await school_admin_service_1.schoolAdminService.getAttendanceOverview(req.tenantId, date);
            return (0, response_1.successResponse)(res, data, 'Attendance overview fetched successfully');
        }
        catch (error) {
            return (0, response_1.errorResponse)(res, error.message || 'Failed to fetch attendance overview', 500);
        }
    }
    async getProfile(req, res) {
        try {
            const profile = await school_admin_service_1.schoolAdminService.getSchoolProfile(req.tenantId);
            return (0, response_1.successResponse)(res, profile, 'School profile fetched successfully');
        }
        catch (error) {
            return (0, response_1.errorResponse)(res, error.message || 'Failed to fetch profile', 500);
        }
    }
    async updateProfile(req, res) {
        try {
            const profile = await school_admin_service_1.schoolAdminService.updateSchoolProfile(req.tenantId, req.body);
            return (0, response_1.successResponse)(res, profile, 'School profile updated successfully');
        }
        catch (error) {
            return (0, response_1.errorResponse)(res, error.message || 'Failed to update profile', 400);
        }
    }
}
exports.SchoolAdminController = SchoolAdminController;
exports.schoolAdminController = new SchoolAdminController();
