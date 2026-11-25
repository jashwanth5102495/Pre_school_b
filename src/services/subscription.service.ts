import { prisma } from '../config/database';
import { createAuditLog } from '../utils/audit';
import { broadcastToSuperAdmins, broadcastToTenant } from '../sockets';
import {
  SubscriptionStatus,
  BillingCycle,
  AuditActorType,
  PaymentStatus,
  InvoiceStatus,
  SchoolStatus,
} from '@prisma/client';

export class SubscriptionService {
  async listPlans() {
    return prisma.subscriptionPlan.findMany({
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

  async createPlan(data: any, actorId: string, actorEmail: string) {
    const { features, ...planData } = data;

    const plan = await prisma.$transaction(async (tx) => {
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

      await createAuditLog({
        actorId,
        actorType: AuditActorType.PLATFORM_USER,
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

  async updatePlan(id: string, data: any, actorId: string, actorEmail: string) {
    const { features, ...planData } = data;

    const plan = await prisma.$transaction(async (tx) => {
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

      await createAuditLog({
        actorId,
        actorType: AuditActorType.PLATFORM_USER,
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

  async listSubscriptions(options: { search?: string; status?: SubscriptionStatus; page?: number; limit?: number }) {
    const { search, status, page = 1, limit = 10 } = options;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status;
    if (search) {
      where.school = {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { schoolId: { contains: search, mode: 'insensitive' } },
        ],
      };
    }

    const [subscriptions, total] = await Promise.all([
      prisma.subscription.findMany({
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
      prisma.subscription.count({ where }),
    ]);

    return { subscriptions, total };
  }

  async renewSubscription(id: string, data: any, actorId: string, actorEmail: string) {
    const currentSub = await prisma.subscription.findUnique({
      where: { id },
      include: { school: true, plan: true },
    });

    if (!currentSub) throw new Error('Subscription not found');

    const extensionMonths = data.extensionMonths || (data.billingCycle === 'ANNUAL' ? 12 : data.billingCycle === 'QUARTERLY' ? 3 : 1);
    const newPlanId = data.planId || currentSub.planId;
    const plan = await prisma.subscriptionPlan.findUnique({ where: { id: newPlanId } });
    if (!plan) throw new Error('Selected plan not found');

    // Calculate new end date (extend from current endDate if it is in future, or from now)
    const baseDate = currentSub.endDate > new Date() ? currentSub.endDate : new Date();
    const newEndDate = new Date(baseDate);
    newEndDate.setMonth(newEndDate.getMonth() + extensionMonths);

    const price =
      extensionMonths === 12
        ? plan.annualPrice
        : extensionMonths === 3
        ? plan.quarterlyPrice
        : plan.monthlyPrice * extensionMonths;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Update Subscription
      const sub = await tx.subscription.update({
        where: { id },
        data: {
          planId: newPlanId,
          status: SubscriptionStatus.ACTIVE,
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
          status: PaymentStatus.COMPLETED,
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
          status: InvoiceStatus.PAID,
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
      await createAuditLog({
        actorId,
        actorType: AuditActorType.PLATFORM_USER,
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

    broadcastToSuperAdmins('subscription:renewed', {
      schoolId: currentSub.schoolId,
      newEndDate,
    });
    broadcastToTenant(currentSub.schoolId, 'tenant:subscription_updated', {
      status: SubscriptionStatus.ACTIVE,
      endDate: newEndDate,
    });

    return result;
  }

  // Multi-tenant limit enforcement helper
  async checkTenantQuota(schoolId: string, resource: 'student' | 'teacher') {
    const subscription = await prisma.subscription.findUnique({
      where: { schoolId },
      include: { plan: true },
    });

    if (!subscription || subscription.status !== SubscriptionStatus.ACTIVE) {
      throw new Error('Active subscription is required to add school members.');
    }

    if (resource === 'student') {
      const maxStudents = subscription.maxStudentsOverride || subscription.plan.maxStudents;
      const currentCount = await prisma.student.count({ where: { schoolId } });
      if (currentCount >= maxStudents) {
        throw new Error(
          `Subscription student quota exceeded. Maximum allowed: ${maxStudents}, Current count: ${currentCount}. Please upgrade your subscription plan.`
        );
      }
    } else if (resource === 'teacher') {
      const maxTeachers = subscription.maxTeachersOverride || subscription.plan.maxTeachers;
      const currentCount = await prisma.teacher.count({ where: { schoolId } });
      if (currentCount >= maxTeachers) {
        throw new Error(
          `Subscription teacher quota exceeded. Maximum allowed: ${maxTeachers}, Current count: ${currentCount}. Please upgrade your subscription plan.`
        );
      }
    }
  }
}

export const subscriptionService = new SubscriptionService();
