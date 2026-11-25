import { Router } from 'express';
import { operationsController } from '../controllers/operations.controller';
import { authenticate } from '../middlewares/auth';
import { requirePlatformRole } from '../middlewares/rbac';
import { PlatformRole } from '@prisma/client';

const router = Router();

router.use(authenticate);
router.use(requirePlatformRole(PlatformRole.SUPER_ADMIN, PlatformRole.PLATFORM_SUPPORT));

// Platform Users
router.get('/users', (req, res, next) => operationsController.listUsers(req, res, next));
router.post('/users', (req, res, next) => operationsController.createUser(req, res, next));
router.patch('/users/:id/status', (req, res, next) => operationsController.updateUserStatus(req, res, next));

// Feature Management
router.get('/features', (req, res, next) => operationsController.listFeatures(req, res, next));
router.post('/features', (req, res, next) => operationsController.createFeature(req, res, next));
router.post('/features/override', (req, res, next) => operationsController.overrideSchoolFeature(req, res, next));

// Notifications
router.get('/notifications', (req, res, next) => operationsController.listNotifications(req, res, next));
router.post('/notifications', (req, res, next) => operationsController.createNotification(req, res, next));

// Audit Logs
router.get('/audit-logs', (req, res, next) => operationsController.listAuditLogs(req, res, next));

export default router;
