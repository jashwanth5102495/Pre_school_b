import { Request, Response, NextFunction } from 'express';
import { subscriptionService } from '../services/subscription.service';
import { successResponse, paginatedResponse, errorResponse } from '../utils/response';
import { createPlanSchema, updatePlanSchema, renewSubscriptionSchema } from '../validators/plan.validator';

export class PlanController {
  async listPlans(req: Request, res: Response, next: NextFunction) {
    try {
      const plans = await subscriptionService.listPlans();
      return successResponse(res, plans);
    } catch (err) {
      next(err);
    }
  }

  async createPlan(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = createPlanSchema.parse(req.body);
      const actorId = req.user!.userId;
      const actorEmail = req.user!.email;
      const plan = await subscriptionService.createPlan(validated, actorId, actorEmail);
      return successResponse(res, plan, 'Subscription plan created', 201);
    } catch (err: any) {
      if (err.name === 'ZodError') return next(err);
      return errorResponse(res, err.message, 400, 'PLAN_CREATION_FAILED');
    }
  }

  async updatePlan(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = updatePlanSchema.parse(req.body);
      const actorId = req.user!.userId;
      const actorEmail = req.user!.email;
      const planId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const plan = await subscriptionService.updatePlan(planId, validated, actorId, actorEmail);
      return successResponse(res, plan, 'Subscription plan updated');
    } catch (err: any) {
      if (err.name === 'ZodError') return next(err);
      return errorResponse(res, err.message, 400, 'PLAN_UPDATE_FAILED');
    }
  }

  async listSubscriptions(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 10;
      const search = (req.query.search as string) || undefined;
      const status = (req.query.status as any) || undefined;

      const result = await subscriptionService.listSubscriptions({ page, limit, search, status });
      return paginatedResponse(res, result.subscriptions, result.total, page, limit);
    } catch (err) {
      next(err);
    }
  }

  async renewSubscription(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = renewSubscriptionSchema.parse(req.body);
      const actorId = req.user!.userId;
      const actorEmail = req.user!.email;
      const subId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

      const result = await subscriptionService.renewSubscription(subId, validated, actorId, actorEmail);
      return successResponse(res, result, 'Subscription extended/renewed successfully');
    } catch (err: any) {
      if (err.name === 'ZodError') return next(err);
      return errorResponse(res, err.message, 400, 'RENEWAL_FAILED');
    }
  }
}

export const planController = new PlanController();
