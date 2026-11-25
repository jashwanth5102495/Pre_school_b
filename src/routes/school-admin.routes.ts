import { Router } from 'express';
import { schoolAdminController } from '../controllers/school-admin.controller';
import { authenticate } from '../middlewares/auth';
import { enforceTenantContext } from '../middlewares/tenant';
import { requireSchoolRole } from '../middlewares/rbac';
import { SchoolRole } from '@prisma/client';

const router = Router();

// Protect all school admin routes with Auth, Tenant isolation, and School Admin role
router.use(authenticate, enforceTenantContext, requireSchoolRole(SchoolRole.SCHOOL_ADMIN));

router.get('/dashboard', (req, res) => schoolAdminController.getDashboard(req, res));
router.get('/students', (req, res) => schoolAdminController.getStudents(req, res));
router.post('/students', (req, res) => schoolAdminController.createStudent(req, res));
router.get('/students/:id', (req, res) => schoolAdminController.getStudentById(req, res));
router.put('/students/:id', (req, res) => schoolAdminController.updateStudent(req, res));

router.get('/staff', (req, res) => schoolAdminController.getStaff(req, res));
router.post('/staff', (req, res) => schoolAdminController.createStaff(req, res));

router.get('/classes', (req, res) => schoolAdminController.getClasses(req, res));
router.get('/fees/overview', (req, res) => schoolAdminController.getFeesOverview(req, res));
router.get('/attendance/overview', (req, res) => schoolAdminController.getAttendanceOverview(req, res));

router.get('/profile', (req, res) => schoolAdminController.getProfile(req, res));
router.put('/profile', (req, res) => schoolAdminController.updateProfile(req, res));

export default router;
