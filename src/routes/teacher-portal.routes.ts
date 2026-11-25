import { Router } from 'express';
import { teacherPortalController } from '../controllers/teacher-portal.controller';
import { authenticate } from '../middlewares/auth';
import { enforceTenantContext } from '../middlewares/tenant';
import { requireSchoolRole } from '../middlewares/rbac';
import { SchoolRole } from '@prisma/client';

const router = Router();

// Teachers, Head Masters, and School Admins can access Teacher routes
router.use(
  authenticate,
  enforceTenantContext,
  requireSchoolRole(SchoolRole.TEACHER, SchoolRole.HEAD_MASTER, SchoolRole.SCHOOL_ADMIN)
);

router.get('/dashboard', (req, res) => teacherPortalController.getDashboard(req, res));
router.get('/assigned', (req, res) => teacherPortalController.getAssignedClasses(req, res));

// Attendance
router.get('/attendance/session', (req, res) => teacherPortalController.getAttendanceSession(req, res));
router.post('/attendance/mark', (req, res) => teacherPortalController.markAttendance(req, res));

// Marks
router.get('/marks/exam-subjects', (req, res) => teacherPortalController.getExamSubjects(req, res));
router.get('/marks/sheet/:examSubjectId', (req, res) => teacherPortalController.getMarksSheet(req, res));
router.post('/marks/save', (req, res) => teacherPortalController.saveMarks(req, res));

// Timetable
router.get('/timetable', (req, res) => teacherPortalController.getTimetable(req, res));

// Homework
router.get('/homework', (req, res) => teacherPortalController.getHomework(req, res));
router.post('/homework', (req, res) => teacherPortalController.createHomework(req, res));

// Leaves
router.get('/leaves', (req, res) => teacherPortalController.getLeaves(req, res));
router.post('/leaves', (req, res) => teacherPortalController.applyLeave(req, res));

export default router;
