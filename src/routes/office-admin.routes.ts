import { Router } from 'express';
import { officeAdminController } from '../controllers/office-admin.controller';
import { authenticate } from '../middlewares/auth';
import { enforceTenantContext } from '../middlewares/tenant';
import { requireSchoolRole } from '../middlewares/rbac';
import { SchoolRole } from '@prisma/client';
import { uploadDocumentMiddleware } from '../middlewares/upload.middleware';

const router = Router();

// Office Admin and School Admin have access to office endpoints
router.use(
  authenticate,
  enforceTenantContext,
  requireSchoolRole(SchoolRole.OFFICE_ADMIN, SchoolRole.SCHOOL_ADMIN)
);

router.get('/dashboard', (req, res) => officeAdminController.getDashboard(req, res));

// Admissions
router.get('/admissions', (req, res) => officeAdminController.getAdmissions(req, res));
router.post('/admissions', (req, res) => officeAdminController.createAdmission(req, res));
router.put('/admissions/:id/status', (req, res) => officeAdminController.updateAdmissionStatus(req, res));
router.post('/admissions/:id/enroll', (req, res) => officeAdminController.enrollStudent(req, res));

// Fees
router.get('/fees/structures', (req, res) => officeAdminController.getFeeStructures(req, res));
router.post('/fees/structures', (req, res) => officeAdminController.createFeeStructure(req, res));
router.get('/fees/students', (req, res) => officeAdminController.getStudentFees(req, res));
router.post('/fees/collect', (req, res) => officeAdminController.collectFee(req, res));
router.get('/fees/receipts/:receiptNumber', (req, res) => officeAdminController.getReceipt(req, res));

// Documents (S3 Storage)
router.get('/documents', (req, res) => officeAdminController.getDocuments(req, res));
router.post('/documents', (req, res) => officeAdminController.uploadDocument(req, res));
router.post('/documents/upload', uploadDocumentMiddleware.single('file'), (req, res) =>
  officeAdminController.uploadDocumentFile(req, res)
);
router.get('/documents/:id/view-url', (req, res) => officeAdminController.getDocumentViewUrl(req, res));
router.put('/documents/:id/verify', (req, res) => officeAdminController.verifyDocument(req, res));
router.delete('/documents/:id', (req, res) => officeAdminController.deleteDocument(req, res));

// Certificates
router.get('/certificates', (req, res) => officeAdminController.getCertificates(req, res));
router.post('/certificates', (req, res) => officeAdminController.generateCertificate(req, res));

export default router;
