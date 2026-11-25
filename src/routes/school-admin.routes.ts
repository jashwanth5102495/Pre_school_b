import { Router } from 'express';
import { schoolAdminController } from '../controllers/school-admin.controller';
import { authenticate } from '../middlewares/auth';
import { enforceTenantContext } from '../middlewares/tenant';
import { requireSchoolRole } from '../middlewares/rbac';
import { SchoolRole } from '@prisma/client';

const router = Router();

// Protect all school admin routes with Auth and Tenant isolation
router.use(authenticate, enforceTenantContext);

// Staff management (School Admin, Head Master, Office Admin can create & view faculty)
router.get(
  '/staff',
  requireSchoolRole(SchoolRole.SCHOOL_ADMIN, SchoolRole.HEAD_MASTER, SchoolRole.OFFICE_ADMIN),
  (req, res) => schoolAdminController.getStaff(req, res)
);
router.post(
  '/staff',
  requireSchoolRole(SchoolRole.SCHOOL_ADMIN, SchoolRole.HEAD_MASTER, SchoolRole.OFFICE_ADMIN),
  (req, res) => schoolAdminController.createStaff(req, res)
);

// Students & Classes
router.get(
  '/students',
  requireSchoolRole(SchoolRole.SCHOOL_ADMIN, SchoolRole.HEAD_MASTER, SchoolRole.OFFICE_ADMIN),
  (req, res) => schoolAdminController.getStudents(req, res)
);
router.post(
  '/students',
  requireSchoolRole(SchoolRole.SCHOOL_ADMIN, SchoolRole.HEAD_MASTER, SchoolRole.OFFICE_ADMIN),
  (req, res) => schoolAdminController.createStudent(req, res)
);
router.get(
  '/students/:id',
  requireSchoolRole(SchoolRole.SCHOOL_ADMIN, SchoolRole.HEAD_MASTER, SchoolRole.OFFICE_ADMIN),
  (req, res) => schoolAdminController.getStudentById(req, res)
);
router.put(
  '/students/:id',
  requireSchoolRole(SchoolRole.SCHOOL_ADMIN, SchoolRole.HEAD_MASTER, SchoolRole.OFFICE_ADMIN),
  (req, res) => schoolAdminController.updateStudent(req, res)
);

router.get(
  '/classes',
  requireSchoolRole(SchoolRole.SCHOOL_ADMIN, SchoolRole.HEAD_MASTER, SchoolRole.OFFICE_ADMIN),
  (req, res) => schoolAdminController.getClasses(req, res)
);

// Dashboard & Metrics
router.get('/dashboard', requireSchoolRole(SchoolRole.SCHOOL_ADMIN), (req, res) =>
  schoolAdminController.getDashboard(req, res)
);
router.get(
  '/fees/overview',
  requireSchoolRole(SchoolRole.SCHOOL_ADMIN, SchoolRole.OFFICE_ADMIN),
  (req, res) => schoolAdminController.getFeesOverview(req, res)
);
router.get(
  '/attendance/overview',
  requireSchoolRole(SchoolRole.SCHOOL_ADMIN, SchoolRole.HEAD_MASTER),
  (req, res) => schoolAdminController.getAttendanceOverview(req, res)
);

// School Profile
router.get('/profile', requireSchoolRole(SchoolRole.SCHOOL_ADMIN), (req, res) =>
  schoolAdminController.getProfile(req, res)
);
router.put('/profile', requireSchoolRole(SchoolRole.SCHOOL_ADMIN), (req, res) =>
  schoolAdminController.updateProfile(req, res)
);

export default router;
