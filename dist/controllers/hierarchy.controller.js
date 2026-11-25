"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hierarchyController = exports.HierarchyController = void 0;
const hierarchy_service_1 = require("../services/hierarchy.service");
const response_1 = require("../utils/response");
class HierarchyController {
    async getTree(req, res, next) {
        try {
            const schoolId = req.query.schoolId;
            const data = await hierarchy_service_1.hierarchyService.getHierarchyTree(schoolId, req.user);
            return (0, response_1.successResponse)(res, data, 'Hierarchy tree fetched successfully');
        }
        catch (error) {
            return (0, response_1.errorResponse)(res, error.message || 'Failed to fetch hierarchy tree', 500);
        }
    }
    async createMember(req, res, next) {
        try {
            const result = await hierarchy_service_1.hierarchyService.createMember(req.body, req.user);
            return (0, response_1.successResponse)(res, result, 'Member added to hierarchy successfully', 201);
        }
        catch (error) {
            return (0, response_1.errorResponse)(res, error.message || 'Failed to create hierarchy member', 400);
        }
    }
    async updateMember(req, res, next) {
        try {
            const id = req.params.id;
            const type = req.query.type || 'STAFF';
            const updated = await hierarchy_service_1.hierarchyService.updateMember(id, type, req.body, req.user);
            return (0, response_1.successResponse)(res, updated, 'Member updated successfully');
        }
        catch (error) {
            return (0, response_1.errorResponse)(res, error.message || 'Failed to update hierarchy member', 400);
        }
    }
    async deleteMember(req, res, next) {
        try {
            const id = req.params.id;
            const type = req.query.type || 'STAFF';
            await hierarchy_service_1.hierarchyService.deleteMember(id, type);
            return (0, response_1.successResponse)(res, null, 'Member removed from hierarchy');
        }
        catch (error) {
            return (0, response_1.errorResponse)(res, error.message || 'Failed to delete hierarchy member', 400);
        }
    }
}
exports.HierarchyController = HierarchyController;
exports.hierarchyController = new HierarchyController();
