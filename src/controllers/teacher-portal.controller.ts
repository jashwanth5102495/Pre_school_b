import { Request, Response } from 'express';
import { teacherPortalService } from '../services/teacher-portal.service';
import { successResponse, errorResponse } from '../utils/response';

export class TeacherPortalController {
  private async getTeacherId(req: Request) {
    const teacher = await teacherPortalService.getTeacherByUserId(
      req.tenantId!,
      req.user!.userId,
      req.user!.email
    );
    return teacher.id;
  }

  async getDashboard(req: Request, res: Response) {
    try {
      const teacherId = await this.getTeacherId(req);
      const data = await teacherPortalService.getDashboard(req.tenantId!, teacherId);
      return successResponse(res, data, 'Teacher dashboard metrics retrieved successfully');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to retrieve teacher dashboard', 500);
    }
  }

  async getAssignedClasses(req: Request, res: Response) {
    try {
      const teacherId = await this.getTeacherId(req);
      const classes = await teacherPortalService.getAssignedClasses(req.tenantId!, teacherId);
      return successResponse(res, classes, 'Assigned classes retrieved successfully');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to retrieve assigned classes', 500);
    }
  }

  async getAttendanceSession(req: Request, res: Response) {
    try {
      const teacherId = await this.getTeacherId(req);
      const classId = req.query.classId as string;
      let sectionId = req.query.sectionId as string;
      const date = req.query.date as string;

      if (!classId) {
        return errorResponse(res, 'classId is required', 400);
      }

      // Auto-resolve sectionId if missing or invalid
      if (!sectionId || sectionId === 'null' || sectionId === 'undefined' || sectionId === '') {
        const sec = await teacherPortalService.getDefaultSectionForClass(req.tenantId!, classId);
        sectionId = sec?.id || '';
      }

      const session = await teacherPortalService.getAttendanceSession(req.tenantId!, teacherId, {
        classId,
        sectionId,
        date,
      });
      return successResponse(res, session, 'Attendance roster retrieved successfully');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to retrieve attendance roster', 500);
    }
  }

  async markAttendance(req: Request, res: Response) {
    try {
      const teacherId = await this.getTeacherId(req);
      const body = { ...req.body };
      if (!body.sectionId && body.classId) {
        const sec = await teacherPortalService.getDefaultSectionForClass(req.tenantId!, body.classId);
        body.sectionId = sec?.id || '';
      }
      const result = await teacherPortalService.markAttendance(req.tenantId!, teacherId, body);
      return successResponse(res, result, 'Attendance marked successfully', 201);
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to mark attendance', 400);
    }
  }

  async getExamSubjects(req: Request, res: Response) {
    try {
      const teacherId = await this.getTeacherId(req);
      const subjects = await teacherPortalService.getExamSubjectsForTeacher(req.tenantId!, teacherId);
      return successResponse(res, subjects, 'Examination subjects retrieved successfully');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to retrieve exam subjects', 500);
    }
  }

  async getMarksSheet(req: Request, res: Response) {
    try {
      const teacherId = await this.getTeacherId(req);
      const examSubjectId = Array.isArray(req.params.examSubjectId)
        ? req.params.examSubjectId[0]
        : req.params.examSubjectId;
      const sheet = await teacherPortalService.getMarksSheet(req.tenantId!, teacherId, examSubjectId);
      return successResponse(res, sheet, 'Marks entry sheet retrieved successfully');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to retrieve marks sheet', 500);
    }
  }

  async saveMarks(req: Request, res: Response) {
    try {
      const teacherId = await this.getTeacherId(req);
      const result = await teacherPortalService.saveMarks(req.tenantId!, teacherId, req.body);
      return successResponse(res, result, 'Marks saved successfully');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to save marks', 400);
    }
  }

  async getTimetable(req: Request, res: Response) {
    try {
      const teacherId = await this.getTeacherId(req);
      const timetable = await teacherPortalService.getTimetable(req.tenantId!, teacherId);
      return successResponse(res, timetable, 'Teacher timetable retrieved successfully');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to retrieve timetable', 500);
    }
  }

  async getHomework(req: Request, res: Response) {
    try {
      const teacherId = await this.getTeacherId(req);
      const homework = await teacherPortalService.getHomework(req.tenantId!, teacherId);
      return successResponse(res, homework, 'Homework assignments retrieved successfully');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to retrieve homework', 500);
    }
  }

  async createHomework(req: Request, res: Response) {
    try {
      const teacherId = await this.getTeacherId(req);
      const created = await teacherPortalService.createHomework(req.tenantId!, teacherId, req.body);
      return successResponse(res, created, 'Homework assignment created successfully', 201);
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to create homework', 400);
    }
  }

  async getLeaves(req: Request, res: Response) {
    try {
      const teacherId = await this.getTeacherId(req);
      const data = await teacherPortalService.getMyLeaves(req.tenantId!, teacherId);
      return successResponse(res, data, 'Teacher leaves and balances retrieved successfully');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to retrieve leaves', 500);
    }
  }

  async applyLeave(req: Request, res: Response) {
    try {
      const teacherId = await this.getTeacherId(req);
      const applied = await teacherPortalService.applyLeave(req.tenantId!, teacherId, req.body);
      return successResponse(res, applied, 'Leave application submitted successfully', 201);
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to submit leave application', 400);
    }
  }
}

export const teacherPortalController = new TeacherPortalController();
