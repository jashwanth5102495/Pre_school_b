import { Request, Response, NextFunction } from 'express';
import { hierarchyService } from '../services/hierarchy.service';
import { successResponse, errorResponse } from '../utils/response';

export class HierarchyController {
  async getTree(req: Request, res: Response, next: NextFunction) {
    try {
      const schoolId = req.query.schoolId as string | undefined;
      const data = await hierarchyService.getHierarchyTree(schoolId, req.user);
      return successResponse(res, data, 'Hierarchy tree fetched successfully');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to fetch hierarchy tree', 500);
    }
  }

  async createMember(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await hierarchyService.createMember(req.body, req.user);
      return successResponse(res, result, 'Member added to hierarchy successfully', 201);
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to create hierarchy member', 400);
    }
  }

  async updateMember(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { type } = req.query as { type: string };
      const updated = await hierarchyService.updateMember(id, type || 'STAFF', req.body, req.user);
      return successResponse(res, updated, 'Member updated successfully');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to update hierarchy member', 400);
    }
  }

  async deleteMember(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { type } = req.query as { type: string };
      await hierarchyService.deleteMember(id, type || 'STAFF');
      return successResponse(res, null, 'Member removed from hierarchy');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to delete hierarchy member', 400);
    }
  }
}

export const hierarchyController = new HierarchyController();
