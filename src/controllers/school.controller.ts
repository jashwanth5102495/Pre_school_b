import { Request, Response, NextFunction } from 'express';
import { schoolService } from '../services/school.service';
import { successResponse, paginatedResponse, errorResponse } from '../utils/response';
import { createSchoolSchema, updateSchoolSchema, updateSchoolStatusSchema } from '../validators/school.validator';

export class SchoolController {
  async listSchools(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 10;
      const search = (req.query.search as string) || undefined;
      const status = (req.query.status as any) || undefined;
      const planId = (req.query.planId as string) || undefined;
      const sortBy = (req.query.sortBy as any) || 'createdAt';
      const sortOrder = (req.query.sortOrder as any) || 'desc';

      const result = await schoolService.listSchools({
        page,
        limit,
        search,
        status,
        planId,
        sortBy,
        sortOrder,
      });

      return paginatedResponse(res, result.schools, result.total, page, limit);
    } catch (err) {
      next(err);
    }
  }

  async getSchoolById(req: Request, res: Response, next: NextFunction) {
    try {
      const schoolId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const school = await schoolService.getSchoolById(schoolId);
      return successResponse(res, school);
    } catch (err: any) {
      return errorResponse(res, err.message, 404, 'SCHOOL_NOT_FOUND');
    }
  }

  async provisionSchool(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = createSchoolSchema.parse(req.body);
      const actorId = req.user!.userId;
      const actorEmail = req.user!.email;

      const result = await schoolService.provisionSchool(validated, actorId, actorEmail);
      return successResponse(res, result, 'School provisioned and activated successfully', 201);
    } catch (err: any) {
      if (err.name === 'ZodError') return next(err);
      return errorResponse(res, err.message, 400, 'PROVISIONING_FAILED');
    }
  }

  async updateSchool(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = updateSchoolSchema.parse(req.body);
      const actorId = req.user!.userId;
      const actorEmail = req.user!.email;
      const schoolId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

      const updated = await schoolService.updateSchool(schoolId, validated, actorId, actorEmail);
      return successResponse(res, updated, 'School updated successfully');
    } catch (err: any) {
      if (err.name === 'ZodError') return next(err);
      return errorResponse(res, err.message, 400, 'UPDATE_FAILED');
    }
  }

  async updateSchoolStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = updateSchoolStatusSchema.parse(req.body);
      const actorId = req.user!.userId;
      const actorEmail = req.user!.email;
      const schoolId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

      const updated = await schoolService.updateSchoolStatus(
        schoolId,
        validated.status,
        validated.reason,
        actorId,
        actorEmail
      );
      return successResponse(res, updated, `School status updated to ${validated.status}`);
    } catch (err: any) {
      if (err.name === 'ZodError') return next(err);
      return errorResponse(res, err.message, 400, 'STATUS_UPDATE_FAILED');
    }
  }

  async resendInvitation(req: Request, res: Response, next: NextFunction) {
    try {
      const actorId = req.user!.userId;
      const actorEmail = req.user!.email;
      const schoolId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const result = await schoolService.resendInvitation(schoolId, actorId, actorEmail);
      return successResponse(res, result, 'School admin invitation regenerated and sent');
    } catch (err: any) {
      return errorResponse(res, err.message, 400, 'INVITATION_FAILED');
    }
  }

  async archiveSchool(req: Request, res: Response, next: NextFunction) {
    try {
      const actorId = req.user!.userId;
      const actorEmail = req.user!.email;
      const schoolId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const result = await schoolService.archiveSchool(schoolId, actorId, actorEmail);
      return successResponse(res, result, 'School successfully archived');
    } catch (err: any) {
      return errorResponse(res, err.message, 400, 'ARCHIVE_FAILED');
    }
  }
}

export const schoolController = new SchoolController();
