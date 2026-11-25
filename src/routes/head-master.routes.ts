import { Router } from 'express';
import { headMasterController } from '../controllers/head-master.controller';
import { authenticate } from '../middlewares/auth';
import { enforceTenantContext } from '../middlewares/tenant';
import { requireSchoolRole } from '../middlewares/rbac';
import { SchoolRole } from '@prisma/client';

const router = Router();

// Head Master, School Admin, and Office Admin can access academic operations
router.use(
  authenticate,
  enforceTenantContext,
  requireSchoolRole(SchoolRole.HEAD_MASTER, SchoolRole.SCHOOL_ADMIN, SchoolRole.OFFICE_ADMIN)
);

router.get('/dashboard', (req, res) => headMasterController.getDashboard(req, res));

// Leaves
router.get('/leaves', (req, res) => headMasterController.getLeaveApplications(req, res));
router.put('/leaves/:id', (req, res) => headMasterController.reviewLeave(req, res));

// Classes & Sections
router.get('/classes', (req, res) => headMasterController.getClassesAndSections(req, res));
router.post('/classes', (req, res) => headMasterController.createClass(req, res));
router.post('/sections', (req, res) => headMasterController.createSection(req, res));

// Teacher Allocations
router.get('/allocations', (req, res) => headMasterController.getAllocations(req, res));
router.post('/allocations', (req, res) => headMasterController.createAllocation(req, res));
router.delete('/allocations/:id', (req, res) => headMasterController.deleteAllocation(req, res));

// Timetable
router.get('/timetable', (req, res) => headMasterController.getTimetable(req, res));
router.post('/timetable', (req, res) => headMasterController.createTimetablePeriod(req, res));
router.delete('/timetable/:id', (req, res) => headMasterController.deleteTimetablePeriod(req, res));

// Attendance Supervision
router.get('/attendance', (req, res) => headMasterController.getAttendanceSupervision(req, res));

// Marks Moderation
router.get('/marks-review', (req, res) => headMasterController.getMarksSubmissions(req, res));
router.get('/marks-review/:id', (req, res) => headMasterController.getSubmissionDetails(req, res));
router.put('/marks-review/:id', (req, res) => headMasterController.reviewMarksSubmission(req, res));

export default router;
