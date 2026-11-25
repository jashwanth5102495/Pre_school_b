import { Request, Response, NextFunction } from 'express';
import { dashboardService } from '../services/dashboard.service';
import { successResponse } from '../utils/response';

export class DashboardController {
  async getDashboardData(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await dashboardService.getMetrics();
      return successResponse(res, data);
    } catch (err) {
      next(err);
    }
  }

  async getRevenueChart(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await dashboardService.getRevenueGrowthChart();
      return successResponse(res, data);
    } catch (err) {
      next(err);
    }
  }

  async getSchoolGrowthChart(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await dashboardService.getSchoolGrowthChart();
      return successResponse(res, data);
    } catch (err) {
      next(err);
    }
  }
}

export const dashboardController = new DashboardController();
