import { Router } from 'express';
import { dashboardController } from '../controllers/dashboard.controller';
import { authenticate } from '../middlewares/auth';
import { requirePlatformRole } from '../middlewares/rbac';
import { PlatformRole } from '@prisma/client';

const router = Router();

// Protect all Super Admin dashboard routes
router.use(authenticate);
router.use(requirePlatformRole(PlatformRole.SUPER_ADMIN, PlatformRole.PLATFORM_SUPPORT, PlatformRole.PLATFORM_FINANCE));

router.get('/', (req, res, next) => dashboardController.getDashboardData(req, res, next));
router.get('/revenue', (req, res, next) => dashboardController.getRevenueChart(req, res, next));
router.get('/school-growth', (req, res, next) => dashboardController.getSchoolGrowthChart(req, res, next));

export default router;
