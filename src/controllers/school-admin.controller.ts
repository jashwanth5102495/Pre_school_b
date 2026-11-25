import { Request, Response } from 'express';
import { schoolAdminService } from '../services/school-admin.service';
import { successResponse, errorResponse } from '../utils/response';

export class SchoolAdminController {
  async getDashboard(req: Request, res: Response) {
    try {
      const data = await schoolAdminService.getDashboardMetrics(req.tenantId!);
      return successResponse(res, data, 'School dashboard metrics fetched successfully');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to fetch dashboard metrics', 500);
    }
  }

  async getStudents(req: Request, res: Response) {
    try {
      const page = req.query.page ? parseInt(req.query.page as string) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
      const search = req.query.search as string;
      const classId = req.query.classId as string;
      const sectionId = req.query.sectionId as string;
      const status = req.query.status as string;

      const result = await schoolAdminService.getStudents(req.tenantId!, {
        page,
        limit,
        search,
        classId,
        sectionId,
        status,
      });

      return successResponse(res, result.students, 'Students retrieved successfully', 200, result.meta);
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to retrieve students', 500);
    }
  }

  async getStudentById(req: Request, res: Response) {
    try {
      const studentId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const student = await schoolAdminService.getStudentById(req.tenantId!, studentId);
      return successResponse(res, student, 'Student profile fetched successfully');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to fetch student profile', 404);
    }
  }

  async createStudent(req: Request, res: Response) {
    try {
      const student = await schoolAdminService.createStudent(req.tenantId!, req.body);
      return successResponse(res, student, 'Student enrolled successfully', 201);
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to enroll student', 400);
    }
  }

  async updateStudent(req: Request, res: Response) {
    try {
      const studentId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const student = await schoolAdminService.updateStudent(req.tenantId!, studentId, req.body);
      return successResponse(res, student, 'Student updated successfully');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to update student', 400);
    }
  }

  async getStaff(req: Request, res: Response) {
    try {
      const staff = await schoolAdminService.getStaff(req.tenantId!);
      return successResponse(res, staff, 'Staff retrieved successfully');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to retrieve staff', 500);
    }
  }

  async createStaff(req: Request, res: Response) {
    try {
      const user = await schoolAdminService.createStaff(req.tenantId!, req.body);
      return successResponse(res, user, 'Staff member created successfully', 201);
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to create staff member', 400);
    }
  }

  async getClasses(req: Request, res: Response) {
    try {
      const classes = await schoolAdminService.getClasses(req.tenantId!);
      return successResponse(res, classes, 'Classes retrieved successfully');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to retrieve classes', 500);
    }
  }

  async getFeesOverview(req: Request, res: Response) {
    try {
      const fees = await schoolAdminService.getFeesOverview(req.tenantId!);
      return successResponse(res, fees, 'Fee overview fetched successfully');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to fetch fee overview', 500);
    }
  }

  async getAttendanceOverview(req: Request, res: Response) {
    try {
      const date = req.query.date as string;
      const data = await schoolAdminService.getAttendanceOverview(req.tenantId!, date);
      return successResponse(res, data, 'Attendance overview fetched successfully');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to fetch attendance overview', 500);
    }
  }

  async getProfile(req: Request, res: Response) {
    try {
      const profile = await schoolAdminService.getSchoolProfile(req.tenantId!);
      return successResponse(res, profile, 'School profile fetched successfully');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to fetch profile', 500);
    }
  }

  async updateProfile(req: Request, res: Response) {
    try {
      const profile = await schoolAdminService.updateSchoolProfile(req.tenantId!, req.body);
      return successResponse(res, profile, 'School profile updated successfully');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to update profile', 400);
    }
  }
}

export const schoolAdminController = new SchoolAdminController();
