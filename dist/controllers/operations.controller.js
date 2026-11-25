"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.operationsController = exports.OperationsController = void 0;
const operations_service_1 = require("../services/operations.service");
const response_1 = require("../utils/response");
const user_validator_1 = require("../validators/user.validator");
const notification_validator_1 = require("../validators/notification.validator");
class OperationsController {
    // Platform Users
    async listUsers(req, res, next) {
        try {
            const users = await operations_service_1.operationsService.listPlatformUsers();
            return (0, response_1.successResponse)(res, users);
        }
        catch (err) {
            next(err);
        }
    }
    async createUser(req, res, next) {
        try {
            const validated = user_validator_1.createPlatformUserSchema.parse(req.body);
            const actorId = req.user.userId;
            const actorEmail = req.user.email;
            const user = await operations_service_1.operationsService.createPlatformUser(validated, actorId, actorEmail);
            return (0, response_1.successResponse)(res, user, 'Platform user created successfully', 201);
        }
        catch (err) {
            if (err.name === 'ZodError')
                return next(err);
            return (0, response_1.errorResponse)(res, err.message, 400, 'USER_CREATION_FAILED');
        }
    }
    async updateUserStatus(req, res, next) {
        try {
            const validated = user_validator_1.updatePlatformUserStatusSchema.parse(req.body);
            const actorId = req.user.userId;
            const actorEmail = req.user.email;
            const userId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const user = await operations_service_1.operationsService.updatePlatformUserStatus(userId, validated.status, actorId, actorEmail);
            return (0, response_1.successResponse)(res, user, `Platform user status changed to ${validated.status}`);
        }
        catch (err) {
            return (0, response_1.errorResponse)(res, err.message, 400, 'STATUS_UPDATE_FAILED');
        }
    }
    // Features
    async listFeatures(req, res, next) {
        try {
            const features = await operations_service_1.operationsService.listFeatures();
            return (0, response_1.successResponse)(res, features);
        }
        catch (err) {
            next(err);
        }
    }
    async createFeature(req, res, next) {
        try {
            const validated = user_validator_1.createFeatureSchema.parse(req.body);
            const actorId = req.user.userId;
            const actorEmail = req.user.email;
            const feature = await operations_service_1.operationsService.createFeature(validated, actorId, actorEmail);
            return (0, response_1.successResponse)(res, feature, 'Feature registered successfully', 201);
        }
        catch (err) {
            if (err.name === 'ZodError')
                return next(err);
            return (0, response_1.errorResponse)(res, err.message, 400, 'FEATURE_CREATION_FAILED');
        }
    }
    async overrideSchoolFeature(req, res, next) {
        try {
            const validated = user_validator_1.schoolFeatureOverrideSchema.parse(req.body);
            const actorId = req.user.userId;
            const actorEmail = req.user.email;
            const override = await operations_service_1.operationsService.overrideSchoolFeature(validated, actorId, actorEmail);
            return (0, response_1.successResponse)(res, override, 'School feature override configured successfully');
        }
        catch (err) {
            if (err.name === 'ZodError')
                return next(err);
            return (0, response_1.errorResponse)(res, err.message, 400, 'OVERRIDE_FAILED');
        }
    }
    // Notifications
    async listNotifications(req, res, next) {
        try {
            const notifs = await operations_service_1.operationsService.listNotifications();
            return (0, response_1.successResponse)(res, notifs);
        }
        catch (err) {
            next(err);
        }
    }
    async createNotification(req, res, next) {
        try {
            const validated = notification_validator_1.createNotificationSchema.parse(req.body);
            const actorId = req.user.userId;
            const actorEmail = req.user.email;
            const notif = await operations_service_1.operationsService.createNotification(validated, actorId, actorEmail);
            return (0, response_1.successResponse)(res, notif, 'Notification announcement broadcast successfully', 201);
        }
        catch (err) {
            if (err.name === 'ZodError')
                return next(err);
            return (0, response_1.errorResponse)(res, err.message, 400, 'NOTIFICATION_FAILED');
        }
    }
    // Audit Logs
    async listAuditLogs(req, res, next) {
        try {
            const page = parseInt(req.query.page, 10) || 1;
            const limit = parseInt(req.query.limit, 10) || 20;
            const action = req.query.action || undefined;
            const targetType = req.query.targetType || undefined;
            const tenantId = req.query.tenantId || undefined;
            const result = await operations_service_1.operationsService.listAuditLogs({ page, limit, action, targetType, tenantId });
            return (0, response_1.paginatedResponse)(res, result.logs, result.total, page, limit);
        }
        catch (err) {
            next(err);
        }
    }
}
exports.OperationsController = OperationsController;
exports.operationsController = new OperationsController();
