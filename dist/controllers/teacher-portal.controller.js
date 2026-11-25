"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.teacherPortalController = exports.TeacherPortalController = void 0;
const teacher_portal_service_1 = require("../services/teacher-portal.service");
const response_1 = require("../utils/response");
class TeacherPortalController {
    async getTeacherId(req) {
        const teacher = await teacher_portal_service_1.teacherPortalService.getTeacherByUserId(req.tenantId, req.user.userId, req.user.email);
        return teacher.id;
    }
    async getDashboard(req, res) {
        try {
            const teacherId = await this.getTeacherId(req);
            const data = await teacher_portal_service_1.teacherPortalService.getDashboard(req.tenantId, teacherId);
            return (0, response_1.successResponse)(res, data, 'Teacher dashboard metrics retrieved successfully');
        }
        catch (error) {
            return (0, response_1.errorResponse)(res, error.message || 'Failed to retrieve teacher dashboard', 500);
        }
    }
    async getAssignedClasses(req, res) {
        try {
            const teacherId = await this.getTeacherId(req);
            const classes = await teacher_portal_service_1.teacherPortalService.getAssignedClasses(req.tenantId, teacherId);
            return (0, response_1.successResponse)(res, classes, 'Assigned classes retrieved successfully');
        }
        catch (error) {
            return (0, response_1.errorResponse)(res, error.message || 'Failed to retrieve assigned classes', 500);
        }
    }
    async getAttendanceSession(req, res) {
        try {
            const teacherId = await this.getTeacherId(req);
            const classId = req.query.classId;
            const sectionId = req.query.sectionId;
            const date = req.query.date;
            if (!classId || !sectionId) {
                return (0, response_1.errorResponse)(res, 'classId and sectionId are required', 400);
            }
            const session = await teacher_portal_service_1.teacherPortalService.getAttendanceSession(req.tenantId, teacherId, {
                classId,
                sectionId,
                date,
            });
            return (0, response_1.successResponse)(res, session, 'Attendance roster retrieved successfully');
        }
        catch (error) {
            return (0, response_1.errorResponse)(res, error.message || 'Failed to retrieve attendance roster', 500);
        }
    }
    async markAttendance(req, res) {
        try {
            const teacherId = await this.getTeacherId(req);
            const result = await teacher_portal_service_1.teacherPortalService.markAttendance(req.tenantId, teacherId, req.body);
            return (0, response_1.successResponse)(res, result, 'Attendance marked successfully', 201);
        }
        catch (error) {
            return (0, response_1.errorResponse)(res, error.message || 'Failed to mark attendance', 400);
        }
    }
    async getExamSubjects(req, res) {
        try {
            const teacherId = await this.getTeacherId(req);
            const subjects = await teacher_portal_service_1.teacherPortalService.getExamSubjectsForTeacher(req.tenantId, teacherId);
            return (0, response_1.successResponse)(res, subjects, 'Examination subjects retrieved successfully');
        }
        catch (error) {
            return (0, response_1.errorResponse)(res, error.message || 'Failed to retrieve exam subjects', 500);
        }
    }
    async getMarksSheet(req, res) {
        try {
            const teacherId = await this.getTeacherId(req);
            const examSubjectId = Array.isArray(req.params.examSubjectId)
                ? req.params.examSubjectId[0]
                : req.params.examSubjectId;
            const sheet = await teacher_portal_service_1.teacherPortalService.getMarksSheet(req.tenantId, teacherId, examSubjectId);
            return (0, response_1.successResponse)(res, sheet, 'Marks entry sheet retrieved successfully');
        }
        catch (error) {
            return (0, response_1.errorResponse)(res, error.message || 'Failed to retrieve marks sheet', 500);
        }
    }
    async saveMarks(req, res) {
        try {
            const teacherId = await this.getTeacherId(req);
            const result = await teacher_portal_service_1.teacherPortalService.saveMarks(req.tenantId, teacherId, req.body);
            return (0, response_1.successResponse)(res, result, 'Marks saved successfully');
        }
        catch (error) {
            return (0, response_1.errorResponse)(res, error.message || 'Failed to save marks', 400);
        }
    }
    async getTimetable(req, res) {
        try {
            const teacherId = await this.getTeacherId(req);
            const timetable = await teacher_portal_service_1.teacherPortalService.getTimetable(req.tenantId, teacherId);
            return (0, response_1.successResponse)(res, timetable, 'Teacher timetable retrieved successfully');
        }
        catch (error) {
            return (0, response_1.errorResponse)(res, error.message || 'Failed to retrieve timetable', 500);
        }
    }
    async getHomework(req, res) {
        try {
            const teacherId = await this.getTeacherId(req);
            const homework = await teacher_portal_service_1.teacherPortalService.getHomework(req.tenantId, teacherId);
            return (0, response_1.successResponse)(res, homework, 'Homework assignments retrieved successfully');
        }
        catch (error) {
            return (0, response_1.errorResponse)(res, error.message || 'Failed to retrieve homework', 500);
        }
    }
    async createHomework(req, res) {
        try {
            const teacherId = await this.getTeacherId(req);
            const created = await teacher_portal_service_1.teacherPortalService.createHomework(req.tenantId, teacherId, req.body);
            return (0, response_1.successResponse)(res, created, 'Homework assignment created successfully', 201);
        }
        catch (error) {
            return (0, response_1.errorResponse)(res, error.message || 'Failed to create homework', 400);
        }
    }
    async getLeaves(req, res) {
        try {
            const teacherId = await this.getTeacherId(req);
            const data = await teacher_portal_service_1.teacherPortalService.getMyLeaves(req.tenantId, teacherId);
            return (0, response_1.successResponse)(res, data, 'Teacher leaves and balances retrieved successfully');
        }
        catch (error) {
            return (0, response_1.errorResponse)(res, error.message || 'Failed to retrieve leaves', 500);
        }
    }
    async applyLeave(req, res) {
        try {
            const teacherId = await this.getTeacherId(req);
            const applied = await teacher_portal_service_1.teacherPortalService.applyLeave(req.tenantId, teacherId, req.body);
            return (0, response_1.successResponse)(res, applied, 'Leave application submitted successfully', 201);
        }
        catch (error) {
            return (0, response_1.errorResponse)(res, error.message || 'Failed to submit leave application', 400);
        }
    }
}
exports.TeacherPortalController = TeacherPortalController;
exports.teacherPortalController = new TeacherPortalController();
