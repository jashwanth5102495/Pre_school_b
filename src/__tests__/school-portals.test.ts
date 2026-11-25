import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../app';

describe('Multi-Tenant School Portals & Role-Based Workflows', () => {
  let superAdminToken: string;
  let schoolAdminToken: string;
  let headMasterToken: string;
  let officeAdminToken: string;
  let teacherToken: string;
  let oakridgeId: string;

  beforeAll(async () => {
    // 1. Super Admin login
    const resSA = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'superadmin@edusaas.com', password: 'SuperAdmin@2026!' });
    expect(resSA.status).toBe(200);
    superAdminToken = resSA.body.data.accessToken;

    // 2. School Admin login
    const resAdmin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@oakridge.example.edu', password: 'OakridgeAdmin@2026!' });
    expect(resAdmin.status).toBe(200);
    schoolAdminToken = resAdmin.body.data.accessToken;
    oakridgeId = resAdmin.body.data.user.schoolId;

    // 3. Head Master login
    const resHM = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'headmaster@oakridge.example.edu', password: 'HeadMaster@2026!' });
    expect(resHM.status).toBe(200);
    headMasterToken = resHM.body.data.accessToken;

    // 4. Office Admin login
    const resOA = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'office@oakridge.example.edu', password: 'OfficeAdmin@2026!' });
    expect(resOA.status).toBe(200);
    officeAdminToken = resOA.body.data.accessToken;

    // 5. Teacher login
    const resTch = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'teacher.math@oakridge.example.edu', password: 'Teacher@2026!' });
    expect(resTch.status).toBe(200);
    teacherToken = resTch.body.data.accessToken;
  });

  describe('1. Centralized Authentication & Role Inspection', () => {
    it('should authenticate all 5 distinct roles and return correct metadata', async () => {
      expect(superAdminToken).toBeDefined();
      expect(schoolAdminToken).toBeDefined();
      expect(headMasterToken).toBeDefined();
      expect(officeAdminToken).toBeDefined();
      expect(teacherToken).toBeDefined();
      expect(oakridgeId).toBeDefined();
    });
  });

  describe('2. School Admin Portal Endpoints', () => {
    it('should fetch real database dashboard metrics for Oakridge', async () => {
      const res = await request(app)
        .get('/api/v1/school/admin/dashboard')
        .set('Authorization', `Bearer ${schoolAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.summary.totalStudents).toBeGreaterThan(0);
      expect(res.body.data.summary.totalTeachers).toBeGreaterThan(0);
      expect(res.body.data.summary.activeAcademicYear).toBe('2025-2026');
      expect(res.body.data.classDistribution.length).toBeGreaterThan(0);
    });

    it('should list students with real PostgreSQL records and pagination', async () => {
      const res = await request(app)
        .get('/api/v1/school/admin/students')
        .set('Authorization', `Bearer ${schoolAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.meta.total).toBeGreaterThan(0);
    });

    it('should retrieve staff directory (teachers and administrators)', async () => {
      const res = await request(app)
        .get('/api/v1/school/admin/staff')
        .set('Authorization', `Bearer ${schoolAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.teachers.length).toBeGreaterThan(0);
      expect(res.body.data.schoolUsers.length).toBeGreaterThan(0);
    });
  });

  describe('3. Head Master Portal Endpoints', () => {
    it('should retrieve academic dashboard summary', async () => {
      const res = await request(app)
        .get('/api/v1/school/head-master/dashboard')
        .set('Authorization', `Bearer ${headMasterToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.summary.classesCount).toBeGreaterThan(0);
      expect(res.body.data.summary.teachersCount).toBeGreaterThan(0);
    });

    it('should retrieve teacher leave applications', async () => {
      const res = await request(app)
        .get('/api/v1/school/head-master/leaves')
        .set('Authorization', `Bearer ${headMasterToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('should reject timetable creation with conflict when period already scheduled', async () => {
      // First get existing timetable period
      const existing = await request(app)
        .get('/api/v1/school/head-master/timetable')
        .set('Authorization', `Bearer ${headMasterToken}`);

      expect(existing.status).toBe(200);
      expect(existing.body.data.length).toBeGreaterThan(0);
      const firstPeriod = existing.body.data[0];

      // Attempt to schedule duplicate period for the same class & section
      const clashRes = await request(app)
        .post('/api/v1/school/head-master/timetable')
        .set('Authorization', `Bearer ${headMasterToken}`)
        .send({
          academicYearId: firstPeriod.academicYearId,
          classId: firstPeriod.classId,
          sectionId: firstPeriod.sectionId,
          dayOfWeek: firstPeriod.dayOfWeek,
          periodNumber: firstPeriod.periodNumber,
          startTime: '08:30',
          endTime: '09:15',
          isBreak: false,
        });

      expect(clashRes.status).toBe(400);
      expect(clashRes.body.error.message).toMatch(/conflict/i);
    });
  });

  describe('4. Office Admin Portal Endpoints', () => {
    it('should retrieve office dashboard metrics', async () => {
      const res = await request(app)
        .get('/api/v1/school/office/dashboard')
        .set('Authorization', `Bearer ${officeAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.summary.totalActiveStudents).toBeGreaterThan(0);
      expect(res.body.data.summary.pendingAdmissions).toBeGreaterThan(0);
    });

    it('should list admissions applications', async () => {
      const res = await request(app)
        .get('/api/v1/school/office/admissions')
        .set('Authorization', `Bearer ${officeAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('should collect fee and generate official receipt number', async () => {
      // Find an unpaid/partial student fee
      const feesRes = await request(app)
        .get('/api/v1/school/office/fees/students')
        .set('Authorization', `Bearer ${officeAdminToken}`);

      expect(feesRes.status).toBe(200);
      const targetFee = feesRes.body.data.find((f: any) => f.balanceAmount > 0);
      expect(targetFee).toBeDefined();

      const payRes = await request(app)
        .post('/api/v1/school/office/fees/collect')
        .set('Authorization', `Bearer ${officeAdminToken}`)
        .send({
          studentFeeId: targetFee.id,
          amountPaid: 5000,
          paymentMethod: 'CASH',
          remarks: 'Counter fee collection test',
        });

      expect(payRes.status).toBe(201);
      expect(payRes.body.data.receiptNumber).toMatch(/^REC-\d{4}-\d{4}$/);
      expect(payRes.body.data.amountPaid).toBe(5000);
    });
  });

  describe('5. Teacher Portal Endpoints', () => {
    it('should retrieve teacher dashboard and timetable schedule', async () => {
      const res = await request(app)
        .get('/api/v1/school/teacher/dashboard')
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.teacher).toBeDefined();
      expect(res.body.data.allocations.length).toBeGreaterThan(0);
    });

    it('should allow teacher to mark daily classroom attendance', async () => {
      // Get teacher assigned class
      const assigned = await request(app)
        .get('/api/v1/school/teacher/assigned')
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(assigned.status).toBe(200);
      const alloc = assigned.body.data[0];

      // Get attendance roster
      const rosterRes = await request(app)
        .get(`/api/v1/school/teacher/attendance/session?classId=${alloc.classId}&sectionId=${alloc.sectionId}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(rosterRes.status).toBe(200);
      expect(rosterRes.body.data.roster.length).toBeGreaterThan(0);

      const records = rosterRes.body.data.roster.map((s: any) => ({
        studentId: s.studentId,
        status: 'PRESENT',
        remarks: 'All present',
      }));

      // Submit attendance
      const markRes = await request(app)
        .post('/api/v1/school/teacher/attendance/mark')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          classId: alloc.classId,
          sectionId: alloc.sectionId,
          records,
        });

      expect(markRes.status).toBe(201);
      expect(markRes.body.data.totalMarked).toBe(records.length);
      expect(markRes.body.data.attendancePercentage).toBe(100);
    });
  });

  describe('6. Cross-Role Authorization & Security', () => {
    it('should prevent Teacher from accessing Office Admin fee collection (403 Forbidden)', async () => {
      const res = await request(app)
        .post('/api/v1/school/office/fees/collect')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          studentFeeId: 'any-id',
          amountPaid: 1000,
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('should prevent Office Admin from reviewing teacher leaves (403 Forbidden)', async () => {
      const res = await request(app)
        .get('/api/v1/school/head-master/leaves')
        .set('Authorization', `Bearer ${officeAdminToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });
});
