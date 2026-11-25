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
      const id = req.params.id as string;
      const type = (req.query.type as string) || 'STAFF';
      const updated = await hierarchyService.updateMember(id, type, req.body, req.user);
      return successResponse(res, updated, 'Member updated successfully');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to update hierarchy member', 400);
    }
  }

  async deleteMember(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const type = (req.query.type as string) || 'STAFF';
      await hierarchyService.deleteMember(id, type);
      return successResponse(res, null, 'Member removed from hierarchy');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to delete hierarchy member', 400);
    }
  }

  async createClass(req: Request, res: Response, next: NextFunction) {
    try {
      const schoolId = (req.body.schoolId || req.tenantId || (req.user as any)?.schoolId) as string;
      const created = await hierarchyService.createClass(schoolId, req.body, req.user);
      return successResponse(res, created, 'Academic class created in hierarchy', 201);
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to create academic class', 400);
    }
  }

  async createSection(req: Request, res: Response, next: NextFunction) {
    try {
      const schoolId = (req.body.schoolId || req.tenantId || (req.user as any)?.schoolId) as string;
      const created = await hierarchyService.createSection(schoolId, req.body, req.user);
      return successResponse(res, created, 'Section created successfully', 201);
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to create section', 400);
    }
  }

  async deleteClass(req: Request, res: Response, next: NextFunction) {
    try {
      const schoolId = (req.query.schoolId || req.tenantId || (req.user as any)?.schoolId) as string;
      const classId = req.params.id as string;
      await hierarchyService.deleteClass(schoolId, classId);
      return successResponse(res, null, 'Class removed from hierarchy');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to delete class', 400);
    }
  }

  async allocateTeacher(req: Request, res: Response, next: NextFunction) {
    try {
      const schoolId = (req.body.schoolId || req.tenantId || (req.user as any)?.schoolId) as string;
      const allocation = await hierarchyService.allocateTeacher(schoolId, req.body, req.user);
      return successResponse(res, allocation, 'Teacher connected to class successfully', 201);
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to allocate teacher to class', 400);
    }
  }

  async deleteAllocation(req: Request, res: Response, next: NextFunction) {
    try {
      const schoolId = (req.query.schoolId || req.tenantId || (req.user as any)?.schoolId) as string;
      const allocationId = req.params.id as string;
      await hierarchyService.deleteAllocation(schoolId, allocationId);
      return successResponse(res, null, 'Teacher allocation removed');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to remove allocation', 400);
    }
  }

  async addSubjectToClass(req: Request, res: Response, next: NextFunction) {
    try {
      const schoolId = (req.body.schoolId || req.tenantId || (req.user as any)?.schoolId) as string;
      const classId = req.params.id as string;
      const subjectId = req.body.subjectId as string;
      const cs = await hierarchyService.addSubjectToClass(schoolId, classId, subjectId);
      return successResponse(res, cs, 'Subject added to class endpoint', 201);
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to add subject to class', 400);
    }
  }

  async removeSubjectFromClass(req: Request, res: Response, next: NextFunction) {
    try {
      const schoolId = (req.query.schoolId || req.tenantId || (req.user as any)?.schoolId) as string;
      const classId = req.params.id as string;
      const subjectId = req.params.subjectId as string;
      await hierarchyService.removeSubjectFromClass(schoolId, classId, subjectId);
      return successResponse(res, null, 'Subject removed from class');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to remove subject from class', 400);
    }
  }
}

export const hierarchyController = new HierarchyController();
