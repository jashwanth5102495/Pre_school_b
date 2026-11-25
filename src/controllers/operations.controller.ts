import { Request, Response, NextFunction } from 'express';
import { operationsService } from '../services/operations.service';
import { successResponse, paginatedResponse, errorResponse } from '../utils/response';
import {
  createPlatformUserSchema,
  updatePlatformUserStatusSchema,
  createFeatureSchema,
  schoolFeatureOverrideSchema,
} from '../validators/user.validator';
import { createNotificationSchema } from '../validators/notification.validator';

export class OperationsController {
  // Platform Users
  async listUsers(req: Request, res: Response, next: NextFunction) {
    try {
      const users = await operationsService.listPlatformUsers();
      return successResponse(res, users);
    } catch (err) {
      next(err);
    }
  }

  async createUser(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = createPlatformUserSchema.parse(req.body);
      const actorId = req.user!.userId;
      const actorEmail = req.user!.email;
      const user = await operationsService.createPlatformUser(validated, actorId, actorEmail);
      return successResponse(res, user, 'Platform user created successfully', 201);
    } catch (err: any) {
      if (err.name === 'ZodError') return next(err);
      return errorResponse(res, err.message, 400, 'USER_CREATION_FAILED');
    }
  }

  async updateUserStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = updatePlatformUserStatusSchema.parse(req.body);
      const actorId = req.user!.userId;
      const actorEmail = req.user!.email;
      const userId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const user = await operationsService.updatePlatformUserStatus(
        userId,
        validated.status,
        actorId,
        actorEmail
      );
      return successResponse(res, user, `Platform user status changed to ${validated.status}`);
    } catch (err: any) {
      return errorResponse(res, err.message, 400, 'STATUS_UPDATE_FAILED');
    }
  }

  // Features
  async listFeatures(req: Request, res: Response, next: NextFunction) {
    try {
      const features = await operationsService.listFeatures();
      return successResponse(res, features);
    } catch (err) {
      next(err);
    }
  }

  async createFeature(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = createFeatureSchema.parse(req.body);
      const actorId = req.user!.userId;
      const actorEmail = req.user!.email;
      const feature = await operationsService.createFeature(validated, actorId, actorEmail);
      return successResponse(res, feature, 'Feature registered successfully', 201);
    } catch (err: any) {
      if (err.name === 'ZodError') return next(err);
      return errorResponse(res, err.message, 400, 'FEATURE_CREATION_FAILED');
    }
  }

  async overrideSchoolFeature(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = schoolFeatureOverrideSchema.parse(req.body);
      const actorId = req.user!.userId;
      const actorEmail = req.user!.email;
      const override = await operationsService.overrideSchoolFeature(validated, actorId, actorEmail);
      return successResponse(res, override, 'School feature override configured successfully');
    } catch (err: any) {
      if (err.name === 'ZodError') return next(err);
      return errorResponse(res, err.message, 400, 'OVERRIDE_FAILED');
    }
  }

  // Notifications
  async listNotifications(req: Request, res: Response, next: NextFunction) {
    try {
      const notifs = await operationsService.listNotifications();
      return successResponse(res, notifs);
    } catch (err) {
      next(err);
    }
  }

  async createNotification(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = createNotificationSchema.parse(req.body);
      const actorId = req.user!.userId;
      const actorEmail = req.user!.email;
      const notif = await operationsService.createNotification(validated, actorId, actorEmail);
      return successResponse(res, notif, 'Notification announcement broadcast successfully', 201);
    } catch (err: any) {
      if (err.name === 'ZodError') return next(err);
      return errorResponse(res, err.message, 400, 'NOTIFICATION_FAILED');
    }
  }

  // Audit Logs
  async listAuditLogs(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 20;
      const action = (req.query.action as string) || undefined;
      const targetType = (req.query.targetType as string) || undefined;
      const tenantId = (req.query.tenantId as string) || undefined;

      const result = await operationsService.listAuditLogs({ page, limit, action, targetType, tenantId });
      return paginatedResponse(res, result.logs, result.total, page, limit);
    } catch (err) {
      next(err);
    }
  }
}

export const operationsController = new OperationsController();
