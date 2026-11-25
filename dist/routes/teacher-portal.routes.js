"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const teacher_portal_controller_1 = require("../controllers/teacher-portal.controller");
const auth_1 = require("../middlewares/auth");
const tenant_1 = require("../middlewares/tenant");
const rbac_1 = require("../middlewares/rbac");
const client_1 = require("@prisma/client");
const router = (0, express_1.Router)();
// Teachers, Head Masters, and School Admins can access Teacher routes
router.use(auth_1.authenticate, tenant_1.enforceTenantContext, (0, rbac_1.requireSchoolRole)(client_1.SchoolRole.TEACHER, client_1.SchoolRole.HEAD_MASTER, client_1.SchoolRole.SCHOOL_ADMIN));
router.get('/dashboard', (req, res) => teacher_portal_controller_1.teacherPortalController.getDashboard(req, res));
router.get('/assigned', (req, res) => teacher_portal_controller_1.teacherPortalController.getAssignedClasses(req, res));
// Attendance
router.get('/attendance/session', (req, res) => teacher_portal_controller_1.teacherPortalController.getAttendanceSession(req, res));
router.post('/attendance/mark', (req, res) => teacher_portal_controller_1.teacherPortalController.markAttendance(req, res));
// Marks
router.get('/marks/exam-subjects', (req, res) => teacher_portal_controller_1.teacherPortalController.getExamSubjects(req, res));
router.get('/marks/sheet/:examSubjectId', (req, res) => teacher_portal_controller_1.teacherPortalController.getMarksSheet(req, res));
router.post('/marks/save', (req, res) => teacher_portal_controller_1.teacherPortalController.saveMarks(req, res));
// Timetable
router.get('/timetable', (req, res) => teacher_portal_controller_1.teacherPortalController.getTimetable(req, res));
// Homework
router.get('/homework', (req, res) => teacher_portal_controller_1.teacherPortalController.getHomework(req, res));
router.post('/homework', (req, res) => teacher_portal_controller_1.teacherPortalController.createHomework(req, res));
// Leaves
router.get('/leaves', (req, res) => teacher_portal_controller_1.teacherPortalController.getLeaves(req, res));
router.post('/leaves', (req, res) => teacher_portal_controller_1.teacherPortalController.applyLeave(req, res));
exports.default = router;
