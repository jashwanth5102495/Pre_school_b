import { Request, Response } from 'express';
import { headMasterService } from '../services/head-master.service';
import { successResponse, errorResponse } from '../utils/response';
import { LeaveStatus, MarksStatus } from '@prisma/client';

export class HeadMasterController {
  async getDashboard(req: Request, res: Response) {
    try {
      const data = await headMasterService.getDashboard(req.tenantId!);
      return successResponse(res, data, 'Head master dashboard metrics retrieved successfully');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to retrieve dashboard', 500);
    }
  }

  async getLeaveApplications(req: Request, res: Response) {
    try {
      const status = req.query.status as LeaveStatus;
      const leaves = await headMasterService.getLeaveApplications(req.tenantId!, status);
      return successResponse(res, leaves, 'Leave applications retrieved successfully');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to retrieve leave applications', 500);
    }
  }

  async reviewLeave(req: Request, res: Response) {
    try {
      const leaveId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const updated = await headMasterService.reviewLeaveApplication(
        req.tenantId!,
        leaveId,
        req.user!.userId,
        req.body
      );
      return successResponse(res, updated, 'Leave application reviewed successfully');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to review leave application', 400);
    }
  }

  async getClassesAndSections(req: Request, res: Response) {
    try {
      const data = await headMasterService.getClassesAndSections(req.tenantId!);
      return successResponse(res, data, 'Classes and sections retrieved successfully');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to retrieve classes', 500);
    }
  }

  async createClass(req: Request, res: Response) {
    try {
      const created = await headMasterService.createClass(req.tenantId!, req.body);
      return successResponse(res, created, 'Class created successfully', 201);
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to create class', 400);
    }
  }

  async createSection(req: Request, res: Response) {
    try {
      const created = await headMasterService.createSection(req.tenantId!, req.body);
      return successResponse(res, created, 'Section created successfully', 201);
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to create section', 400);
    }
  }

  async getAllocations(req: Request, res: Response) {
    try {
      const data = await headMasterService.getAllocations(req.tenantId!);
      return successResponse(res, data, 'Allocations retrieved successfully');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to retrieve allocations', 500);
    }
  }

  async createAllocation(req: Request, res: Response) {
    try {
      const created = await headMasterService.createAllocation(req.tenantId!, req.body);
      return successResponse(res, created, 'Teacher allocation assigned successfully', 201);
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to assign teacher allocation', 400);
    }
  }

  async deleteAllocation(req: Request, res: Response) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      await headMasterService.deleteAllocation(req.tenantId!, id);
      return successResponse(res, null, 'Teacher allocation removed successfully');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to remove allocation', 400);
    }
  }

  async getTimetable(req: Request, res: Response) {
    try {
      const data = await headMasterService.getTimetable(req.tenantId!, req.query);
      return successResponse(res, data, 'Timetable retrieved successfully');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to retrieve timetable', 500);
    }
  }

  async createTimetablePeriod(req: Request, res: Response) {
    try {
      const created = await headMasterService.createTimetablePeriod(req.tenantId!, req.body);
      return successResponse(res, created, 'Timetable period scheduled successfully', 201);
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to schedule timetable period', 400);
    }
  }

  async deleteTimetablePeriod(req: Request, res: Response) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      await headMasterService.deleteTimetablePeriod(req.tenantId!, id);
      return successResponse(res, null, 'Timetable period deleted successfully');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to delete period', 400);
    }
  }

  async getAttendanceSupervision(req: Request, res: Response) {
    try {
      const date = req.query.date as string;
      const data = await headMasterService.getAttendanceSupervision(req.tenantId!, date);
      return successResponse(res, data, 'Attendance supervision summary retrieved successfully');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to retrieve attendance supervision', 500);
    }
  }

  async getMarksSubmissions(req: Request, res: Response) {
    try {
      const status = req.query.status as MarksStatus;
      const submissions = await headMasterService.getMarksSubmissions(req.tenantId!, status);
      return successResponse(res, submissions, 'Marks submissions retrieved successfully');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to retrieve marks submissions', 500);
    }
  }

  async getSubmissionDetails(req: Request, res: Response) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const details = await headMasterService.getSubmissionDetails(req.tenantId!, id);
      return successResponse(res, details, 'Marks submission details retrieved successfully');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to retrieve submission details', 404);
    }
  }

  async reviewMarksSubmission(req: Request, res: Response) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const updated = await headMasterService.reviewMarksSubmission(
        req.tenantId!,
        id,
        req.user!.userId,
        req.body
      );
      return successResponse(res, updated, 'Marks submission moderated successfully');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to moderate marks submission', 400);
    }
  }
}

export const headMasterController = new HeadMasterController();
