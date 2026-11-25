"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const head_master_controller_1 = require("../controllers/head-master.controller");
const auth_1 = require("../middlewares/auth");
const tenant_1 = require("../middlewares/tenant");
const rbac_1 = require("../middlewares/rbac");
const client_1 = require("@prisma/client");
const router = (0, express_1.Router)();
// Head Master & School Admin can access Head Master routes
router.use(auth_1.authenticate, tenant_1.enforceTenantContext, (0, rbac_1.requireSchoolRole)(client_1.SchoolRole.HEAD_MASTER, client_1.SchoolRole.SCHOOL_ADMIN));
router.get('/dashboard', (req, res) => head_master_controller_1.headMasterController.getDashboard(req, res));
// Leaves
router.get('/leaves', (req, res) => head_master_controller_1.headMasterController.getLeaveApplications(req, res));
router.put('/leaves/:id', (req, res) => head_master_controller_1.headMasterController.reviewLeave(req, res));
// Classes & Sections
router.get('/classes', (req, res) => head_master_controller_1.headMasterController.getClassesAndSections(req, res));
router.post('/classes', (req, res) => head_master_controller_1.headMasterController.createClass(req, res));
router.post('/sections', (req, res) => head_master_controller_1.headMasterController.createSection(req, res));
// Teacher Allocations
router.get('/allocations', (req, res) => head_master_controller_1.headMasterController.getAllocations(req, res));
router.post('/allocations', (req, res) => head_master_controller_1.headMasterController.createAllocation(req, res));
router.delete('/allocations/:id', (req, res) => head_master_controller_1.headMasterController.deleteAllocation(req, res));
// Timetable
router.get('/timetable', (req, res) => head_master_controller_1.headMasterController.getTimetable(req, res));
router.post('/timetable', (req, res) => head_master_controller_1.headMasterController.createTimetablePeriod(req, res));
router.delete('/timetable/:id', (req, res) => head_master_controller_1.headMasterController.deleteTimetablePeriod(req, res));
// Attendance Supervision
router.get('/attendance', (req, res) => head_master_controller_1.headMasterController.getAttendanceSupervision(req, res));
// Marks Moderation
router.get('/marks-review', (req, res) => head_master_controller_1.headMasterController.getMarksSubmissions(req, res));
router.get('/marks-review/:id', (req, res) => head_master_controller_1.headMasterController.getSubmissionDetails(req, res));
router.put('/marks-review/:id', (req, res) => head_master_controller_1.headMasterController.reviewMarksSubmission(req, res));
exports.default = router;
