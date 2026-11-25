"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.headMasterController = exports.HeadMasterController = void 0;
const head_master_service_1 = require("../services/head-master.service");
const response_1 = require("../utils/response");
class HeadMasterController {
    async getDashboard(req, res) {
        try {
            const data = await head_master_service_1.headMasterService.getDashboard(req.tenantId);
            return (0, response_1.successResponse)(res, data, 'Head master dashboard metrics retrieved successfully');
        }
        catch (error) {
            return (0, response_1.errorResponse)(res, error.message || 'Failed to retrieve dashboard', 500);
        }
    }
    async getLeaveApplications(req, res) {
        try {
            const status = req.query.status;
            const leaves = await head_master_service_1.headMasterService.getLeaveApplications(req.tenantId, status);
            return (0, response_1.successResponse)(res, leaves, 'Leave applications retrieved successfully');
        }
        catch (error) {
            return (0, response_1.errorResponse)(res, error.message || 'Failed to retrieve leave applications', 500);
        }
    }
    async reviewLeave(req, res) {
        try {
            const leaveId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const updated = await head_master_service_1.headMasterService.reviewLeaveApplication(req.tenantId, leaveId, req.user.userId, req.body);
            return (0, response_1.successResponse)(res, updated, 'Leave application reviewed successfully');
        }
        catch (error) {
            return (0, response_1.errorResponse)(res, error.message || 'Failed to review leave application', 400);
        }
    }
    async getClassesAndSections(req, res) {
        try {
            const data = await head_master_service_1.headMasterService.getClassesAndSections(req.tenantId);
            return (0, response_1.successResponse)(res, data, 'Classes and sections retrieved successfully');
        }
        catch (error) {
            return (0, response_1.errorResponse)(res, error.message || 'Failed to retrieve classes', 500);
        }
    }
    async createClass(req, res) {
        try {
            const created = await head_master_service_1.headMasterService.createClass(req.tenantId, req.body);
            return (0, response_1.successResponse)(res, created, 'Class created successfully', 201);
        }
        catch (error) {
            return (0, response_1.errorResponse)(res, error.message || 'Failed to create class', 400);
        }
    }
    async createSection(req, res) {
        try {
            const created = await head_master_service_1.headMasterService.createSection(req.tenantId, req.body);
            return (0, response_1.successResponse)(res, created, 'Section created successfully', 201);
        }
        catch (error) {
            return (0, response_1.errorResponse)(res, error.message || 'Failed to create section', 400);
        }
    }
    async getAllocations(req, res) {
        try {
            const data = await head_master_service_1.headMasterService.getAllocations(req.tenantId);
            return (0, response_1.successResponse)(res, data, 'Allocations retrieved successfully');
        }
        catch (error) {
            return (0, response_1.errorResponse)(res, error.message || 'Failed to retrieve allocations', 500);
        }
    }
    async createAllocation(req, res) {
        try {
            const created = await head_master_service_1.headMasterService.createAllocation(req.tenantId, req.body);
            return (0, response_1.successResponse)(res, created, 'Teacher allocation assigned successfully', 201);
        }
        catch (error) {
            return (0, response_1.errorResponse)(res, error.message || 'Failed to assign teacher allocation', 400);
        }
    }
    async deleteAllocation(req, res) {
        try {
            const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            await head_master_service_1.headMasterService.deleteAllocation(req.tenantId, id);
            return (0, response_1.successResponse)(res, null, 'Teacher allocation removed successfully');
        }
        catch (error) {
            return (0, response_1.errorResponse)(res, error.message || 'Failed to remove allocation', 400);
        }
    }
    async getTimetable(req, res) {
        try {
            const data = await head_master_service_1.headMasterService.getTimetable(req.tenantId, req.query);
            return (0, response_1.successResponse)(res, data, 'Timetable retrieved successfully');
        }
        catch (error) {
            return (0, response_1.errorResponse)(res, error.message || 'Failed to retrieve timetable', 500);
        }
    }
    async createTimetablePeriod(req, res) {
        try {
            const created = await head_master_service_1.headMasterService.createTimetablePeriod(req.tenantId, req.body);
            return (0, response_1.successResponse)(res, created, 'Timetable period scheduled successfully', 201);
        }
        catch (error) {
            return (0, response_1.errorResponse)(res, error.message || 'Failed to schedule timetable period', 400);
        }
    }
    async deleteTimetablePeriod(req, res) {
        try {
            const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            await head_master_service_1.headMasterService.deleteTimetablePeriod(req.tenantId, id);
            return (0, response_1.successResponse)(res, null, 'Timetable period deleted successfully');
        }
        catch (error) {
            return (0, response_1.errorResponse)(res, error.message || 'Failed to delete period', 400);
        }
    }
    async getAttendanceSupervision(req, res) {
        try {
            const date = req.query.date;
            const data = await head_master_service_1.headMasterService.getAttendanceSupervision(req.tenantId, date);
            return (0, response_1.successResponse)(res, data, 'Attendance supervision summary retrieved successfully');
        }
        catch (error) {
            return (0, response_1.errorResponse)(res, error.message || 'Failed to retrieve attendance supervision', 500);
        }
    }
    async getMarksSubmissions(req, res) {
        try {
            const status = req.query.status;
            const submissions = await head_master_service_1.headMasterService.getMarksSubmissions(req.tenantId, status);
            return (0, response_1.successResponse)(res, submissions, 'Marks submissions retrieved successfully');
        }
        catch (error) {
            return (0, response_1.errorResponse)(res, error.message || 'Failed to retrieve marks submissions', 500);
        }
    }
    async getSubmissionDetails(req, res) {
        try {
            const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const details = await head_master_service_1.headMasterService.getSubmissionDetails(req.tenantId, id);
            return (0, response_1.successResponse)(res, details, 'Marks submission details retrieved successfully');
        }
        catch (error) {
            return (0, response_1.errorResponse)(res, error.message || 'Failed to retrieve submission details', 404);
        }
    }
    async reviewMarksSubmission(req, res) {
        try {
            const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const updated = await head_master_service_1.headMasterService.reviewMarksSubmission(req.tenantId, id, req.user.userId, req.body);
            return (0, response_1.successResponse)(res, updated, 'Marks submission moderated successfully');
        }
        catch (error) {
            return (0, response_1.errorResponse)(res, error.message || 'Failed to moderate marks submission', 400);
        }
    }
}
exports.HeadMasterController = HeadMasterController;
exports.headMasterController = new HeadMasterController();
