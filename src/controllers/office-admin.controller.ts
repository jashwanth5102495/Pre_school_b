import { Request, Response } from 'express';
import { officeAdminService } from '../services/office-admin.service';
import { successResponse, errorResponse } from '../utils/response';
import { AdmissionStatus, DocumentStatus, FeeStatus } from '@prisma/client';

export class OfficeAdminController {
  async getDashboard(req: Request, res: Response) {
    try {
      const data = await officeAdminService.getDashboard(req.tenantId!);
      return successResponse(res, data, 'Office dashboard metrics retrieved successfully');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to retrieve dashboard metrics', 500);
    }
  }

  // Admissions
  async getAdmissions(req: Request, res: Response) {
    try {
      const status = req.query.status as AdmissionStatus;
      const search = req.query.search as string;
      const admissions = await officeAdminService.getAdmissions(req.tenantId!, { status, search });
      return successResponse(res, admissions, 'Admissions retrieved successfully');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to retrieve admissions', 500);
    }
  }

  async createAdmission(req: Request, res: Response) {
    try {
      const admission = await officeAdminService.createAdmission(req.tenantId!, req.body);
      return successResponse(res, admission, 'Admission application registered successfully', 201);
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to create admission', 400);
    }
  }

  async updateAdmissionStatus(req: Request, res: Response) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const updated = await officeAdminService.updateAdmissionStatus(
        req.tenantId!,
        id,
        req.user!.userId,
        req.body
      );
      return successResponse(res, updated, 'Admission application updated successfully');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to update admission status', 400);
    }
  }

  async enrollStudent(req: Request, res: Response) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const student = await officeAdminService.enrollStudent(req.tenantId!, id, req.body);
      return successResponse(res, student, 'Student officially enrolled into school roster', 201);
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to enroll student', 400);
    }
  }

  // Fees
  async getFeeStructures(req: Request, res: Response) {
    try {
      const data = await officeAdminService.getFeeStructures(req.tenantId!);
      return successResponse(res, data, 'Fee structures retrieved successfully');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to retrieve fee structures', 500);
    }
  }

  async createFeeStructure(req: Request, res: Response) {
    try {
      const structure = await officeAdminService.createFeeStructure(req.tenantId!, req.body);
      return successResponse(res, structure, 'Fee structure created successfully', 201);
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to create fee structure', 400);
    }
  }

  async getStudentFees(req: Request, res: Response) {
    try {
      const classId = req.query.classId as string;
      const status = req.query.status as FeeStatus;
      const isDefaulter = req.query.isDefaulter === 'true';
      const search = req.query.search as string;

      const data = await officeAdminService.getStudentFees(req.tenantId!, {
        classId,
        status,
        isDefaulter,
        search,
      });
      return successResponse(res, data, 'Student fee records retrieved successfully');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to retrieve student fees', 500);
    }
  }

  async collectFee(req: Request, res: Response) {
    try {
      const result = await officeAdminService.collectFee(
        req.tenantId!,
        req.user!.userId,
        req.body
      );
      return successResponse(res, result, 'Fee payment collected successfully', 201);
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to record fee payment', 400);
    }
  }

  async getReceipt(req: Request, res: Response) {
    try {
      const receiptNumber = Array.isArray(req.params.receiptNumber) ? req.params.receiptNumber[0] : req.params.receiptNumber;
      const receipt = await officeAdminService.getReceipt(req.tenantId!, receiptNumber);
      return successResponse(res, receipt, 'Receipt retrieved successfully');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Receipt not found', 404);
    }
  }

  // Documents
  async getDocuments(req: Request, res: Response) {
    try {
      const status = req.query.status as DocumentStatus;
      const studentId = req.query.studentId as string;
      const docs = await officeAdminService.getDocuments(req.tenantId!, { status, studentId });
      return successResponse(res, docs, 'Documents retrieved successfully');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to retrieve documents', 500);
    }
  }

  async verifyDocument(req: Request, res: Response) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const doc = await officeAdminService.verifyDocument(
        req.tenantId!,
        id,
        req.user!.userId,
        req.body
      );
      return successResponse(res, doc, 'Document status updated successfully');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to verify document', 400);
    }
  }

  async uploadDocument(req: Request, res: Response) {
    try {
      const doc = await officeAdminService.uploadDocument(req.tenantId!, req.body);
      return successResponse(res, doc, 'Document uploaded successfully', 201);
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to upload document', 400);
    }
  }

  async uploadDocumentFile(req: Request, res: Response) {
    try {
      if (!req.file) {
        return errorResponse(res, 'No document file provided for upload', 400);
      }

      const { studentId, documentType, documentName, remarks } = req.body;
      if (!studentId || !documentType) {
        return errorResponse(res, 'studentId and documentType are required fields', 400);
      }

      const doc = await officeAdminService.uploadDocumentFile(req.tenantId!, {
        studentId,
        documentType,
        documentName,
        remarks,
        file: req.file,
      });

      return successResponse(res, doc, 'Student document uploaded to S3 successfully', 201);
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to upload document file to S3', 400);
    }
  }

  async getDocumentViewUrl(req: Request, res: Response) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const data = await officeAdminService.getDocumentViewUrl(req.tenantId!, id);
      return successResponse(res, data, 'Document view URL generated successfully');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to generate document view URL', 400);
    }
  }

  async deleteDocument(req: Request, res: Response) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      await officeAdminService.deleteDocument(req.tenantId!, id);
      return successResponse(res, null, 'Document deleted successfully');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to delete document', 400);
    }
  }

  // Certificates
  async getCertificates(req: Request, res: Response) {
    try {
      const certs = await officeAdminService.getCertificates(req.tenantId!);
      return successResponse(res, certs, 'Certificates retrieved successfully');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to retrieve certificates', 500);
    }
  }

  async generateCertificate(req: Request, res: Response) {
    try {
      const cert = await officeAdminService.generateCertificate(
        req.tenantId!,
        req.user!.userId,
        req.body
      );
      return successResponse(res, cert, 'Certificate generated successfully', 201);
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to generate certificate', 400);
    }
  }
}

export const officeAdminController = new OfficeAdminController();
