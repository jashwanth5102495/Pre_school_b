import { z } from 'zod';
import { SchoolStatus, BillingCycle } from '@prisma/client';

export const createPlanSchema = z.object({
  name: z.string().min(2, 'Plan name is required'),
  code: z.string().min(2, 'Code is required').toLowerCase(),
  description: z.string().min(5, 'Description is required'),
  monthlyPrice: z.number().nonnegative('Monthly price must be non-negative'),
  quarterlyPrice: z.number().nonnegative('Quarterly price must be non-negative'),
  annualPrice: z.number().nonnegative('Annual price must be non-negative'),
  maxStudents: z.number().int().positive('Max students must be positive'),
  maxTeachers: z.number().int().positive('Max teachers must be positive'),
  maxStorageMb: z.number().int().positive('Max storage in MB must be positive'),
  maxBranches: z.number().int().positive('Max branches must be positive').default(1),
  supportLevel: z.string().default('Standard'),
  trialDays: z.number().int().nonnegative().default(14),
  isTrialAvailable: z.boolean().default(true),
  status: z.nativeEnum(SchoolStatus).default(SchoolStatus.ACTIVE),
  features: z.array(z.string()).optional(),
});

export const updatePlanSchema = createPlanSchema.partial();

export const renewSubscriptionSchema = z.object({
  billingCycle: z.nativeEnum(BillingCycle).optional(),
  extensionMonths: z.number().int().positive().optional(),
  planId: z.string().uuid().optional(),
});

export const createPaymentOrderSchema = z.object({
  schoolId: z.string().uuid(),
  subscriptionId: z.string().uuid().optional(),
  planId: z.string().uuid(),
  billingCycle: z.nativeEnum(BillingCycle),
  amount: z.number().positive(),
  currency: z.string().default('INR'),
});

export const verifyPaymentSchema = z.object({
  orderId: z.string(),
  razorpayPaymentId: z.string(),
  razorpaySignature: z.string(),
  schoolId: z.string().uuid(),
  planId: z.string().uuid(),
  billingCycle: z.nativeEnum(BillingCycle),
});
