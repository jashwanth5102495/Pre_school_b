"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyPaymentSchema = exports.createPaymentOrderSchema = exports.renewSubscriptionSchema = exports.updatePlanSchema = exports.createPlanSchema = void 0;
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
exports.createPlanSchema = zod_1.z.object({
    name: zod_1.z.string().min(2, 'Plan name is required'),
    code: zod_1.z.string().min(2, 'Code is required').toLowerCase(),
    description: zod_1.z.string().min(5, 'Description is required'),
    monthlyPrice: zod_1.z.number().nonnegative('Monthly price must be non-negative'),
    quarterlyPrice: zod_1.z.number().nonnegative('Quarterly price must be non-negative'),
    annualPrice: zod_1.z.number().nonnegative('Annual price must be non-negative'),
    maxStudents: zod_1.z.number().int().positive('Max students must be positive'),
    maxTeachers: zod_1.z.number().int().positive('Max teachers must be positive'),
    maxStorageMb: zod_1.z.number().int().positive('Max storage in MB must be positive'),
    maxBranches: zod_1.z.number().int().positive('Max branches must be positive').default(1),
    supportLevel: zod_1.z.string().default('Standard'),
    trialDays: zod_1.z.number().int().nonnegative().default(14),
    isTrialAvailable: zod_1.z.boolean().default(true),
    status: zod_1.z.nativeEnum(client_1.SchoolStatus).default(client_1.SchoolStatus.ACTIVE),
    features: zod_1.z.array(zod_1.z.string()).optional(),
});
exports.updatePlanSchema = exports.createPlanSchema.partial();
exports.renewSubscriptionSchema = zod_1.z.object({
    billingCycle: zod_1.z.nativeEnum(client_1.BillingCycle).optional(),
    extensionMonths: zod_1.z.number().int().positive().optional(),
    planId: zod_1.z.string().uuid().optional(),
});
exports.createPaymentOrderSchema = zod_1.z.object({
    schoolId: zod_1.z.string().uuid(),
    subscriptionId: zod_1.z.string().uuid().optional(),
    planId: zod_1.z.string().uuid(),
    billingCycle: zod_1.z.nativeEnum(client_1.BillingCycle),
    amount: zod_1.z.number().positive(),
    currency: zod_1.z.string().default('INR'),
});
exports.verifyPaymentSchema = zod_1.z.object({
    orderId: zod_1.z.string(),
    razorpayPaymentId: zod_1.z.string(),
    razorpaySignature: zod_1.z.string(),
    schoolId: zod_1.z.string().uuid(),
    planId: zod_1.z.string().uuid(),
    billingCycle: zod_1.z.nativeEnum(client_1.BillingCycle),
});
