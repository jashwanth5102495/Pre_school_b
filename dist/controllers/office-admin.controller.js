"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.officeAdminController = exports.OfficeAdminController = void 0;
const office_admin_service_1 = require("../services/office-admin.service");
const response_1 = require("../utils/response");
class OfficeAdminController {
    async getDashboard(req, res) {
        try {
            const data = await office_admin_service_1.officeAdminService.getDashboard(req.tenantId);
            return (0, response_1.successResponse)(res, data, 'Office dashboard metrics retrieved successfully');
        }
        catch (error) {
            return (0, response_1.errorResponse)(res, error.message || 'Failed to retrieve dashboard metrics', 500);
        }
    }
    // Admissions
    async getAdmissions(req, res) {
        try {
            const status = req.query.status;
            const search = req.query.search;
            const admissions = await office_admin_service_1.officeAdminService.getAdmissions(req.tenantId, { status, search });
            return (0, response_1.successResponse)(res, admissions, 'Admissions retrieved successfully');
        }
        catch (error) {
            return (0, response_1.errorResponse)(res, error.message || 'Failed to retrieve admissions', 500);
        }
    }
    async createAdmission(req, res) {
        try {
            const admission = await office_admin_service_1.officeAdminService.createAdmission(req.tenantId, req.body);
            return (0, response_1.successResponse)(res, admission, 'Admission application registered successfully', 201);
        }
        catch (error) {
            return (0, response_1.errorResponse)(res, error.message || 'Failed to create admission', 400);
        }
    }
    async updateAdmissionStatus(req, res) {
        try {
            const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const updated = await office_admin_service_1.officeAdminService.updateAdmissionStatus(req.tenantId, id, req.user.userId, req.body);
            return (0, response_1.successResponse)(res, updated, 'Admission application updated successfully');
        }
        catch (error) {
            return (0, response_1.errorResponse)(res, error.message || 'Failed to update admission status', 400);
        }
    }
    async enrollStudent(req, res) {
        try {
            const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const student = await office_admin_service_1.officeAdminService.enrollStudent(req.tenantId, id, req.body);
            return (0, response_1.successResponse)(res, student, 'Student officially enrolled into school roster', 201);
        }
        catch (error) {
            return (0, response_1.errorResponse)(res, error.message || 'Failed to enroll student', 400);
        }
    }
    // Fees
    async getFeeStructures(req, res) {
        try {
            const data = await office_admin_service_1.officeAdminService.getFeeStructures(req.tenantId);
            return (0, response_1.successResponse)(res, data, 'Fee structures retrieved successfully');
        }
        catch (error) {
            return (0, response_1.errorResponse)(res, error.message || 'Failed to retrieve fee structures', 500);
        }
    }
    async createFeeStructure(req, res) {
        try {
            const structure = await office_admin_service_1.officeAdminService.createFeeStructure(req.tenantId, req.body);
            return (0, response_1.successResponse)(res, structure, 'Fee structure created successfully', 201);
        }
        catch (error) {
            return (0, response_1.errorResponse)(res, error.message || 'Failed to create fee structure', 400);
        }
    }
    async getStudentFees(req, res) {
        try {
            const classId = req.query.classId;
            const status = req.query.status;
            const isDefaulter = req.query.isDefaulter === 'true';
            const search = req.query.search;
            const data = await office_admin_service_1.officeAdminService.getStudentFees(req.tenantId, {
                classId,
                status,
                isDefaulter,
                search,
            });
            return (0, response_1.successResponse)(res, data, 'Student fee records retrieved successfully');
        }
        catch (error) {
            return (0, response_1.errorResponse)(res, error.message || 'Failed to retrieve student fees', 500);
        }
    }
    async collectFee(req, res) {
        try {
            const result = await office_admin_service_1.officeAdminService.collectFee(req.tenantId, req.user.userId, req.body);
            return (0, response_1.successResponse)(res, result, 'Fee payment collected successfully', 201);
        }
        catch (error) {
            return (0, response_1.errorResponse)(res, error.message || 'Failed to record fee payment', 400);
        }
    }
    async getReceipt(req, res) {
        try {
            const receiptNumber = Array.isArray(req.params.receiptNumber) ? req.params.receiptNumber[0] : req.params.receiptNumber;
            const receipt = await office_admin_service_1.officeAdminService.getReceipt(req.tenantId, receiptNumber);
            return (0, response_1.successResponse)(res, receipt, 'Receipt retrieved successfully');
        }
        catch (error) {
            return (0, response_1.errorResponse)(res, error.message || 'Receipt not found', 404);
        }
    }
    // Documents
    async getDocuments(req, res) {
        try {
            const status = req.query.status;
            const studentId = req.query.studentId;
            const docs = await office_admin_service_1.officeAdminService.getDocuments(req.tenantId, { status, studentId });
            return (0, response_1.successResponse)(res, docs, 'Documents retrieved successfully');
        }
        catch (error) {
            return (0, response_1.errorResponse)(res, error.message || 'Failed to retrieve documents', 500);
        }
    }
    async verifyDocument(req, res) {
        try {
            const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const doc = await office_admin_service_1.officeAdminService.verifyDocument(req.tenantId, id, req.user.userId, req.body);
            return (0, response_1.successResponse)(res, doc, 'Document status updated successfully');
        }
        catch (error) {
            return (0, response_1.errorResponse)(res, error.message || 'Failed to verify document', 400);
        }
    }
    async uploadDocument(req, res) {
        try {
            const doc = await office_admin_service_1.officeAdminService.uploadDocument(req.tenantId, req.body);
            return (0, response_1.successResponse)(res, doc, 'Document uploaded successfully', 201);
        }
        catch (error) {
            return (0, response_1.errorResponse)(res, error.message || 'Failed to upload document', 400);
        }
    }
    async uploadDocumentFile(req, res) {
        try {
            if (!req.file) {
                return (0, response_1.errorResponse)(res, 'No document file provided for upload', 400);
            }
            const { studentId, documentType, documentName, remarks } = req.body;
            if (!studentId || !documentType) {
                return (0, response_1.errorResponse)(res, 'studentId and documentType are required fields', 400);
            }
            const doc = await office_admin_service_1.officeAdminService.uploadDocumentFile(req.tenantId, {
                studentId,
                documentType,
                documentName,
                remarks,
                file: req.file,
            });
            return (0, response_1.successResponse)(res, doc, 'Student document uploaded to S3 successfully', 201);
        }
        catch (error) {
            return (0, response_1.errorResponse)(res, error.message || 'Failed to upload document file to S3', 400);
        }
    }
    async getDocumentViewUrl(req, res) {
        try {
            const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const data = await office_admin_service_1.officeAdminService.getDocumentViewUrl(req.tenantId, id);
            return (0, response_1.successResponse)(res, data, 'Document view URL generated successfully');
        }
        catch (error) {
            return (0, response_1.errorResponse)(res, error.message || 'Failed to generate document view URL', 400);
        }
    }
    async deleteDocument(req, res) {
        try {
            const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            await office_admin_service_1.officeAdminService.deleteDocument(req.tenantId, id);
            return (0, response_1.successResponse)(res, null, 'Document deleted successfully');
        }
        catch (error) {
            return (0, response_1.errorResponse)(res, error.message || 'Failed to delete document', 400);
        }
    }
    // Certificates
    async getCertificates(req, res) {
        try {
            const certs = await office_admin_service_1.officeAdminService.getCertificates(req.tenantId);
            return (0, response_1.successResponse)(res, certs, 'Certificates retrieved successfully');
        }
        catch (error) {
            return (0, response_1.errorResponse)(res, error.message || 'Failed to retrieve certificates', 500);
        }
    }
    async generateCertificate(req, res) {
        try {
            const cert = await office_admin_service_1.officeAdminService.generateCertificate(req.tenantId, req.user.userId, req.body);
            return (0, response_1.successResponse)(res, cert, 'Certificate generated successfully', 201);
        }
        catch (error) {
            return (0, response_1.errorResponse)(res, error.message || 'Failed to generate certificate', 400);
        }
    }
}
exports.OfficeAdminController = OfficeAdminController;
exports.officeAdminController = new OfficeAdminController();
