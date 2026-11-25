"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const operations_controller_1 = require("../controllers/operations.controller");
const auth_1 = require("../middlewares/auth");
const rbac_1 = require("../middlewares/rbac");
const client_1 = require("@prisma/client");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
router.use((0, rbac_1.requirePlatformRole)(client_1.PlatformRole.SUPER_ADMIN, client_1.PlatformRole.PLATFORM_SUPPORT));
// Platform Users
router.get('/users', (req, res, next) => operations_controller_1.operationsController.listUsers(req, res, next));
router.post('/users', (req, res, next) => operations_controller_1.operationsController.createUser(req, res, next));
router.patch('/users/:id/status', (req, res, next) => operations_controller_1.operationsController.updateUserStatus(req, res, next));
// Feature Management
router.get('/features', (req, res, next) => operations_controller_1.operationsController.listFeatures(req, res, next));
router.post('/features', (req, res, next) => operations_controller_1.operationsController.createFeature(req, res, next));
router.post('/features/override', (req, res, next) => operations_controller_1.operationsController.overrideSchoolFeature(req, res, next));
// Notifications
router.get('/notifications', (req, res, next) => operations_controller_1.operationsController.listNotifications(req, res, next));
router.post('/notifications', (req, res, next) => operations_controller_1.operationsController.createNotification(req, res, next));
// Audit Logs
router.get('/audit-logs', (req, res, next) => operations_controller_1.operationsController.listAuditLogs(req, res, next));
exports.default = router;
