"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.planController = exports.PlanController = void 0;
const subscription_service_1 = require("../services/subscription.service");
const response_1 = require("../utils/response");
const plan_validator_1 = require("../validators/plan.validator");
class PlanController {
    async listPlans(req, res, next) {
        try {
            const plans = await subscription_service_1.subscriptionService.listPlans();
            return (0, response_1.successResponse)(res, plans);
        }
        catch (err) {
            next(err);
        }
    }
    async createPlan(req, res, next) {
        try {
            const validated = plan_validator_1.createPlanSchema.parse(req.body);
            const actorId = req.user.userId;
            const actorEmail = req.user.email;
            const plan = await subscription_service_1.subscriptionService.createPlan(validated, actorId, actorEmail);
            return (0, response_1.successResponse)(res, plan, 'Subscription plan created', 201);
        }
        catch (err) {
            if (err.name === 'ZodError')
                return next(err);
            return (0, response_1.errorResponse)(res, err.message, 400, 'PLAN_CREATION_FAILED');
        }
    }
    async updatePlan(req, res, next) {
        try {
            const validated = plan_validator_1.updatePlanSchema.parse(req.body);
            const actorId = req.user.userId;
            const actorEmail = req.user.email;
            const planId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const plan = await subscription_service_1.subscriptionService.updatePlan(planId, validated, actorId, actorEmail);
            return (0, response_1.successResponse)(res, plan, 'Subscription plan updated');
        }
        catch (err) {
            if (err.name === 'ZodError')
                return next(err);
            return (0, response_1.errorResponse)(res, err.message, 400, 'PLAN_UPDATE_FAILED');
        }
    }
    async listSubscriptions(req, res, next) {
        try {
            const page = parseInt(req.query.page, 10) || 1;
            const limit = parseInt(req.query.limit, 10) || 10;
            const search = req.query.search || undefined;
            const status = req.query.status || undefined;
            const result = await subscription_service_1.subscriptionService.listSubscriptions({ page, limit, search, status });
            return (0, response_1.paginatedResponse)(res, result.subscriptions, result.total, page, limit);
        }
        catch (err) {
            next(err);
        }
    }
    async renewSubscription(req, res, next) {
        try {
            const validated = plan_validator_1.renewSubscriptionSchema.parse(req.body);
            const actorId = req.user.userId;
            const actorEmail = req.user.email;
            const subId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const result = await subscription_service_1.subscriptionService.renewSubscription(subId, validated, actorId, actorEmail);
            return (0, response_1.successResponse)(res, result, 'Subscription extended/renewed successfully');
        }
        catch (err) {
            if (err.name === 'ZodError')
                return next(err);
            return (0, response_1.errorResponse)(res, err.message, 400, 'RENEWAL_FAILED');
        }
    }
}
exports.PlanController = PlanController;
exports.planController = new PlanController();
