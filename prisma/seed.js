"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma = new client_1.PrismaClient();
async function main() {
    console.log('--- SEEDING DATABASE ---');
    // 1. Seed Super Admin Platform User
    const passwordHash = await bcryptjs_1.default.hash('SuperAdmin@2026!', 12);
    const superAdmin = await prisma.platformUser.upsert({
        where: { email: 'superadmin@edusaas.com' },
        update: {},
        create: {
            email: 'superadmin@edusaas.com',
            passwordHash,
            fullName: 'System Super Admin',
            role: client_1.PlatformRole.SUPER_ADMIN,
            status: client_1.UserStatus.ACTIVE,
            phone: '+1 555-019-2831',
        },
    });
    console.log(`✓ Super Admin seeded: ${superAdmin.email}`);
    // Also seed a Platform Support user
    await prisma.platformUser.upsert({
        where: { email: 'support@edusaas.com' },
        update: {},
        create: {
            email: 'support@edusaas.com',
            passwordHash,
            fullName: 'Platform Operations Lead',
            role: client_1.PlatformRole.PLATFORM_SUPPORT,
            status: client_1.UserStatus.ACTIVE,
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
            maxStorageMb: 10240, // 10 GB
            maxBranches: 1,
            supportLevel: 'Standard Email',
            trialDays: 14,
            isTrialAvailable: true,
            status: client_1.SchoolStatus.ACTIVE,
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
            maxStorageMb: 51200, // 50 GB
            maxBranches: 1,
            supportLevel: 'Priority Email & Chat',
            trialDays: 14,
            isTrialAvailable: true,
            status: client_1.SchoolStatus.ACTIVE,
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
            maxStorageMb: 204800, // 200 GB
            maxBranches: 3,
            supportLevel: 'Dedicated Relationship Manager',
            trialDays: 14,
            isTrialAvailable: true,
            status: client_1.SchoolStatus.ACTIVE,
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
            maxStorageMb: 1024000, // 1 TB
            maxBranches: 10,
            supportLevel: '24/7 Phone & Priority SLA',
            trialDays: 30,
            isTrialAvailable: true,
            status: client_1.SchoolStatus.ACTIVE,
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
        // Link features to plan
        for (const feat of features) {
            // Basic skips transport & custom reports
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
    // 4. Seed 3 Live Realistic Schools
    const standardPlan = createdPlans.find((p) => p.code === 'standard');
    const premiumPlan = createdPlans.find((p) => p.code === 'premium');
    const basicPlan = createdPlans.find((p) => p.code === 'basic');
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
            status: client_1.SchoolStatus.ACTIVE,
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
                    billingCycle: client_1.BillingCycle.ANNUAL,
                    status: client_1.SubscriptionStatus.ACTIVE,
                    startDate: new Date('2026-01-01'),
                    endDate: new Date('2027-01-01'),
                    autoRenew: true,
                },
            },
        },
    });
    // Seed School Admin User for Oakridge
    const schoolAdminPass = await bcryptjs_1.default.hash('OakridgeAdmin@2026!', 12);
    await prisma.schoolUser.upsert({
        where: {
            schoolId_email: {
                schoolId: schoolA.id,
                email: 'admin@oakridge.example.edu',
            },
        },
        update: {},
        create: {
            schoolId: schoolA.id,
            email: 'admin@oakridge.example.edu',
            fullName: 'Principal Arthur Pendelton',
            passwordHash: schoolAdminPass,
            role: client_1.SchoolRole.SCHOOL_ADMIN,
            status: client_1.UserStatus.ACTIVE,
            phone: '+91 98201 12345',
        },
    });
    // Seed a couple of students and teachers for Oakridge to demonstrate tenant records
    const class10 = await prisma.schoolClass.upsert({
        where: {
            schoolId_code: {
                schoolId: schoolA.id,
                code: 'GRADE-10',
            },
        },
        update: {},
        create: {
            schoolId: schoolA.id,
            name: 'Grade 10',
            code: 'GRADE-10',
        },
    });
    const sectionA = await prisma.schoolSection.upsert({
        where: {
            schoolId_classId_name: {
                schoolId: schoolA.id,
                classId: class10.id,
                name: 'Section A',
            },
        },
        update: {},
        create: {
            schoolId: schoolA.id,
            classId: class10.id,
            name: 'Section A',
            capacity: 35,
        },
    });
    await prisma.student.upsert({
        where: {
            schoolId_studentCode: {
                schoolId: schoolA.id,
                studentCode: 'OAK-STU-001',
            },
        },
        update: {},
        create: {
            schoolId: schoolA.id,
            studentCode: 'OAK-STU-001',
            admissionNo: 'ADM-2026-001',
            firstName: 'Aarav',
            lastName: 'Sharma',
            email: 'aarav.sharma@student.oakridge.edu',
            classId: class10.id,
            sectionId: sectionA.id,
            status: 'ACTIVE',
        },
    });
    await prisma.teacher.upsert({
        where: {
            schoolId_teacherCode: {
                schoolId: schoolA.id,
                teacherCode: 'OAK-TCH-001',
            },
        },
        update: {},
        create: {
            schoolId: schoolA.id,
            teacherCode: 'OAK-TCH-001',
            firstName: 'Meera',
            lastName: 'Nair',
            email: 'meera.nair@oakridge.edu',
            designation: 'Head of Mathematics',
            status: 'ACTIVE',
        },
    });
    // Seed Payment & Invoice for Oakridge
    const oakridgeSub = await prisma.subscription.findUnique({ where: { schoolId: schoolA.id } });
    const paymentA = await prisma.payment.upsert({
        where: { transactionId: 'TXN-OAK-2026-001' },
        update: {},
        create: {
            schoolId: schoolA.id,
            subscriptionId: oakridgeSub?.id,
            transactionId: 'TXN-OAK-2026-001',
            orderId: 'order_oakridge_ann_2026',
            paymentProvider: 'RAZORPAY',
            amount: premiumPlan.annualPrice,
            currency: 'INR',
            status: client_1.PaymentStatus.COMPLETED,
            paymentMethod: 'UPI',
            razorpayPaymentId: 'pay_oak_rzp_mock_111',
            razorpayOrderId: 'order_oakridge_ann_2026',
            razorpaySignature: 'sig_mock_verified_001',
        },
    });
    await prisma.invoice.upsert({
        where: { invoiceNumber: 'INV-2026-0001' },
        update: {},
        create: {
            schoolId: schoolA.id,
            paymentId: paymentA.id,
            subscriptionId: oakridgeSub?.id,
            invoiceNumber: 'INV-2026-0001',
            amount: premiumPlan.annualPrice,
            tax: premiumPlan.annualPrice * 0.18,
            totalAmount: premiumPlan.annualPrice * 1.18,
            status: client_1.InvoiceStatus.PAID,
            dueDate: new Date('2026-01-15'),
            paidAt: new Date('2026-01-02'),
            lineItems: [
                {
                    description: 'Premium Institutional Annual Plan',
                    qty: 1,
                    unitPrice: premiumPlan.annualPrice,
                    total: premiumPlan.annualPrice,
                },
            ],
        },
    });
    // School B: St. Mary's High School (Standard, Active)
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
            status: client_1.SchoolStatus.ACTIVE,
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
                    billingCycle: client_1.BillingCycle.MONTHLY,
                    status: client_1.SubscriptionStatus.ACTIVE,
                    startDate: new Date('2026-02-01'),
                    endDate: new Date('2026-03-01'),
                    autoRenew: true,
                },
            },
        },
    });
    await prisma.schoolUser.upsert({
        where: {
            schoolId_email: {
                schoolId: schoolB.id,
                email: 'admin@stmarys.example.edu',
            },
        },
        update: {},
        create: {
            schoolId: schoolB.id,
            email: 'admin@stmarys.example.edu',
            fullName: 'Sister Evelyn Fernandez',
            passwordHash: schoolAdminPass,
            role: client_1.SchoolRole.SCHOOL_ADMIN,
            status: client_1.UserStatus.ACTIVE,
            phone: '+91 80 2345 6789',
        },
    });
    const stmarySub = await prisma.subscription.findUnique({ where: { schoolId: schoolB.id } });
    const paymentB = await prisma.payment.upsert({
        where: { transactionId: 'TXN-STM-2026-001' },
        update: {},
        create: {
            schoolId: schoolB.id,
            subscriptionId: stmarySub?.id,
            transactionId: 'TXN-STM-2026-001',
            orderId: 'order_stmary_mth_2026',
            paymentProvider: 'RAZORPAY',
            amount: standardPlan.monthlyPrice,
            currency: 'INR',
            status: client_1.PaymentStatus.COMPLETED,
            paymentMethod: 'NETBANKING',
            razorpayPaymentId: 'pay_stm_rzp_mock_222',
        },
    });
    await prisma.invoice.upsert({
        where: { invoiceNumber: 'INV-2026-0002' },
        update: {},
        create: {
            schoolId: schoolB.id,
            paymentId: paymentB.id,
            subscriptionId: stmarySub?.id,
            invoiceNumber: 'INV-2026-0002',
            amount: standardPlan.monthlyPrice,
            tax: standardPlan.monthlyPrice * 0.18,
            totalAmount: standardPlan.monthlyPrice * 1.18,
            status: client_1.InvoiceStatus.PAID,
            dueDate: new Date('2026-02-15'),
            paidAt: new Date('2026-02-02'),
            lineItems: [
                {
                    description: 'Standard Growth Monthly Subscription',
                    qty: 1,
                    unitPrice: standardPlan.monthlyPrice,
                    total: standardPlan.monthlyPrice,
                },
            ],
        },
    });
    // School C: Greenfield Public School (Suspended / Past Due)
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
            status: client_1.SchoolStatus.SUSPENDED,
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
                    billingCycle: client_1.BillingCycle.MONTHLY,
                    status: client_1.SubscriptionStatus.SUSPENDED,
                    startDate: new Date('2025-11-01'),
                    endDate: new Date('2025-12-01'),
                    autoRenew: false,
                },
            },
        },
    });
    // 5. Seed Initial Audit Logs
    await prisma.auditLog.createMany({
        data: [
            {
                actorId: superAdmin.id,
                actorType: client_1.AuditActorType.PLATFORM_USER,
                actorEmail: superAdmin.email,
                action: 'PLATFORM_INITIALIZED',
                targetType: 'PLATFORM',
                metadata: { version: '1.0.0', initializedBy: 'SeedScript' },
            },
            {
                actorId: superAdmin.id,
                actorType: client_1.AuditActorType.PLATFORM_USER,
                actorEmail: superAdmin.email,
                action: 'SCHOOL_PROVISIONED',
                targetType: 'SCHOOL',
                targetId: schoolA.id,
                tenantId: schoolA.id,
                metadata: { schoolName: schoolA.name, planCode: 'premium' },
            },
            {
                actorId: superAdmin.id,
                actorType: client_1.AuditActorType.PLATFORM_USER,
                actorEmail: superAdmin.email,
                action: 'SCHOOL_SUSPENDED',
                targetType: 'SCHOOL',
                targetId: schoolC.id,
                tenantId: schoolC.id,
                metadata: { reason: 'Subscription past due exceeded grace period' },
            },
        ],
    });
    // 6. Seed System Notifications
    await prisma.notification.createMany({
        data: [
            {
                targetType: 'ALL',
                title: 'Platform Maintenance Notice',
                message: 'Scheduled infrastructure upgrade will occur this Sunday at 02:00 UTC.',
                severity: 'INFO',
                channels: 'IN_APP',
                senderId: superAdmin.id,
            },
            {
                targetType: 'EXPIRING_SOON',
                title: 'Upcoming Subscription Expiry',
                message: 'Your school subscription is due for renewal within 7 business days.',
                severity: 'WARNING',
                channels: 'IN_APP,EMAIL',
                senderId: superAdmin.id,
            },
        ],
    });
    console.log('✓ Initial Schools, Users, Payments, Invoices, Audit Logs & Notifications seeded successfully!');
    console.log('----------------------------------------------------');
}
main()
    .catch((e) => {
    console.error('Error during database seed:', e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
