"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const dashboard_controller_1 = require("../controllers/dashboard.controller");
const auth_1 = require("../middlewares/auth");
const rbac_1 = require("../middlewares/rbac");
const client_1 = require("@prisma/client");
const router = (0, express_1.Router)();
// Protect all Super Admin dashboard routes
router.use(auth_1.authenticate);
router.use((0, rbac_1.requirePlatformRole)(client_1.PlatformRole.SUPER_ADMIN, client_1.PlatformRole.PLATFORM_SUPPORT, client_1.PlatformRole.PLATFORM_FINANCE));
router.get('/', (req, res, next) => dashboard_controller_1.dashboardController.getDashboardData(req, res, next));
router.get('/revenue', (req, res, next) => dashboard_controller_1.dashboardController.getRevenueChart(req, res, next));
router.get('/school-growth', (req, res, next) => dashboard_controller_1.dashboardController.getSchoolGrowthChart(req, res, next));
exports.default = router;
