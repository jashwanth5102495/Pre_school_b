"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const office_admin_controller_1 = require("../controllers/office-admin.controller");
const auth_1 = require("../middlewares/auth");
const tenant_1 = require("../middlewares/tenant");
const rbac_1 = require("../middlewares/rbac");
const client_1 = require("@prisma/client");
const upload_middleware_1 = require("../middlewares/upload.middleware");
const router = (0, express_1.Router)();
// Office Admin and School Admin have access to office endpoints
router.use(auth_1.authenticate, tenant_1.enforceTenantContext, (0, rbac_1.requireSchoolRole)(client_1.SchoolRole.OFFICE_ADMIN, client_1.SchoolRole.SCHOOL_ADMIN));
router.get('/dashboard', (req, res) => office_admin_controller_1.officeAdminController.getDashboard(req, res));
// Admissions
router.get('/admissions', (req, res) => office_admin_controller_1.officeAdminController.getAdmissions(req, res));
router.post('/admissions', (req, res) => office_admin_controller_1.officeAdminController.createAdmission(req, res));
router.put('/admissions/:id/status', (req, res) => office_admin_controller_1.officeAdminController.updateAdmissionStatus(req, res));
router.post('/admissions/:id/enroll', (req, res) => office_admin_controller_1.officeAdminController.enrollStudent(req, res));
// Fees
router.get('/fees/structures', (req, res) => office_admin_controller_1.officeAdminController.getFeeStructures(req, res));
router.post('/fees/structures', (req, res) => office_admin_controller_1.officeAdminController.createFeeStructure(req, res));
router.get('/fees/students', (req, res) => office_admin_controller_1.officeAdminController.getStudentFees(req, res));
router.post('/fees/collect', (req, res) => office_admin_controller_1.officeAdminController.collectFee(req, res));
router.get('/fees/receipts/:receiptNumber', (req, res) => office_admin_controller_1.officeAdminController.getReceipt(req, res));
// Documents (S3 Storage)
router.get('/documents', (req, res) => office_admin_controller_1.officeAdminController.getDocuments(req, res));
router.post('/documents', (req, res) => office_admin_controller_1.officeAdminController.uploadDocument(req, res));
router.post('/documents/upload', upload_middleware_1.uploadDocumentMiddleware.single('file'), (req, res) => office_admin_controller_1.officeAdminController.uploadDocumentFile(req, res));
router.get('/documents/:id/view-url', (req, res) => office_admin_controller_1.officeAdminController.getDocumentViewUrl(req, res));
router.put('/documents/:id/verify', (req, res) => office_admin_controller_1.officeAdminController.verifyDocument(req, res));
router.delete('/documents/:id', (req, res) => office_admin_controller_1.officeAdminController.deleteDocument(req, res));
// Certificates
router.get('/certificates', (req, res) => office_admin_controller_1.officeAdminController.getCertificates(req, res));
router.post('/certificates', (req, res) => office_admin_controller_1.officeAdminController.generateCertificate(req, res));
exports.default = router;
