import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../app';
import { prisma } from '../config/database';
import { storageService } from '../services/storage.service';

describe('S3 Student Document Storage & Upload Suite', () => {
  let officeAdminToken: string;
  let oakridgeSchoolId: string;
  let testStudentId: string;
  let createdDocId: string;

  beforeAll(async () => {
    // 1. Authenticate as Office Admin
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'office@oakridge.example.edu',
        password: 'OfficeAdmin@2026!',
      });

    expect(loginRes.status).toBe(200);
    officeAdminToken = loginRes.body.data.accessToken;

    const school = await prisma.school.findUnique({
      where: { code: 'OAKRIDGE-01' },
    });
    expect(school).toBeDefined();
    oakridgeSchoolId = school!.id;

    // 2. Create a clean test student for document attachment
    const student = await prisma.student.create({
      data: {
        schoolId: oakridgeSchoolId,
        studentCode: 'TEST-STU-S3-001',
        admissionNo: 'ADM-S3-2026-001',
        firstName: 'Aarav',
        lastName: 'Sharma',
        dob: new Date('2010-05-15'),
        gender: 'MALE',
        parentName: 'Ramesh Sharma',
        parentPhone: '+91 98200 11223',
        parentEmail: 'ramesh.sharma@example.com',
        status: 'ACTIVE',
      },
    });
    testStudentId = student.id;
  });

  afterAll(async () => {
    // Clean up test documents and test student
    if (createdDocId) {
      await prisma.studentDocument.deleteMany({ where: { id: createdDocId } });
    }
    if (testStudentId) {
      await prisma.studentDocument.deleteMany({ where: { studentId: testStudentId } });
      await prisma.student.deleteMany({ where: { id: testStudentId } });
    }
  });

  describe('1. Storage Service Core Unit Operations', () => {
    it('should generate standardized S3 key hierarchy and handle document upload', async () => {
      const buffer = Buffer.from('Mock S3 Student Birth Certificate Content');
      const result = await storageService.uploadStudentDocument({
        schoolId: oakridgeSchoolId,
        studentId: testStudentId,
        documentType: 'BIRTH_CERTIFICATE',
        originalFilename: 'Aarav_Sharma_BirthCert.pdf',
        buffer,
        mimetype: 'application/pdf',
        size: buffer.length,
      });

      expect(result).toBeDefined();
      expect(result.fileUrl).toBeDefined();
      expect(result.key).toContain(`schools/${oakridgeSchoolId}/students/${testStudentId}/BIRTH_CERTIFICATE/`);
      expect(result.key).toMatch(/\.pdf$/);
      expect(result.size).toBe(buffer.length);
    });

    it('should generate secure view URL for document', async () => {
      const viewUrl = await storageService.getDocumentViewUrl(
        `schools/${oakridgeSchoolId}/students/${testStudentId}/BIRTH_CERTIFICATE/sample.pdf`
      );
      expect(viewUrl).toBeDefined();
      expect(typeof viewUrl).toBe('string');
    });
  });

  describe('2. Office Admin S3 Document Upload API', () => {
    it('should reject file upload without studentId', async () => {
      const res = await request(app)
        .post('/api/v1/school/office/documents/upload')
        .set('Authorization', `Bearer ${officeAdminToken}`)
        .field('documentType', 'BIRTH_CERTIFICATE')
        .attach('file', Buffer.from('%PDF-1.4 Mock Transfer Certificate'), 'transfer_cert.pdf');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should successfully upload student document file via multipart/form-data to S3 storage', async () => {
      const fileContent = Buffer.from('%PDF-1.4 Official Grade 10 Marksheet Document');

      const res = await request(app)
        .post('/api/v1/school/office/documents/upload')
        .set('Authorization', `Bearer ${officeAdminToken}`)
        .field('studentId', testStudentId)
        .field('documentType', 'PREVIOUS_MARKSHEET')
        .field('documentName', 'Previous Academic Marksheet 2025')
        .field('remarks', 'Original verified at admissions counter')
        .attach('file', fileContent, 'Marksheet_2025.pdf');

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.documentName).toBe('Previous Academic Marksheet 2025');
      expect(res.body.data.documentType).toBe('PREVIOUS_MARKSHEET');
      expect(res.body.data.status).toBe('PENDING');
      expect(res.body.data.fileUrl).toBeDefined();
      expect(res.body.data.viewUrl).toBeDefined();

      createdDocId = res.body.data.id;
    });

    it('should list uploaded student documents with presigned view URLs', async () => {
      const res = await request(app)
        .get('/api/v1/school/office/documents')
        .set('Authorization', `Bearer ${officeAdminToken}`)
        .query({ studentId: testStudentId });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);

      const found = res.body.data.find((d: any) => d.id === createdDocId);
      expect(found).toBeDefined();
      expect(found.student.firstName).toBe('Aarav');
      expect(found.viewUrl).toBeDefined();
    });

    it('should generate document view URL via dedicated endpoint', async () => {
      const res = await request(app)
        .get(`/api/v1/school/office/documents/${createdDocId}/view-url`)
        .set('Authorization', `Bearer ${officeAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.viewUrl).toBeDefined();
    });

    it('should verify uploaded document status', async () => {
      const res = await request(app)
        .put(`/api/v1/school/office/documents/${createdDocId}/verify`)
        .set('Authorization', `Bearer ${officeAdminToken}`)
        .send({
          status: 'VERIFIED',
          remarks: 'All seals and signatures verified against board records',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('VERIFIED');
      expect(res.body.data.remarks).toBe('All seals and signatures verified against board records');
    });

    it('should delete document and clean up storage', async () => {
      const res = await request(app)
        .delete(`/api/v1/school/office/documents/${createdDocId}`)
        .set('Authorization', `Bearer ${officeAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const check = await prisma.studentDocument.findUnique({
        where: { id: createdDocId },
      });
      expect(check).toBeNull();
      createdDocId = '';
    });
  });
});
