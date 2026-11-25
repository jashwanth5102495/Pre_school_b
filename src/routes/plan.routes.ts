import { Router } from 'express';
import { planController } from '../controllers/plan.controller';
import { authenticate } from '../middlewares/auth';
import { requirePlatformRole } from '../middlewares/rbac';
import { PlatformRole } from '@prisma/client';

const router = Router();

router.use(authenticate);
router.use(requirePlatformRole(PlatformRole.SUPER_ADMIN, PlatformRole.PLATFORM_SUPPORT, PlatformRole.PLATFORM_FINANCE));

router.get('/plans', (req, res, next) => planController.listPlans(req, res, next));
router.post('/plans', (req, res, next) => planController.createPlan(req, res, next));
router.patch('/plans/:id', (req, res, next) => planController.updatePlan(req, res, next));

router.get('/subscriptions', (req, res, next) => planController.listSubscriptions(req, res, next));
router.post('/subscriptions/:id/renew', (req, res, next) => planController.renewSubscription(req, res, next));

export default router;
