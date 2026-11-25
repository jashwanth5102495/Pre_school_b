"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dashboardController = exports.DashboardController = void 0;
const dashboard_service_1 = require("../services/dashboard.service");
const response_1 = require("../utils/response");
class DashboardController {
    async getDashboardData(req, res, next) {
        try {
            const data = await dashboard_service_1.dashboardService.getMetrics();
            return (0, response_1.successResponse)(res, data);
        }
        catch (err) {
            next(err);
        }
    }
    async getRevenueChart(req, res, next) {
        try {
            const data = await dashboard_service_1.dashboardService.getRevenueGrowthChart();
            return (0, response_1.successResponse)(res, data);
        }
        catch (err) {
            next(err);
        }
    }
    async getSchoolGrowthChart(req, res, next) {
        try {
            const data = await dashboard_service_1.dashboardService.getSchoolGrowthChart();
            return (0, response_1.successResponse)(res, data);
        }
        catch (err) {
            next(err);
        }
    }
}
exports.DashboardController = DashboardController;
exports.dashboardController = new DashboardController();
