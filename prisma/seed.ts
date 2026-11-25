import {
  PrismaClient,
  PlatformRole,
  UserStatus,
  SchoolStatus,
  SubscriptionStatus,
  BillingCycle,
  PaymentStatus,
  InvoiceStatus,
  AuditActorType,
  SchoolRole,
  AttendanceStatus,
  LeaveStatus,
  MarksStatus,
  AdmissionStatus,
  DocumentStatus,
  FeeStatus,
  FeePaymentMethod,
  CertificateType,
  AcademicEventType,
} from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('--- SEEDING DATABASE FOR MULTI-TENANT SAAS & ALL 5 PORTALS ---');

  // 1. Seed Super Admin Platform User
  const passwordHash = await bcrypt.hash('SuperAdmin@2026!', 12);
  const superAdmin = await prisma.platformUser.upsert({
    where: { email: 'superadmin@edusaas.com' },
    update: {},
    create: {
      email: 'superadmin@edusaas.com',
      passwordHash,
      fullName: 'System Super Admin',
      role: PlatformRole.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
      phone: '+1 555-019-2831',
    },
  });
  console.log(`✓ Super Admin seeded: ${superAdmin.email}`);

  // Seed Platform Support user
  await prisma.platformUser.upsert({
    where: { email: 'support@edusaas.com' },
    update: {},
    create: {
      email: 'support@edusaas.com',
      passwordHash,
      fullName: 'Platform Operations Lead',
      role: PlatformRole.PLATFORM_SUPPORT,
      status: UserStatus.ACTIVE,
      phone: '+1 555-019-2832',
    },
  });

  // 2. Seed Feature Definitions
  const features = [
    { code: 'student_management', name: 'Student Management', category: 'Academic', description: 'Student records, admission workflow, student profiles' },
    { code: 'teacher_management', name: 'Teacher Management', category: 'Academic', description: 'Staff directory, teaching loads, qualifications' },
    { code: 'attendance', name: 'Attendance Tracking', category: 'Daily Operations', description: 'Daily attendance for students and staff' },
    { code: 'examination', name: 'Examinations & Grading', category: 'Academic', description: 'Exam scheduling, GPA calculation, report cards' },
    { code: 'fees', name: 'Fee Collection & Invoicing', category: 'Finance', description: 'Fee structures, receipts, late fee computation' },
    { code: 'timetable', name: 'Timetable Scheduling', category: 'Academic', description: 'Class schedule generator and teacher clash management' },
    { code: 'library', name: 'Library Circulation', category: 'Facility', description: 'Book lending, inventory and barcode scanning' },
    { code: 'transport', name: 'Transport & Fleet', category: 'Logistics', description: 'Bus routes, student stops, driver assignments' },
    { code: 'communication', name: 'Messaging & Broadcasts', category: 'Communication', description: 'SMS, WhatsApp, and in-app circulars' },
    { code: 'reports', name: 'Analytics & Reporting', category: 'Management', description: 'Custom BI reports and audit dashboards' },
    { code: 'parent_portal', name: 'Parent Portal Access', category: 'Portals', description: 'Dedicated portal for guardians and parents' },
  ];

  for (const feat of features) {
    await prisma.featureDefinition.upsert({
      where: { code: feat.code },
      update: { name: feat.name, description: feat.description, category: feat.category },
      create: { ...feat, defaultEnabled: true },
    });
  }
  console.log(`✓ ${features.length} Feature Definitions seeded`);

  // 3. Seed Subscription Plans
  const plansData = [
    {
      name: 'Starter Basic',
      code: 'basic',
      description: 'Ideal for small schools and pre-schools getting started with digital administration.',
      monthlyPrice: 99,
      quarterlyPrice: 269,
      annualPrice: 999,
      maxStudents: 250,
      maxTeachers: 25,
      maxStorageMb: 10240,
      maxBranches: 1,
      supportLevel: 'Standard Email',
      trialDays: 14,
      isTrialAvailable: true,
      status: SchoolStatus.ACTIVE,
      sortOrder: 1,
    },
    {
      name: 'Standard Growth',
      code: 'standard',
      description: 'Full-featured suite designed for expanding K-12 private and public schools.',
      monthlyPrice: 199,
      quarterlyPrice: 549,
      annualPrice: 1999,
      maxStudents: 750,
      maxTeachers: 60,
      maxStorageMb: 51200,
      maxBranches: 1,
      supportLevel: 'Priority Email & Chat',
      trialDays: 14,
      isTrialAvailable: true,
      status: SchoolStatus.ACTIVE,
      sortOrder: 2,
    },
    {
      name: 'Premium Institutional',
      code: 'premium',
      description: 'Advanced academic and administrative powers for large established institutions.',
      monthlyPrice: 349,
      quarterlyPrice: 949,
      annualPrice: 3499,
      maxStudents: 2000,
      maxTeachers: 150,
      maxStorageMb: 204800,
      maxBranches: 3,
      supportLevel: 'Dedicated Relationship Manager',
      trialDays: 14,
      isTrialAvailable: true,
      status: SchoolStatus.ACTIVE,
      sortOrder: 3,
    },
    {
      name: 'Enterprise Network',
      code: 'enterprise',
      description: 'Complete multi-campus school chains with custom integrations and 24/7 SLA.',
      monthlyPrice: 699,
      quarterlyPrice: 1899,
      annualPrice: 6999,
      maxStudents: 10000,
      maxTeachers: 500,
      maxStorageMb: 1024000,
      maxBranches: 10,
      supportLevel: '24/7 Phone & Priority SLA',
      trialDays: 30,
      isTrialAvailable: true,
      status: SchoolStatus.ACTIVE,
      sortOrder: 4,
    },
  ];

  const createdPlans = [];
  for (const plan of plansData) {
    const p = await prisma.subscriptionPlan.upsert({
      where: { code: plan.code },
      update: plan,
      create: plan,
    });
    createdPlans.push(p);

    for (const feat of features) {
      const isEnabled = !(plan.code === 'basic' && (feat.code === 'transport' || feat.code === 'reports'));
      await prisma.subscriptionFeature.upsert({
        where: {
          planId_featureCode: {
            planId: p.id,
            featureCode: feat.code,
          },
        },
        update: { isEnabled },
        create: {
          planId: p.id,
          featureCode: feat.code,
          isEnabled,
        },
      });
    }
  }
  console.log(`✓ ${createdPlans.length} Subscription Plans seeded`);

  // 4. Seed Primary School: Oakridge International Academy
  const premiumPlan = createdPlans.find((p) => p.code === 'premium')!;
  const standardPlan = createdPlans.find((p) => p.code === 'standard')!;
  const basicPlan = createdPlans.find((p) => p.code === 'basic')!;

  const schoolA = await prisma.school.upsert({
    where: { code: 'OAKRIDGE-01' },
    update: {},
    create: {
      schoolId: 'SCH-2026-0001',
      name: 'Oakridge International Academy',
      code: 'OAKRIDGE-01',
      slug: 'oakridge-international-academy',
      type: 'K-12 Day & Boarding',
      board: 'CBSE',
      registrationNumber: 'REG-MH-2021-9981',
      establishedYear: 2012,
      website: 'https://oakridge.example.edu',
      status: SchoolStatus.ACTIVE,
      profile: {
        create: {
          officialEmail: 'info@oakridge.example.edu',
          primaryPhone: '+91 98201 12345',
          contactPerson: 'Dr. Arthur Pendelton',
          address: '42 Academic Boulevard, Knowledge Park',
          city: 'Mumbai',
          state: 'Maharashtra',
          country: 'India',
          postalCode: '400076',
          workingDays: 'Monday,Tuesday,Wednesday,Thursday,Friday,Saturday',
          mediumOfInstruction: 'English',
          timezone: 'Asia/Kolkata',
          currency: 'INR',
        },
      },
      subscription: {
        create: {
          planId: premiumPlan.id,
          billingCycle: BillingCycle.ANNUAL,
          status: SubscriptionStatus.ACTIVE,
          startDate: new Date('2026-01-01'),
          endDate: new Date('2027-01-01'),
          autoRenew: true,
        },
      },
    },
  });

  // 5. Seed School Users for Oakridge (All 4 School Roles)
  const schoolAdminPass = await bcrypt.hash('OakridgeAdmin@2026!', 12);
  const headMasterPass = await bcrypt.hash('HeadMaster@2026!', 12);
  const officeAdminPass = await bcrypt.hash('OfficeAdmin@2026!', 12);
  const teacherPass = await bcrypt.hash('Teacher@2026!', 12);

  // School Admin
  const schoolAdminUser = await prisma.schoolUser.upsert({
    where: { schoolId_email: { schoolId: schoolA.id, email: 'admin@oakridge.example.edu' } },
    update: {},
    create: {
      schoolId: schoolA.id,
      email: 'admin@oakridge.example.edu',
      fullName: 'Principal Arthur Pendelton',
      passwordHash: schoolAdminPass,
      role: SchoolRole.SCHOOL_ADMIN,
      status: UserStatus.ACTIVE,
      phone: '+91 98201 12345',
    },
  });

  // Head Master
  const headMasterUser = await prisma.schoolUser.upsert({
    where: { schoolId_email: { schoolId: schoolA.id, email: 'headmaster@oakridge.example.edu' } },
    update: {},
    create: {
      schoolId: schoolA.id,
      email: 'headmaster@oakridge.example.edu',
      fullName: 'Vice Principal Evelyn Vance',
      passwordHash: headMasterPass,
      role: SchoolRole.HEAD_MASTER,
      status: UserStatus.ACTIVE,
      phone: '+91 98201 12346',
    },
  });

  // Office Admin
  const officeAdminUser = await prisma.schoolUser.upsert({
    where: { schoolId_email: { schoolId: schoolA.id, email: 'office@oakridge.example.edu' } },
    update: {},
    create: {
      schoolId: schoolA.id,
      email: 'office@oakridge.example.edu',
      fullName: 'Ramesh Kulkarni',
      passwordHash: officeAdminPass,
      role: SchoolRole.OFFICE_ADMIN,
      status: UserStatus.ACTIVE,
      phone: '+91 98201 12347',
    },
  });

  // Teacher 1: Mathematics
  const teacherUserMath = await prisma.schoolUser.upsert({
    where: { schoolId_email: { schoolId: schoolA.id, email: 'teacher.math@oakridge.example.edu' } },
    update: {},
    create: {
      schoolId: schoolA.id,
      email: 'teacher.math@oakridge.example.edu',
      fullName: 'Meera Nair',
      passwordHash: teacherPass,
      role: SchoolRole.TEACHER,
      status: UserStatus.ACTIVE,
      phone: '+91 98201 12348',
    },
  });

  // Teacher 2: Physics
  const teacherUserSci = await prisma.schoolUser.upsert({
    where: { schoolId_email: { schoolId: schoolA.id, email: 'teacher.sci@oakridge.example.edu' } },
    update: {},
    create: {
      schoolId: schoolA.id,
      email: 'teacher.sci@oakridge.example.edu',
      fullName: 'Dr. Rajesh Gupta',
      passwordHash: teacherPass,
      role: SchoolRole.TEACHER,
      status: UserStatus.ACTIVE,
      phone: '+91 98201 12349',
    },
  });

  // Teacher 3: English
  const teacherUserEng = await prisma.schoolUser.upsert({
    where: { schoolId_email: { schoolId: schoolA.id, email: 'teacher.eng@oakridge.example.edu' } },
    update: {},
    create: {
      schoolId: schoolA.id,
      email: 'teacher.eng@oakridge.example.edu',
      fullName: 'Sarah Jenkins',
      passwordHash: teacherPass,
      role: SchoolRole.TEACHER,
      status: UserStatus.ACTIVE,
      phone: '+91 98201 12350',
    },
  });

  console.log('✓ Oakridge School Users seeded: School Admin, Head Master, Office Admin, 3 Teachers');

  // 6. Seed Academic Year
  const academicYear = await prisma.academicYear.upsert({
    where: { schoolId_name: { schoolId: schoolA.id, name: '2025-2026' } },
    update: {},
    create: {
      schoolId: schoolA.id,
      name: '2025-2026',
      startDate: new Date('2025-06-01'),
      endDate: new Date('2026-04-30'),
      isCurrent: true,
      status: 'ACTIVE',
    },
  });

  // 7. Seed Classes & Sections
  const class10 = await prisma.schoolClass.upsert({
    where: { schoolId_code: { schoolId: schoolA.id, code: 'GRADE-10' } },
    update: {},
    create: { schoolId: schoolA.id, name: 'Grade 10', code: 'GRADE-10' },
  });

  const class9 = await prisma.schoolClass.upsert({
    where: { schoolId_code: { schoolId: schoolA.id, code: 'GRADE-9' } },
    update: {},
    create: { schoolId: schoolA.id, name: 'Grade 9', code: 'GRADE-9' },
  });

  const class8 = await prisma.schoolClass.upsert({
    where: { schoolId_code: { schoolId: schoolA.id, code: 'GRADE-8' } },
    update: {},
    create: { schoolId: schoolA.id, name: 'Grade 8', code: 'GRADE-8' },
  });

  const sec10A = await prisma.schoolSection.upsert({
    where: { schoolId_classId_name: { schoolId: schoolA.id, classId: class10.id, name: 'Section A' } },
    update: {},
    create: { schoolId: schoolA.id, classId: class10.id, name: 'Section A', capacity: 35 },
  });

  const sec10B = await prisma.schoolSection.upsert({
    where: { schoolId_classId_name: { schoolId: schoolA.id, classId: class10.id, name: 'Section B' } },
    update: {},
    create: { schoolId: schoolA.id, classId: class10.id, name: 'Section B', capacity: 35 },
  });

  const sec9A = await prisma.schoolSection.upsert({
    where: { schoolId_classId_name: { schoolId: schoolA.id, classId: class9.id, name: 'Section A' } },
    update: {},
    create: { schoolId: schoolA.id, classId: class9.id, name: 'Section A', capacity: 35 },
  });

  const sec8A = await prisma.schoolSection.upsert({
    where: { schoolId_classId_name: { schoolId: schoolA.id, classId: class8.id, name: 'Section A' } },
    update: {},
    create: { schoolId: schoolA.id, classId: class8.id, name: 'Section A', capacity: 35 },
  });

  // 8. Seed Subjects
  const subjectsData = [
    { name: 'Mathematics', code: 'MATH-101', category: 'CORE' },
    { name: 'Physics', code: 'PHY-101', category: 'CORE' },
    { name: 'English Literature', code: 'ENG-101', category: 'LANGUAGE' },
    { name: 'Chemistry', code: 'CHEM-101', category: 'CORE' },
    { name: 'Biology', code: 'BIO-101', category: 'CORE' },
    { name: 'Social Studies', code: 'SST-101', category: 'CORE' },
    { name: 'Computer Science', code: 'CS-101', category: 'ELECTIVE' },
  ];

  const subjects: Record<string, any> = {};
  for (const s of subjectsData) {
    const sub = await prisma.subject.upsert({
      where: { schoolId_code: { schoolId: schoolA.id, code: s.code } },
      update: {},
      create: { schoolId: schoolA.id, ...s },
    });
    subjects[s.code] = sub;

    // Link subject to Class 10
    await prisma.classSubject.upsert({
      where: { schoolId_classId_subjectId: { schoolId: schoolA.id, classId: class10.id, subjectId: sub.id } },
      update: {},
      create: { schoolId: schoolA.id, classId: class10.id, subjectId: sub.id },
    });
  }

  // 9. Seed Teachers Profiles
  const teacherMath = await prisma.teacher.upsert({
    where: { schoolId_teacherCode: { schoolId: schoolA.id, teacherCode: 'OAK-TCH-001' } },
    update: { userId: teacherUserMath.id },
    create: {
      schoolId: schoolA.id,
      userId: teacherUserMath.id,
      teacherCode: 'OAK-TCH-001',
      firstName: 'Meera',
      lastName: 'Nair',
      email: 'teacher.math@oakridge.example.edu',
      phone: '+91 98201 12348',
      designation: 'Head of Mathematics',
      qualification: 'M.Sc., B.Ed.',
      specialization: 'Advanced Calculus & Algebra',
      joiningDate: new Date('2018-05-15'),
      status: 'ACTIVE',
    },
  });

  const teacherSci = await prisma.teacher.upsert({
    where: { schoolId_teacherCode: { schoolId: schoolA.id, teacherCode: 'OAK-TCH-002' } },
    update: { userId: teacherUserSci.id },
    create: {
      schoolId: schoolA.id,
      userId: teacherUserSci.id,
      teacherCode: 'OAK-TCH-002',
      firstName: 'Rajesh',
      lastName: 'Gupta',
      email: 'teacher.sci@oakridge.example.edu',
      phone: '+91 98201 12349',
      designation: 'Senior Science Teacher',
      qualification: 'Ph.D. in Physics',
      specialization: 'Optics & Thermodynamics',
      joiningDate: new Date('2019-06-10'),
      status: 'ACTIVE',
    },
  });

  const teacherEng = await prisma.teacher.upsert({
    where: { schoolId_teacherCode: { schoolId: schoolA.id, teacherCode: 'OAK-TCH-003' } },
    update: { userId: teacherUserEng.id },
    create: {
      schoolId: schoolA.id,
      userId: teacherUserEng.id,
      teacherCode: 'OAK-TCH-003',
      firstName: 'Sarah',
      lastName: 'Jenkins',
      email: 'teacher.eng@oakridge.example.edu',
      phone: '+91 98201 12350',
      designation: 'Senior English Faculty',
      qualification: 'M.A. English, Cambridge CELTA',
      specialization: 'British Literature & Grammar',
      joiningDate: new Date('2020-07-01'),
      status: 'ACTIVE',
    },
  });

  // 10. Seed Teacher Allocations
  // Meera Nair teaches Math to 10-A (Class Teacher) and 10-B
  await prisma.teacherAllocation.upsert({
    where: {
      schoolId_teacherId_classId_sectionId_subjectId: {
        schoolId: schoolA.id,
        teacherId: teacherMath.id,
        classId: class10.id,
        sectionId: sec10A.id,
        subjectId: subjects['MATH-101'].id,
      },
    },
    update: {},
    create: {
      schoolId: schoolA.id,
      teacherId: teacherMath.id,
      classId: class10.id,
      sectionId: sec10A.id,
      subjectId: subjects['MATH-101'].id,
      isClassTeacher: true,
    },
  });

  await prisma.teacherAllocation.upsert({
    where: {
      schoolId_teacherId_classId_sectionId_subjectId: {
        schoolId: schoolA.id,
        teacherId: teacherMath.id,
        classId: class10.id,
        sectionId: sec10B.id,
        subjectId: subjects['MATH-101'].id,
      },
    },
    update: {},
    create: {
      schoolId: schoolA.id,
      teacherId: teacherMath.id,
      classId: class10.id,
      sectionId: sec10B.id,
      subjectId: subjects['MATH-101'].id,
      isClassTeacher: false,
    },
  });

  // Rajesh Gupta teaches Physics to 10-A and 9-A
  await prisma.teacherAllocation.upsert({
    where: {
      schoolId_teacherId_classId_sectionId_subjectId: {
        schoolId: schoolA.id,
        teacherId: teacherSci.id,
        classId: class10.id,
        sectionId: sec10A.id,
        subjectId: subjects['PHY-101'].id,
      },
    },
    update: {},
    create: {
      schoolId: schoolA.id,
      teacherId: teacherSci.id,
      classId: class10.id,
      sectionId: sec10A.id,
      subjectId: subjects['PHY-101'].id,
      isClassTeacher: false,
    },
  });

  // Sarah Jenkins teaches English to 10-A and 8-A
  await prisma.teacherAllocation.upsert({
    where: {
      schoolId_teacherId_classId_sectionId_subjectId: {
        schoolId: schoolA.id,
        teacherId: teacherEng.id,
        classId: class10.id,
        sectionId: sec10A.id,
        subjectId: subjects['ENG-101'].id,
      },
    },
    update: {},
    create: {
      schoolId: schoolA.id,
      teacherId: teacherEng.id,
      classId: class10.id,
      sectionId: sec10A.id,
      subjectId: subjects['ENG-101'].id,
      isClassTeacher: false,
    },
  });

  // 11. Seed Timetable for Class 10-A
  const periods = [
    { periodNumber: 1, startTime: '08:30', endTime: '09:15', subjectId: subjects['MATH-101'].id, teacherId: teacherMath.id, classroom: 'Room 101' },
    { periodNumber: 2, startTime: '09:15', endTime: '10:00', subjectId: subjects['PHY-101'].id, teacherId: teacherSci.id, classroom: 'Physics Lab' },
    { periodNumber: 3, startTime: '10:00', endTime: '10:45', subjectId: subjects['ENG-101'].id, teacherId: teacherEng.id, classroom: 'Room 101' },
    { periodNumber: 4, startTime: '10:45', endTime: '11:15', isBreak: true }, // Recess
    { periodNumber: 5, startTime: '11:15', endTime: '12:00', subjectId: subjects['CHEM-101'].id, teacherId: null, classroom: 'Chem Lab' },
    { periodNumber: 6, startTime: '12:00', endTime: '12:45', subjectId: subjects['BIO-101'].id, teacherId: null, classroom: 'Bio Lab' },
  ];

  const daysOfWeek = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];
  for (const day of daysOfWeek) {
    for (const p of periods) {
      await prisma.timetablePeriod.upsert({
        where: {
          schoolId_academicYearId_classId_sectionId_dayOfWeek_periodNumber: {
            schoolId: schoolA.id,
            academicYearId: academicYear.id,
            classId: class10.id,
            sectionId: sec10A.id,
            dayOfWeek: day,
            periodNumber: p.periodNumber,
          },
        },
        update: {},
        create: {
          schoolId: schoolA.id,
          academicYearId: academicYear.id,
          classId: class10.id,
          sectionId: sec10A.id,
          dayOfWeek: day,
          periodNumber: p.periodNumber,
          startTime: p.startTime,
          endTime: p.endTime,
          subjectId: p.subjectId || null,
          teacherId: p.teacherId || null,
          classroom: p.classroom || null,
          isBreak: p.isBreak || false,
        },
      });
    }
  }

  // 12. Seed Real Students in Class 10-A, 10-B, 9-A, 8-A
  const studentsRaw = [
    { code: 'OAK-STU-001', adm: 'ADM-2026-001', first: 'Aarav', last: 'Sharma', gender: 'MALE', classId: class10.id, secId: sec10A.id, parent: 'Rajesh Sharma', phone: '+91 98111 00001', email: 'rajesh.sharma@family.com' },
    { code: 'OAK-STU-002', adm: 'ADM-2026-002', first: 'Diya', last: 'Patel', gender: 'FEMALE', classId: class10.id, secId: sec10A.id, parent: 'Kiran Patel', phone: '+91 98111 00002', email: 'kiran.patel@family.com' },
    { code: 'OAK-STU-003', adm: 'ADM-2026-003', first: 'Vihaan', last: 'Verma', gender: 'MALE', classId: class10.id, secId: sec10A.id, parent: 'Sunil Verma', phone: '+91 98111 00003', email: 'sunil.verma@family.com' },
    { code: 'OAK-STU-004', adm: 'ADM-2026-004', first: 'Ananya', last: 'Iyer', gender: 'FEMALE', classId: class10.id, secId: sec10A.id, parent: 'Venkatesh Iyer', phone: '+91 98111 00004', email: 'v.iyer@family.com' },
    { code: 'OAK-STU-005', adm: 'ADM-2026-005', first: 'Kabir', last: 'Mehta', gender: 'MALE', classId: class10.id, secId: sec10A.id, parent: 'Harish Mehta', phone: '+91 98111 00005', email: 'h.mehta@family.com' },
    { code: 'OAK-STU-006', adm: 'ADM-2026-006', first: 'Rhea', last: 'Sen', gender: 'FEMALE', classId: class10.id, secId: sec10A.id, parent: 'Amit Sen', phone: '+91 98111 00006', email: 'amit.sen@family.com' },
    { code: 'OAK-STU-007', adm: 'ADM-2026-007', first: 'Arjun', last: 'Deshmukh', gender: 'MALE', classId: class10.id, secId: sec10B.id, parent: 'Nitin Deshmukh', phone: '+91 98111 00007', email: 'n.deshmukh@family.com' },
    { code: 'OAK-STU-008', adm: 'ADM-2026-008', first: 'Tara', last: 'Kapoor', gender: 'FEMALE', classId: class10.id, secId: sec10B.id, parent: 'Sanjay Kapoor', phone: '+91 98111 00008', email: 's.kapoor@family.com' },
    { code: 'OAK-STU-009', adm: 'ADM-2026-009', first: 'Rohan', last: 'Bose', gender: 'MALE', classId: class9.id, secId: sec9A.id, parent: 'Sourav Bose', phone: '+91 98111 00009', email: 's.bose@family.com' },
    { code: 'OAK-STU-010', adm: 'ADM-2026-010', first: 'Myra', last: 'Chopra', gender: 'FEMALE', classId: class8.id, secId: sec8A.id, parent: 'Kunal Chopra', phone: '+91 98111 00010', email: 'k.chopra@family.com' },
  ];

  const students: Record<string, any> = {};
  for (const s of studentsRaw) {
    const stu = await prisma.student.upsert({
      where: { schoolId_studentCode: { schoolId: schoolA.id, studentCode: s.code } },
      update: {},
      create: {
        schoolId: schoolA.id,
        studentCode: s.code,
        admissionNo: s.adm,
        firstName: s.first,
        lastName: s.last,
        gender: s.gender,
        classId: s.classId,
        sectionId: s.secId,
        parentName: s.parent,
        parentPhone: s.phone,
        parentEmail: s.email,
        dob: new Date('2010-04-12'),
        address: 'Bandra West, Mumbai',
        bloodGroup: 'B+',
        status: 'ACTIVE',
      },
    });
    students[s.code] = stu;
  }
  console.log(`✓ ${studentsRaw.length} Students seeded across classes`);

  // 13. Seed Attendance Records for Today
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const sessionToday = await prisma.attendanceSession.upsert({
    where: {
      schoolId_classId_sectionId_date: {
        schoolId: schoolA.id,
        classId: class10.id,
        sectionId: sec10A.id,
        date: today,
      },
    },
    update: {},
    create: {
      schoolId: schoolA.id,
      academicYearId: academicYear.id,
      classId: class10.id,
      sectionId: sec10A.id,
      date: today,
      takenById: teacherMath.id,
    },
  });

  const class10AStudents = studentsRaw.filter((s) => s.secId === sec10A.id);
  for (let i = 0; i < class10AStudents.length; i++) {
    const s = class10AStudents[i];
    const stu = students[s.code];
    const status = i === 1 ? AttendanceStatus.ABSENT : i === 3 ? AttendanceStatus.LATE : AttendanceStatus.PRESENT;

    await prisma.studentAttendance.upsert({
      where: {
        sessionId_studentId: {
          sessionId: sessionToday.id,
          studentId: stu.id,
        },
      },
      update: {},
      create: {
        schoolId: schoolA.id,
        sessionId: sessionToday.id,
        studentId: stu.id,
        status,
        remarks: status === AttendanceStatus.ABSENT ? 'Medical leave notified' : null,
      },
    });
  }

  // Teacher Attendance for Today
  await prisma.teacherAttendance.upsert({
    where: { schoolId_teacherId_date: { schoolId: schoolA.id, teacherId: teacherMath.id, date: today } },
    update: {},
    create: {
      schoolId: schoolA.id,
      teacherId: teacherMath.id,
      date: today,
      status: AttendanceStatus.PRESENT,
      inTime: '08:10',
      outTime: '16:00',
    },
  });

  await prisma.teacherAttendance.upsert({
    where: { schoolId_teacherId_date: { schoolId: schoolA.id, teacherId: teacherSci.id, date: today } },
    update: {},
    create: {
      schoolId: schoolA.id,
      teacherId: teacherSci.id,
      date: today,
      status: AttendanceStatus.PRESENT,
      inTime: '08:15',
      outTime: '16:00',
    },
  });

  // 14. Seed Leave Management
  const leaveTypesData = [
    { name: 'Casual Leave', code: 'CL', daysAllowed: 12 },
    { name: 'Sick Leave', code: 'SL', daysAllowed: 10 },
    { name: 'Earned Leave', code: 'EL', daysAllowed: 15 },
  ];

  const leaveTypes: Record<string, any> = {};
  for (const lt of leaveTypesData) {
    const created = await prisma.leaveType.upsert({
      where: { schoolId_code: { schoolId: schoolA.id, code: lt.code } },
      update: {},
      create: { schoolId: schoolA.id, ...lt },
    });
    leaveTypes[lt.code] = created;

    // Balances for teachers
    for (const tch of [teacherMath, teacherSci, teacherEng]) {
      await prisma.leaveBalance.upsert({
        where: {
          schoolId_teacherId_leaveTypeId_academicYearId: {
            schoolId: schoolA.id,
            teacherId: tch.id,
            leaveTypeId: created.id,
            academicYearId: academicYear.id,
          },
        },
        update: {},
        create: {
          schoolId: schoolA.id,
          teacherId: tch.id,
          leaveTypeId: created.id,
          academicYearId: academicYear.id,
          allocatedDays: lt.daysAllowed,
          usedDays: tch.id === teacherSci.id ? 2 : 0,
        },
      });
    }
  }

  // Seed Leave Application: Dr. Rajesh Gupta requesting leave
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dayAfter = new Date();
  dayAfter.setDate(dayAfter.getDate() + 2);

  await prisma.leaveApplication.create({
    data: {
      schoolId: schoolA.id,
      teacherId: teacherSci.id,
      leaveTypeId: leaveTypes['CL'].id,
      startDate: tomorrow,
      endDate: dayAfter,
      reason: 'Attending National Physics Conference as guest panelist.',
      status: LeaveStatus.PENDING,
      substituteTeacherId: teacherMath.id,
    },
  });

  // Seed Approved Leave for Sarah Jenkins
  const lastWeekStart = new Date();
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);
  const lastWeekEnd = new Date();
  lastWeekEnd.setDate(lastWeekEnd.getDate() - 6);

  await prisma.leaveApplication.create({
    data: {
      schoolId: schoolA.id,
      teacherId: teacherEng.id,
      leaveTypeId: leaveTypes['SL'].id,
      startDate: lastWeekStart,
      endDate: lastWeekEnd,
      reason: 'Seasonal viral flu recovery',
      status: LeaveStatus.APPROVED,
      reviewedById: headMasterUser.id,
      reviewedAt: lastWeekStart,
    },
  });
  console.log('✓ Leave Types, Balances and Applications seeded');

  // 15. Seed Examinations & Marks
  const exam = await prisma.examination.create({
    data: {
      schoolId: schoolA.id,
      academicYearId: academicYear.id,
      name: 'Mid-Term Examination 2025-26',
      type: 'TERM',
      startDate: new Date('2025-10-10'),
      endDate: new Date('2025-10-25'),
      status: 'COMPLETED',
    },
  });

  const examMath = await prisma.examinationSubject.create({
    data: {
      schoolId: schoolA.id,
      examId: exam.id,
      classId: class10.id,
      subjectId: subjects['MATH-101'].id,
      examDate: new Date('2025-10-12'),
      startTime: '09:30',
      endTime: '12:30',
      maxMarks: 100,
      passMarks: 35,
    },
  });

  const examSci = await prisma.examinationSubject.create({
    data: {
      schoolId: schoolA.id,
      examId: exam.id,
      classId: class10.id,
      subjectId: subjects['PHY-101'].id,
      examDate: new Date('2025-10-14'),
      startTime: '09:30',
      endTime: '12:30',
      maxMarks: 100,
      passMarks: 35,
    },
  });

  // Seed marks for Class 10-A students in Math
  const sampleScores = [94, 88, 76, 92, 85, 79];
  for (let i = 0; i < class10AStudents.length; i++) {
    const s = class10AStudents[i];
    const score = sampleScores[i % sampleScores.length];
    const grade = score >= 90 ? 'A+' : score >= 80 ? 'A' : score >= 70 ? 'B+' : 'B';

    await prisma.studentMarks.create({
      data: {
        schoolId: schoolA.id,
        examSubjectId: examMath.id,
        studentId: students[s.code].id,
        marksObtained: score,
        grade,
        remarks: score >= 90 ? 'Outstanding grasp of topics' : 'Good conceptual clarity',
        status: MarksStatus.PUBLISHED,
      },
    });
  }

  // Math submission approved & published
  await prisma.marksSubmission.create({
    data: {
      schoolId: schoolA.id,
      examSubjectId: examMath.id,
      teacherId: teacherMath.id,
      status: MarksStatus.APPROVED,
      reviewedById: headMasterUser.id,
      reviewedAt: new Date('2025-10-26'),
      comments: 'Thoroughly checked, high standards maintained.',
    },
  });

  // Physics marks entered in DRAFT / SUBMITTED for Head Master moderation
  for (let i = 0; i < class10AStudents.length; i++) {
    const s = class10AStudents[i];
    const score = sampleScores[(i + 2) % sampleScores.length];
    const grade = score >= 90 ? 'A+' : score >= 80 ? 'A' : 'B+';

    await prisma.studentMarks.create({
      data: {
        schoolId: schoolA.id,
        examSubjectId: examSci.id,
        studentId: students[s.code].id,
        marksObtained: score,
        grade,
        remarks: 'Consistent lab performance',
        status: MarksStatus.SUBMITTED,
      },
    });
  }

  await prisma.marksSubmission.create({
    data: {
      schoolId: schoolA.id,
      examSubjectId: examSci.id,
      teacherId: teacherSci.id,
      status: MarksStatus.SUBMITTED,
      comments: 'Awaiting moderation from Head Master.',
    },
  });
  console.log('✓ Examinations, Subject papers and Moderation submissions seeded');

  // 16. Seed Fee Management
  const feeCategoriesData = [
    { name: 'Tuition Fee', description: 'Core academic coaching and laboratory infrastructure' },
    { name: 'Laboratory & Tech Fee', description: 'Computing equipment, science labs & internet' },
    { name: 'Library & Sports Fee', description: 'Sports facilities, ground maintenance & library' },
  ];

  const feeCats: Record<string, any> = {};
  for (const fc of feeCategoriesData) {
    const created = await prisma.feeCategory.upsert({
      where: { schoolId_name: { schoolId: schoolA.id, name: fc.name } },
      update: {},
      create: { schoolId: schoolA.id, ...fc },
    });
    feeCats[fc.name] = created;
  }

  // Fee Structure for Grade 10
  const tuitionStructure = await prisma.feeStructure.upsert({
    where: {
      schoolId_academicYearId_classId_categoryId: {
        schoolId: schoolA.id,
        academicYearId: academicYear.id,
        classId: class10.id,
        categoryId: feeCats['Tuition Fee'].id,
      },
    },
    update: {},
    create: {
      schoolId: schoolA.id,
      academicYearId: academicYear.id,
      classId: class10.id,
      categoryId: feeCats['Tuition Fee'].id,
      amount: 45000,
      frequency: 'ANNUAL',
      dueDate: new Date('2025-07-31'),
    },
  });

  const labStructure = await prisma.feeStructure.upsert({
    where: {
      schoolId_academicYearId_classId_categoryId: {
        schoolId: schoolA.id,
        academicYearId: academicYear.id,
        classId: class10.id,
        categoryId: feeCats['Laboratory & Tech Fee'].id,
      },
    },
    update: {},
    create: {
      schoolId: schoolA.id,
      academicYearId: academicYear.id,
      classId: class10.id,
      categoryId: feeCats['Laboratory & Tech Fee'].id,
      amount: 15000,
      frequency: 'ANNUAL',
      dueDate: new Date('2025-07-31'),
    },
  });

  // Assign StudentFee records and some payments
  for (let i = 0; i < class10AStudents.length; i++) {
    const s = class10AStudents[i];
    const stu = students[s.code];

    const isPaid = i < 4;
    const paidAmount = isPaid ? 45000 : i === 4 ? 20000 : 0;
    const balanceAmount = 45000 - paidAmount;
    const feeStatus = isPaid ? FeeStatus.PAID : i === 4 ? FeeStatus.PARTIAL : FeeStatus.UNPAID;

    const studentFee = await prisma.studentFee.upsert({
      where: { studentId_feeStructureId: { studentId: stu.id, feeStructureId: tuitionStructure.id } },
      update: {},
      create: {
        schoolId: schoolA.id,
        studentId: stu.id,
        feeStructureId: tuitionStructure.id,
        academicYearId: academicYear.id,
        amount: 45000,
        paidAmount,
        balanceAmount,
        status: feeStatus,
        dueDate: new Date('2025-07-31'),
      },
    });

    if (paidAmount > 0) {
      await prisma.feePayment.create({
        data: {
          schoolId: schoolA.id,
          studentFeeId: studentFee.id,
          receiptNumber: `OAK-REC-2026-${String(i + 1).padStart(4, '0')}`,
          amountPaid: paidAmount,
          paymentDate: new Date('2025-07-20'),
          paymentMethod: FeePaymentMethod.UPI,
          transactionRef: `UPI-REF-09827364${i}`,
          collectedById: officeAdminUser.id,
          remarks: 'Term 1 Fee collected in full with digital receipt',
        },
      });
    }
  }
  console.log('✓ Fee Categories, Structures, Student Fee obligations and receipts seeded');

  // 17. Seed Admissions & Office Documents
  await prisma.admissionApplication.create({
    data: {
      schoolId: schoolA.id,
      applicationNumber: 'APP-2026-0891',
      firstName: 'Kabir',
      lastName: 'Malhotra',
      gender: 'MALE',
      parentName: 'Sanjay Malhotra',
      parentPhone: '+91 98222 11001',
      parentEmail: 'sanjay.malhotra@corp.in',
      applyingClassId: class10.id,
      status: AdmissionStatus.PENDING,
      remarks: 'Transferred from Delhi CBSE school. Awaiting migration certificate verification.',
    },
  });

  await prisma.admissionApplication.create({
    data: {
      schoolId: schoolA.id,
      applicationNumber: 'APP-2026-0892',
      firstName: 'Isha',
      lastName: 'Suri',
      gender: 'FEMALE',
      parentName: 'Vikram Suri',
      parentPhone: '+91 98222 11002',
      parentEmail: 'v.suri@corp.in',
      applyingClassId: class9.id,
      status: AdmissionStatus.APPROVED,
      remarks: 'Entrance test cleared with 91%. Documents verified.',
    },
  });

  // Seed Student Documents
  const firstStudent = students['OAK-STU-001'];
  await prisma.studentDocument.create({
    data: {
      schoolId: schoolA.id,
      studentId: firstStudent.id,
      documentType: 'BIRTH_CERTIFICATE',
      documentName: 'Aarav_Sharma_BirthCert.pdf',
      fileUrl: 'https://storage.edusaas.com/oakridge/docs/birth_cert_001.pdf',
      status: DocumentStatus.VERIFIED,
      verifiedById: officeAdminUser.id,
      verifiedAt: new Date('2025-06-10'),
    },
  });

  // Seed Certificate
  await prisma.certificate.create({
    data: {
      schoolId: schoolA.id,
      studentId: firstStudent.id,
      certificateType: CertificateType.BONAFIDE,
      certificateNumber: 'CERT-BONA-2026-0042',
      issuedById: officeAdminUser.id,
      contentJson: {
        studentName: 'Aarav Sharma',
        class: 'Grade 10',
        section: 'Section A',
        admissionNo: 'ADM-2026-001',
        academicYear: '2025-2026',
        purpose: 'Passport Application Verification',
      },
    },
  });

  // 18. Seed Homework
  const dueInThreeDays = new Date();
  dueInThreeDays.setDate(dueInThreeDays.getDate() + 3);

  await prisma.homework.create({
    data: {
      schoolId: schoolA.id,
      teacherId: teacherMath.id,
      classId: class10.id,
      sectionId: sec10A.id,
      subjectId: subjects['MATH-101'].id,
      title: 'Chapter 5: Quadratic Equations Problem Set 5.2',
      description: 'Solve questions 1 through 15 from the standard textbook. Submit handwritten steps in class.',
      dueDate: dueInThreeDays,
    },
  });

  await prisma.homework.create({
    data: {
      schoolId: schoolA.id,
      teacherId: teacherSci.id,
      classId: class10.id,
      sectionId: sec10A.id,
      subjectId: subjects['PHY-101'].id,
      title: 'Refraction & Snell\'s Law Lab Report',
      description: 'Document laboratory experimental readings with ray diagrams and refractive index calculations.',
      dueDate: dueInThreeDays,
    },
  });

  // 19. Seed Academic Events
  const nextMonth = new Date();
  nextMonth.setMonth(nextMonth.getMonth() + 1);

  await prisma.academicEvent.createMany({
    data: [
      {
        schoolId: schoolA.id,
        academicYearId: academicYear.id,
        title: 'Annual Science & Robotics Exhibition',
        description: 'Inter-house technology and science model displays in the central auditorium.',
        eventType: AcademicEventType.SPORTS,
        startDate: nextMonth,
        endDate: nextMonth,
        targetAudience: 'ALL',
      },
      {
        schoolId: schoolA.id,
        academicYearId: academicYear.id,
        title: 'Term 2 Parent-Teacher Conference (PTM)',
        description: 'Mid-term academic review and report discussion between parents and faculty.',
        eventType: AcademicEventType.PTM,
        startDate: tomorrow,
        endDate: tomorrow,
        targetAudience: 'PARENTS',
      },
    ],
  });

  // 20. Seed School B & C for multi-tenant isolation testing
  const schoolB = await prisma.school.upsert({
    where: { code: 'STMARY-02' },
    update: {},
    create: {
      schoolId: 'SCH-2026-0002',
      name: "St. Mary's High School",
      code: 'STMARY-02',
      slug: 'st-marys-high-school',
      type: 'High School',
      board: 'ICSE',
      registrationNumber: 'REG-KA-2018-4421',
      establishedYear: 2005,
      website: 'https://stmarys.example.edu',
      status: SchoolStatus.ACTIVE,
      profile: {
        create: {
          officialEmail: 'contact@stmarys.example.edu',
          primaryPhone: '+91 80 2345 6789',
          contactPerson: 'Sister Evelyn Fernandez',
          address: '15 Convent Road, Richmond Town',
          city: 'Bengaluru',
          state: 'Karnataka',
          country: 'India',
          postalCode: '560025',
          workingDays: 'Monday,Tuesday,Wednesday,Thursday,Friday',
          mediumOfInstruction: 'English',
          timezone: 'Asia/Kolkata',
          currency: 'INR',
        },
      },
      subscription: {
        create: {
          planId: standardPlan.id,
          billingCycle: BillingCycle.MONTHLY,
          status: SubscriptionStatus.ACTIVE,
          startDate: new Date('2026-02-01'),
          endDate: new Date('2026-03-01'),
          autoRenew: true,
        },
      },
    },
  });

  await prisma.schoolUser.upsert({
    where: { schoolId_email: { schoolId: schoolB.id, email: 'admin@stmarys.example.edu' } },
    update: {},
    create: {
      schoolId: schoolB.id,
      email: 'admin@stmarys.example.edu',
      fullName: 'Sister Evelyn Fernandez',
      passwordHash: schoolAdminPass,
      role: SchoolRole.SCHOOL_ADMIN,
      status: UserStatus.ACTIVE,
      phone: '+91 80 2345 6789',
    },
  });

  const schoolC = await prisma.school.upsert({
    where: { code: 'GREENFIELD-03' },
    update: {},
    create: {
      schoolId: 'SCH-2026-0003',
      name: 'Greenfield Public School',
      code: 'GREENFIELD-03',
      slug: 'greenfield-public-school',
      type: 'Senior Secondary',
      board: 'State Board',
      registrationNumber: 'REG-DL-2015-8832',
      establishedYear: 2015,
      website: 'https://greenfield.example.edu',
      status: SchoolStatus.SUSPENDED,
      profile: {
        create: {
          officialEmail: 'office@greenfield.example.edu',
          primaryPhone: '+91 11 2789 0123',
          contactPerson: 'Mr. Rajesh Verma',
          address: 'Plot 18, Sector 12, Rohini',
          city: 'New Delhi',
          state: 'Delhi',
          country: 'India',
          postalCode: '110085',
          workingDays: 'Monday,Tuesday,Wednesday,Thursday,Friday,Saturday',
          mediumOfInstruction: 'English',
          timezone: 'Asia/Kolkata',
          currency: 'INR',
        },
      },
      subscription: {
        create: {
          planId: basicPlan.id,
          billingCycle: BillingCycle.MONTHLY,
          status: SubscriptionStatus.SUSPENDED,
          startDate: new Date('2025-11-01'),
          endDate: new Date('2025-12-01'),
          autoRenew: false,
        },
      },
    },
  });

  // Seed Audit Logs
  await prisma.auditLog.createMany({
    data: [
      {
        actorId: superAdmin.id,
        actorType: AuditActorType.PLATFORM_USER,
        actorEmail: superAdmin.email,
        action: 'PLATFORM_INITIALIZED',
        targetType: 'PLATFORM',
        metadata: { version: '1.0.0', initializedBy: 'SeedScript' },
      },
      {
        actorId: schoolAdminUser.id,
        actorType: AuditActorType.SCHOOL_USER,
        actorEmail: schoolAdminUser.email,
        action: 'SCHOOL_STAFF_PROVISIONED',
        targetType: 'STAFF',
        targetId: headMasterUser.id,
        tenantId: schoolA.id,
        metadata: { role: 'HEAD_MASTER' },
      },
      {
        actorId: teacherUserMath.id,
        actorType: AuditActorType.SCHOOL_USER,
        actorEmail: teacherUserMath.email,
        action: 'ATTENDANCE_MARKED',
        targetType: 'ATTENDANCE',
        targetId: sessionToday.id,
        tenantId: schoolA.id,
        metadata: { class: 'Grade 10', section: 'A' },
      },
    ],
  });

  console.log('✓ Successfully seeded complete multi-tenant dataset for all roles!');
  console.log('Credentials:');
  console.log('  Super Admin:  superadmin@edusaas.com / SuperAdmin@2026!');
  console.log('  School Admin: admin@oakridge.example.edu / OakridgeAdmin@2026!');
  console.log('  Head Master:  headmaster@oakridge.example.edu / HeadMaster@2026!');
  console.log('  Office Admin: office@oakridge.example.edu / OfficeAdmin@2026!');
  console.log('  Teacher:      teacher.math@oakridge.example.edu / Teacher@2026!');
}

main()
  .catch((e) => {
    console.error('Error during database seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
