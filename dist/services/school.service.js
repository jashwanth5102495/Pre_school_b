"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.schoolService = exports.SchoolService = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const crypto_1 = __importDefault(require("crypto"));
const database_1 = require("../config/database");
const school_id_1 = require("../utils/school-id");
const audit_1 = require("../utils/audit");
const sockets_1 = require("../sockets");
const client_1 = require("@prisma/client");
class SchoolService {
    async listSchools(options) {
        const { search, status, planId, sortBy = 'createdAt', sortOrder = 'desc', page = 1, limit = 10, } = options;
        const skip = (page - 1) * limit;
        const where = {};
        if (status) {
            where.status = status;
        }
        if (planId) {
            where.subscription = { planId };
        }
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { code: { contains: search, mode: 'insensitive' } },
                { schoolId: { contains: search, mode: 'insensitive' } },
                { profile: { contactPerson: { contains: search, mode: 'insensitive' } } },
                { profile: { officialEmail: { contains: search, mode: 'insensitive' } } },
                { profile: { city: { contains: search, mode: 'insensitive' } } },
            ];
        }
        const [schools, total] = await Promise.all([
            database_1.prisma.school.findMany({
                where,
                skip,
                take: limit,
                orderBy: { [sortBy]: sortOrder },
                include: {
                    profile: true,
                    subscription: {
                        include: { plan: true },
                    },
                    _count: {
                        select: {
                            students: true,
                            teachers: true,
                            users: true,
                        },
                    },
                },
            }),
            database_1.prisma.school.count({ where }),
        ]);
        return { schools, total };
    }
    async getSchoolById(id) {
        const school = await database_1.prisma.school.findFirst({
            where: {
                OR: [{ id }, { schoolId: id }],
            },
            include: {
                profile: true,
                subscription: {
                    include: {
                        plan: {
                            include: {
                                features: {
                                    include: { feature: true },
                                },
                            },
                        },
                    },
                },
                featureOverrides: {
                    include: { feature: true },
                },
                users: {
                    select: {
                        id: true,
                        email: true,
                        fullName: true,
                        phone: true,
                        role: true,
                        status: true,
                        lastLoginAt: true,
                        createdAt: true,
                    },
                },
                academicYears: true,
                _count: {
                    select: {
                        students: true,
                        teachers: true,
                        classes: true,
                        sections: true,
                        payments: true,
                        invoices: true,
                    },
                },
            },
        });
        if (!school) {
            throw new Error('School not found');
        }
        return school;
    }
    async provisionSchool(data, actorId, actorEmail) {
        // 1. Verify plan exists
        const plan = await database_1.prisma.subscriptionPlan.findUnique({
            where: { id: data.planId },
        });
        if (!plan) {
            throw new Error('Selected subscription plan not found');
        }
        // 2. Check for duplicate code or email
        const existingCode = await database_1.prisma.school.findUnique({
            where: { code: data.code.toUpperCase() },
        });
        if (existingCode) {
            throw new Error(`School with code "${data.code}" already exists.`);
        }
        // 3. Compute Dates
        const startDate = data.startDate ? new Date(data.startDate) : new Date();
        const endDate = new Date(startDate);
        if (data.billingCycle === client_1.BillingCycle.MONTHLY) {
            endDate.setMonth(endDate.getMonth() + 1);
        }
        else if (data.billingCycle === client_1.BillingCycle.QUARTERLY) {
            endDate.setMonth(endDate.getMonth() + 3);
        }
        else {
            endDate.setFullYear(endDate.getFullYear() + 1);
        }
        // 4. Generate Unique School ID
        const schoolId = await (0, school_id_1.generateUniqueSchoolId)();
        const slug = data.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)+/g, '');
        // 5. Generate secure activation token and password hash
        const activationToken = crypto_1.default.randomBytes(32).toString('hex');
        const defaultPassword = data.adminPassword || 'TempPass@2026!';
        const passwordHash = await bcryptjs_1.default.hash(defaultPassword, 12);
        // 6. Execute atomic transaction
        const result = await database_1.prisma.$transaction(async (tx) => {
            // Step A: Create School Tenant
            const school = await tx.school.create({
                data: {
                    schoolId,
                    name: data.name,
                    code: data.code.toUpperCase(),
                    slug: `${slug}-${schoolId.toLowerCase()}`,
                    type: data.type,
                    board: data.board,
                    registrationNumber: data.registrationNumber,
                    establishedYear: data.establishedYear,
                    website: data.website || null,
                    logoUrl: data.logoUrl || null,
                    status: client_1.SchoolStatus.ACTIVE,
                },
            });
            // Step B: Create School Profile
            await tx.schoolProfile.create({
                data: {
                    schoolId: school.id,
                    officialEmail: data.officialEmail,
                    primaryPhone: data.primaryPhone,
                    alternatePhone: data.alternatePhone || null,
                    contactPerson: data.contactPerson,
                    address: data.address,
                    city: data.city,
                    state: data.state,
                    country: data.country || 'India',
                    postalCode: data.postalCode,
                    workingDays: Array.isArray(data.workingDays)
                        ? data.workingDays.join(',')
                        : data.workingDays,
                    mediumOfInstruction: data.mediumOfInstruction,
                },
            });
            // Step C: Create Initial School Admin
            const schoolAdmin = await tx.schoolUser.create({
                data: {
                    schoolId: school.id,
                    email: data.adminEmail.toLowerCase(),
                    fullName: data.adminFullName,
                    phone: data.adminPhone,
                    passwordHash,
                    role: client_1.SchoolRole.SCHOOL_ADMIN,
                    status: client_1.UserStatus.ACTIVE,
                },
            });
            // Step D: Create Subscription Record
            const subscription = await tx.subscription.create({
                data: {
                    schoolId: school.id,
                    planId: plan.id,
                    billingCycle: data.billingCycle,
                    status: client_1.SubscriptionStatus.ACTIVE,
                    startDate,
                    endDate,
                    maxStudentsOverride: data.maxStudentsOverride || null,
                    maxTeachersOverride: data.maxTeachersOverride || null,
                    autoRenew: true,
                },
            });
            // Step E: Create Invitation Token
            const invitation = await tx.schoolInvitation.create({
                data: {
                    schoolId: school.id,
                    email: data.adminEmail.toLowerCase(),
                    role: client_1.SchoolRole.SCHOOL_ADMIN,
                    token: activationToken,
                    expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
                    invitedBy: actorId,
                },
            });
            // Step F: Create Initial Academic Year
            await tx.academicYear.create({
                data: {
                    schoolId: school.id,
                    name: data.academicYear,
                    startDate,
                    endDate,
                    isCurrent: true,
                    status: 'ACTIVE',
                },
            });
            // Step G: Record Audit Log
            await (0, audit_1.createAuditLog)({
                actorId,
                actorType: client_1.AuditActorType.PLATFORM_USER,
                actorEmail,
                action: 'SCHOOL_PROVISIONED',
                targetType: 'SCHOOL',
                targetId: school.id,
                tenantId: school.id,
                metadata: {
                    schoolName: school.name,
                    schoolId: school.schoolId,
                    planName: plan.name,
                    adminEmail: schoolAdmin.email,
                },
                tx,
            });
            return {
                school,
                schoolAdmin,
                subscription,
                invitation,
            };
        });
        // 7. Real-time broadcast
        (0, sockets_1.broadcastToSuperAdmins)('school:created', {
            schoolId: result.school.id,
            name: result.school.name,
            code: result.school.code,
            schoolDisplayId: result.school.schoolId,
            createdAt: result.school.createdAt,
        });
        return {
            ...result,
            activationToken,
        };
    }
    async updateSchool(id, data, actorId, actorEmail) {
        const school = await database_1.prisma.school.findUnique({
            where: { id },
            include: { profile: true },
        });
        if (!school)
            throw new Error('School not found');
        const updated = await database_1.prisma.$transaction(async (tx) => {
            const s = await tx.school.update({
                where: { id },
                data: {
                    name: data.name ?? undefined,
                    type: data.type ?? undefined,
                    board: data.board ?? undefined,
                    website: data.website ?? undefined,
                    logoUrl: data.logoUrl ?? undefined,
                },
            });
            if (data.officialEmail || data.primaryPhone || data.contactPerson || data.address || data.city || data.state || data.postalCode) {
                await tx.schoolProfile.update({
                    where: { schoolId: id },
                    data: {
                        officialEmail: data.officialEmail ?? undefined,
                        primaryPhone: data.primaryPhone ?? undefined,
                        contactPerson: data.contactPerson ?? undefined,
                        address: data.address ?? undefined,
                        city: data.city ?? undefined,
                        state: data.state ?? undefined,
                        postalCode: data.postalCode ?? undefined,
                    },
                });
            }
            await (0, audit_1.createAuditLog)({
                actorId,
                actorType: client_1.AuditActorType.PLATFORM_USER,
                actorEmail,
                action: 'SCHOOL_UPDATED',
                targetType: 'SCHOOL',
                targetId: id,
                tenantId: id,
                metadata: { changes: data },
                tx,
            });
            return s;
        });
        (0, sockets_1.broadcastToSuperAdmins)('school:updated', { schoolId: id });
        return updated;
    }
    async updateSchoolStatus(id, status, reason, actorId, actorEmail) {
        const school = await database_1.prisma.school.findUnique({ where: { id } });
        if (!school)
            throw new Error('School not found');
        const updated = await database_1.prisma.$transaction(async (tx) => {
            const s = await tx.school.update({
                where: { id },
                data: { status },
            });
            // Synchronize subscription status if suspended or reactivated
            if (status === client_1.SchoolStatus.SUSPENDED) {
                await tx.subscription.updateMany({
                    where: { schoolId: id },
                    data: { status: client_1.SubscriptionStatus.SUSPENDED },
                });
            }
            else if (status === client_1.SchoolStatus.ACTIVE) {
                await tx.subscription.updateMany({
                    where: { schoolId: id, status: client_1.SubscriptionStatus.SUSPENDED },
                    data: { status: client_1.SubscriptionStatus.ACTIVE },
                });
            }
            await (0, audit_1.createAuditLog)({
                actorId,
                actorType: client_1.AuditActorType.PLATFORM_USER,
                actorEmail,
                action: `SCHOOL_STATUS_${status}`,
                targetType: 'SCHOOL',
                targetId: id,
                tenantId: id,
                metadata: { previousStatus: school.status, newStatus: status, reason },
                tx,
            });
            return s;
        });
        (0, sockets_1.broadcastToSuperAdmins)('school:status_updated', { schoolId: id, status, reason });
        (0, sockets_1.broadcastToTenant)(id, 'tenant:status_changed', { status, reason });
        return updated;
    }
    async resendInvitation(schoolId, actorId, actorEmail) {
        const school = await database_1.prisma.school.findUnique({
            where: { id: schoolId },
            include: {
                users: { where: { role: client_1.SchoolRole.SCHOOL_ADMIN } },
            },
        });
        if (!school || school.users.length === 0) {
            throw new Error('School or Admin user not found');
        }
        const admin = school.users[0];
        const newToken = crypto_1.default.randomBytes(32).toString('hex');
        const invitation = await database_1.prisma.schoolInvitation.create({
            data: {
                schoolId,
                email: admin.email,
                role: client_1.SchoolRole.SCHOOL_ADMIN,
                token: newToken,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                invitedBy: actorId,
            },
        });
        await (0, audit_1.createAuditLog)({
            actorId,
            actorType: client_1.AuditActorType.PLATFORM_USER,
            actorEmail,
            action: 'INVITATION_RESENT',
            targetType: 'SCHOOL_INVITATION',
            targetId: invitation.id,
            tenantId: schoolId,
            metadata: { email: admin.email },
        });
        return { token: newToken, email: admin.email };
    }
    async archiveSchool(id, actorId, actorEmail) {
        return this.updateSchoolStatus(id, client_1.SchoolStatus.ARCHIVED, 'School archived by Super Admin', actorId, actorEmail);
    }
}
exports.SchoolService = SchoolService;
exports.schoolService = new SchoolService();
