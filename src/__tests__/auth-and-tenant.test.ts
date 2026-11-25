import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../app';
import { prisma } from '../config/database';
import { schoolService } from '../services/school.service';
import { subscriptionService } from '../services/subscription.service';
import { SchoolStatus, BillingCycle } from '@prisma/client';

describe('Super Admin Multi-Tenant SaaS Backend Suite', () => {
  let superAdminToken: string;
  let superAdminId: string;
  let testSchoolId: string;
  let testSchoolInternalId: string;

  beforeAll(async () => {
    // 1. Authenticate as Super Admin
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'superadmin@edusaas.com',
        password: 'SuperAdmin@2026!',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.user.role).toBe('SUPER_ADMIN');

    superAdminToken = res.body.data.accessToken;
    superAdminId = res.body.data.user.id;
  });

  afterAll(async () => {
    // Cleanup any test school created
    if (testSchoolInternalId) {
      await prisma.school.deleteMany({
        where: { id: testSchoolInternalId },
      });
    }
  });

  describe('1. Health and Public Endpoints', () => {
    it('GET /api/v1/health should report healthy status', async () => {
      const res = await request(app).get('/api/v1/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('healthy');
    });
  });

  describe('2. Authentication & Security Middleware', () => {
    it('should reject login with invalid password', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'superadmin@edusaas.com',
          password: 'WrongPassword123!',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should reject access to protected super-admin routes without token', async () => {
      const res = await request(app).get('/api/v1/super-admin/dashboard');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should allow access to dashboard with valid Super Admin token', async () => {
      const res = await request(app)
        .get('/api/v1/super-admin/dashboard')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.kpis).toBeDefined();
      expect(res.body.data.kpis.totalSchools).toBeGreaterThan(0);
      expect(res.body.data.recentSchools.length).toBeGreaterThan(0);
    });
  });

  describe('3. Multi-Tenant School Provisioning & Transaction', () => {
    it('should provision a new school with atomic transaction (School + Profile + Admin + Sub)', async () => {
      const plan = await prisma.subscriptionPlan.findFirst({ where: { code: 'standard' } });
      expect(plan).toBeDefined();

      const uniqueCode = `TESTSCH-${Date.now()}`;
      const payload = {
        name: 'Cambridge Horizon School',
        code: uniqueCode,
        type: 'K-12 Day School',
        board: 'CBSE',
        registrationNumber: 'REG-TEST-2026',
        establishedYear: 2018,
        website: 'https://cambridge.test.edu',
        officialEmail: `contact@${uniqueCode.toLowerCase()}.edu`,
        primaryPhone: '+91 91234 56789',
        contactPerson: 'Director Sarah Jenkins',
        address: '100 University Avenue',
        city: 'Pune',
        state: 'Maharashtra',
        country: 'India',
        postalCode: '411001',
        academicYear: '2026-2027',
        mediumOfInstruction: 'English',
        workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        planId: plan!.id,
        billingCycle: BillingCycle.ANNUAL,
        adminFullName: 'Sarah Jenkins',
        adminEmail: `admin@${uniqueCode.toLowerCase()}.edu`,
        adminPhone: '+91 91234 56789',
        adminPassword: 'SchoolAdmin@2026!',
      };

      const res = await request(app)
        .post('/api/v1/super-admin/schools')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.school).toBeDefined();
      expect(res.body.data.school.schoolId).toMatch(/^SCH-\d{4}-\d{4}$/);
      expect(res.body.data.schoolAdmin).toBeDefined();
      expect(res.body.data.subscription).toBeDefined();

      testSchoolInternalId = res.body.data.school.id;
      testSchoolId = res.body.data.school.schoolId;

      // Verify records in database
      const profileInDb = await prisma.schoolProfile.findUnique({
        where: { schoolId: testSchoolInternalId },
      });
      expect(profileInDb).not.toBeNull();
      expect(profileInDb?.contactPerson).toBe('Director Sarah Jenkins');

      const adminUserInDb = await prisma.schoolUser.findFirst({
        where: { schoolId: testSchoolInternalId },
      });
      expect(adminUserInDb).not.toBeNull();
      expect(adminUserInDb?.role).toBe('SCHOOL_ADMIN');
    });

    it('should roll back and reject duplicate school code', async () => {
      const existingSchool = await prisma.school.findFirst();
      const plan = await prisma.subscriptionPlan.findFirst();

      const payload = {
        name: 'Duplicate School Test',
        code: existingSchool!.code, // Existing code
        type: 'K-12',
        board: 'CBSE',
        registrationNumber: 'REG-DUP-01',
        establishedYear: 2020,
        officialEmail: 'dup@example.com',
        primaryPhone: '+91 90000 00000',
        contactPerson: 'Duplicate Test',
        address: '123 Test St',
        city: 'Mumbai',
        state: 'MH',
        country: 'India',
        postalCode: '400001',
        academicYear: '2026-2027',
        mediumOfInstruction: 'English',
        workingDays: ['Monday'],
        planId: plan!.id,
        adminFullName: 'Admin Test',
        adminEmail: 'admin-dup@test.com',
        adminPhone: '+91 90000 00000',
      };

      const res = await request(app)
        .post('/api/v1/super-admin/schools')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send(payload);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('already exists');
    });
  });

  describe('4. Tenant Isolation & RBAC Suite', () => {
    it('school user cannot access Super Admin endpoints', async () => {
      // Login as Oakridge School Admin
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'admin@oakridge.example.edu',
          password: 'OakridgeAdmin@2026!',
        });

      expect(loginRes.status).toBe(200);
      const schoolAdminToken = loginRes.body.data.accessToken;

      // Attempt to access Super Admin dashboard
      const dashRes = await request(app)
        .get('/api/v1/super-admin/dashboard')
        .set('Authorization', `Bearer ${schoolAdminToken}`);

      // Must be forbidden!
      expect(dashRes.status).toBe(403);
      expect(dashRes.body.success).toBe(false);
    });

    it('enforces subscription limits for tenant resources', async () => {
      // Check quota validation for a school
      const oakridge = await prisma.school.findFirst({ where: { code: 'OAKRIDGE-01' } });
      expect(oakridge).toBeDefined();

      // Check teacher quota passes for current low count
      await expect(
        subscriptionService.checkTenantQuota(oakridge!.id, 'teacher')
      ).resolves.not.toThrow();
    });
  });

  describe('5. Status Lifecycle & Audit Logging', () => {
    it('should suspend school and record audit log', async () => {
      const res = await request(app)
        .patch(`/api/v1/super-admin/schools/${testSchoolInternalId}/status`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          status: SchoolStatus.SUSPENDED,
          reason: 'Regulatory compliance review',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(SchoolStatus.SUSPENDED);

      // Verify audit log exists
      const auditLog = await prisma.auditLog.findFirst({
        where: {
          targetId: testSchoolInternalId,
          action: 'SCHOOL_STATUS_SUSPENDED',
        },
      });
      expect(auditLog).not.toBeNull();
      expect(auditLog?.actorEmail).toBe('superadmin@edusaas.com');
    });

    it('should reactivate school successfully', async () => {
      const res = await request(app)
        .patch(`/api/v1/super-admin/schools/${testSchoolInternalId}/status`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          status: SchoolStatus.ACTIVE,
          reason: 'Review complete - restored',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(SchoolStatus.ACTIVE);
    });
  });
});
