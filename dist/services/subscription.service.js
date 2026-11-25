"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.subscriptionService = exports.SubscriptionService = void 0;
const database_1 = require("../config/database");
const audit_1 = require("../utils/audit");
const sockets_1 = require("../sockets");
const client_1 = require("@prisma/client");
class SubscriptionService {
    async listPlans() {
        return database_1.prisma.subscriptionPlan.findMany({
            orderBy: { sortOrder: 'asc' },
            include: {
                features: {
                    include: { feature: true },
                },
                _count: {
                    select: { subscriptions: true },
                },
            },
        });
    }
    async createPlan(data, actorId, actorEmail) {
        const { features, ...planData } = data;
        const plan = await database_1.prisma.$transaction(async (tx) => {
            const p = await tx.subscriptionPlan.create({
                data: planData,
            });
            if (features && features.length > 0) {
                for (const featCode of features) {
                    await tx.subscriptionFeature.create({
                        data: {
                            planId: p.id,
                            featureCode: featCode,
                            isEnabled: true,
                        },
                    });
                }
            }
            await (0, audit_1.createAuditLog)({
                actorId,
                actorType: client_1.AuditActorType.PLATFORM_USER,
                actorEmail,
                action: 'PLAN_CREATED',
                targetType: 'SUBSCRIPTION_PLAN',
                targetId: p.id,
                metadata: { name: p.name, code: p.code },
                tx,
            });
            return p;
        });
        return plan;
    }
    async updatePlan(id, data, actorId, actorEmail) {
        const { features, ...planData } = data;
        const plan = await database_1.prisma.$transaction(async (tx) => {
            const p = await tx.subscriptionPlan.update({
                where: { id },
                data: planData,
            });
            if (features) {
                await tx.subscriptionFeature.deleteMany({ where: { planId: id } });
                for (const featCode of features) {
                    await tx.subscriptionFeature.create({
                        data: {
                            planId: id,
                            featureCode: featCode,
                            isEnabled: true,
                        },
                    });
                }
            }
            await (0, audit_1.createAuditLog)({
                actorId,
                actorType: client_1.AuditActorType.PLATFORM_USER,
                actorEmail,
                action: 'PLAN_UPDATED',
                targetType: 'SUBSCRIPTION_PLAN',
                targetId: id,
                metadata: { name: p.name },
                tx,
            });
            return p;
        });
        return plan;
    }
    async listSubscriptions(options) {
        const { search, status, page = 1, limit = 10 } = options;
        const skip = (page - 1) * limit;
        const where = {};
        if (status)
            where.status = status;
        if (search) {
            where.school = {
                OR: [
                    { name: { contains: search, mode: 'insensitive' } },
                    { schoolId: { contains: search, mode: 'insensitive' } },
                ],
            };
        }
        const [subscriptions, total] = await Promise.all([
            database_1.prisma.subscription.findMany({
                where,
                skip,
                take: limit,
                orderBy: { endDate: 'asc' },
                include: {
                    school: {
                        select: {
                            id: true,
                            name: true,
                            schoolId: true,
                            status: true,
                            _count: { select: { students: true, teachers: true } },
                        },
                    },
                    plan: true,
                },
            }),
            database_1.prisma.subscription.count({ where }),
        ]);
        return { subscriptions, total };
    }
    async renewSubscription(id, data, actorId, actorEmail) {
        const currentSub = await database_1.prisma.subscription.findUnique({
            where: { id },
            include: { school: true, plan: true },
        });
        if (!currentSub)
            throw new Error('Subscription not found');
        const extensionMonths = data.extensionMonths || (data.billingCycle === 'ANNUAL' ? 12 : data.billingCycle === 'QUARTERLY' ? 3 : 1);
        const newPlanId = data.planId || currentSub.planId;
        const plan = await database_1.prisma.subscriptionPlan.findUnique({ where: { id: newPlanId } });
        if (!plan)
            throw new Error('Selected plan not found');
        // Calculate new end date (extend from current endDate if it is in future, or from now)
        const baseDate = currentSub.endDate > new Date() ? currentSub.endDate : new Date();
        const newEndDate = new Date(baseDate);
        newEndDate.setMonth(newEndDate.getMonth() + extensionMonths);
        const price = extensionMonths === 12
            ? plan.annualPrice
            : extensionMonths === 3
                ? plan.quarterlyPrice
                : plan.monthlyPrice * extensionMonths;
        const result = await database_1.prisma.$transaction(async (tx) => {
            // 1. Update Subscription
            const sub = await tx.subscription.update({
                where: { id },
                data: {
                    planId: newPlanId,
                    status: client_1.SubscriptionStatus.ACTIVE,
                    endDate: newEndDate,
                    billingCycle: data.billingCycle || currentSub.billingCycle,
                },
            });
            // 2. Record Completed Payment
            const txnId = `TXN-RNW-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
            const payment = await tx.payment.create({
                data: {
                    schoolId: currentSub.schoolId,
                    subscriptionId: id,
                    transactionId: txnId,
                    orderId: `order_rnw_${Date.now()}`,
                    paymentProvider: 'RAZORPAY',
                    amount: price,
                    currency: 'INR',
                    status: client_1.PaymentStatus.COMPLETED,
                    paymentMethod: 'UPI',
                },
            });
            // 3. Issue Paid Invoice
            const invNum = `INV-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;
            const tax = price * 0.18;
            const invoice = await tx.invoice.create({
                data: {
                    schoolId: currentSub.schoolId,
                    paymentId: payment.id,
                    subscriptionId: id,
                    invoiceNumber: invNum,
                    amount: price,
                    tax,
                    totalAmount: price + tax,
                    status: client_1.InvoiceStatus.PAID,
                    dueDate: new Date(),
                    paidAt: new Date(),
                    lineItems: [
                        {
                            description: `Subscription Renewal - ${plan.name} (${extensionMonths} months)`,
                            amount: price,
                            total: price,
                        },
                    ],
                },
            });
            // 4. Create Audit Log
            await (0, audit_1.createAuditLog)({
                actorId,
                actorType: client_1.AuditActorType.PLATFORM_USER,
                actorEmail,
                action: 'SUBSCRIPTION_RENEWED',
                targetType: 'SUBSCRIPTION',
                targetId: id,
                tenantId: currentSub.schoolId,
                metadata: {
                    previousEndDate: currentSub.endDate,
                    newEndDate,
                    planName: plan.name,
                    amount: price,
                },
                tx,
            });
            return { sub, payment, invoice };
        });
        (0, sockets_1.broadcastToSuperAdmins)('subscription:renewed', {
            schoolId: currentSub.schoolId,
            newEndDate,
        });
        (0, sockets_1.broadcastToTenant)(currentSub.schoolId, 'tenant:subscription_updated', {
            status: client_1.SubscriptionStatus.ACTIVE,
            endDate: newEndDate,
        });
        return result;
    }
    // Multi-tenant limit enforcement helper
    async checkTenantQuota(schoolId, resource) {
        const subscription = await database_1.prisma.subscription.findUnique({
            where: { schoolId },
            include: { plan: true },
        });
        if (!subscription || subscription.status !== client_1.SubscriptionStatus.ACTIVE) {
            throw new Error('Active subscription is required to add school members.');
        }
        if (resource === 'student') {
            const maxStudents = subscription.maxStudentsOverride || subscription.plan.maxStudents;
            const currentCount = await database_1.prisma.student.count({ where: { schoolId } });
            if (currentCount >= maxStudents) {
                throw new Error(`Subscription student quota exceeded. Maximum allowed: ${maxStudents}, Current count: ${currentCount}. Please upgrade your subscription plan.`);
            }
        }
        else if (resource === 'teacher') {
            const maxTeachers = subscription.maxTeachersOverride || subscription.plan.maxTeachers;
            const currentCount = await database_1.prisma.teacher.count({ where: { schoolId } });
            if (currentCount >= maxTeachers) {
                throw new Error(`Subscription teacher quota exceeded. Maximum allowed: ${maxTeachers}, Current count: ${currentCount}. Please upgrade your subscription plan.`);
            }
        }
    }
}
exports.SubscriptionService = SubscriptionService;
exports.subscriptionService = new SubscriptionService();
