"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentService = exports.PaymentService = void 0;
const crypto_1 = __importDefault(require("crypto"));
const database_1 = require("../config/database");
const env_1 = require("../config/env");
const sockets_1 = require("../sockets");
const client_1 = require("@prisma/client");
class PaymentService {
    async listPayments(options) {
        const { search, status, page = 1, limit = 10 } = options;
        const skip = (page - 1) * limit;
        const where = {};
        if (status)
            where.status = status;
        if (search) {
            where.OR = [
                { transactionId: { contains: search, mode: 'insensitive' } },
                { orderId: { contains: search, mode: 'insensitive' } },
                { school: { name: { contains: search, mode: 'insensitive' } } },
                { school: { schoolId: { contains: search, mode: 'insensitive' } } },
            ];
        }
        const [payments, total] = await Promise.all([
            database_1.prisma.payment.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    school: { select: { id: true, name: true, schoolId: true } },
                    invoices: true,
                },
            }),
            database_1.prisma.payment.count({ where }),
        ]);
        return { payments, total };
    }
    async listInvoices(options) {
        const { page = 1, limit = 10 } = options;
        const skip = (page - 1) * limit;
        const [invoices, total] = await Promise.all([
            database_1.prisma.invoice.findMany({
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    school: { select: { id: true, name: true, schoolId: true } },
                    payment: true,
                },
            }),
            database_1.prisma.invoice.count(),
        ]);
        return { invoices, total };
    }
    async createRazorpayOrder(data) {
        const school = await database_1.prisma.school.findUnique({ where: { id: data.schoolId } });
        if (!school)
            throw new Error('School not found');
        const orderId = `order_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
        const transactionId = `TXN-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
        const payment = await database_1.prisma.payment.create({
            data: {
                schoolId: data.schoolId,
                orderId,
                transactionId,
                amount: data.amount,
                currency: data.currency || 'INR',
                paymentProvider: 'RAZORPAY',
                status: client_1.PaymentStatus.PENDING,
                razorpayOrderId: orderId,
            },
        });
        return {
            orderId,
            transactionId: payment.transactionId,
            amount: data.amount,
            currency: data.currency,
            keyId: env_1.env.RAZORPAY_KEY_ID || 'rzp_test_school_saas_sample',
        };
    }
    async verifyAndCompletePayment(data) {
        const payment = await database_1.prisma.payment.findFirst({
            where: { orderId: data.orderId },
        });
        if (!payment)
            throw new Error('Payment order record not found');
        if (payment.status === client_1.PaymentStatus.COMPLETED) {
            return { payment, message: 'Payment already completed (Idempotent)' };
        }
        // In production: verify Razorpay signature: HMAC-SHA256(orderId + "|" + paymentId, secret)
        if (env_1.env.RAZORPAY_KEY_SECRET) {
            const generatedSignature = crypto_1.default
                .createHmac('sha256', env_1.env.RAZORPAY_KEY_SECRET)
                .update(`${data.orderId}|${data.razorpayPaymentId}`)
                .digest('hex');
            // Verify cryptographic signature
            if (data.razorpaySignature !== generatedSignature && env_1.env.NODE_ENV === 'production') {
                await database_1.prisma.payment.update({
                    where: { id: payment.id },
                    data: {
                        status: client_1.PaymentStatus.FAILED,
                        failureReason: 'Invalid Razorpay payment signature',
                    },
                });
                throw new Error('Payment signature verification failed.');
            }
        }
        // Atomic completion: Update Payment, Generate Invoice, Update Subscription
        const result = await database_1.prisma.$transaction(async (tx) => {
            const updatedPayment = await tx.payment.update({
                where: { id: payment.id },
                data: {
                    status: client_1.PaymentStatus.COMPLETED,
                    razorpayPaymentId: data.razorpayPaymentId,
                    razorpaySignature: data.razorpaySignature,
                    paymentMethod: 'RAZORPAY_CHECKOUT',
                },
            });
            const invoiceNum = `INV-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;
            const tax = payment.amount * 0.18;
            const invoice = await tx.invoice.create({
                data: {
                    schoolId: data.schoolId,
                    paymentId: payment.id,
                    invoiceNumber: invoiceNum,
                    amount: payment.amount,
                    tax,
                    totalAmount: payment.amount + tax,
                    status: client_1.InvoiceStatus.PAID,
                    dueDate: new Date(),
                    paidAt: new Date(),
                    lineItems: [
                        {
                            description: `Subscription Payment (${data.billingCycle})`,
                            amount: payment.amount,
                            total: payment.amount,
                        },
                    ],
                },
            });
            // Update or activate school subscription
            const plan = await tx.subscriptionPlan.findUnique({ where: { id: data.planId } });
            const monthsToAdd = data.billingCycle === 'ANNUAL' ? 12 : data.billingCycle === 'QUARTERLY' ? 3 : 1;
            const newEndDate = new Date();
            newEndDate.setMonth(newEndDate.getMonth() + monthsToAdd);
            await tx.subscription.upsert({
                where: { schoolId: data.schoolId },
                update: {
                    planId: data.planId,
                    status: client_1.SubscriptionStatus.ACTIVE,
                    billingCycle: data.billingCycle,
                    endDate: newEndDate,
                },
                create: {
                    schoolId: data.schoolId,
                    planId: data.planId,
                    status: client_1.SubscriptionStatus.ACTIVE,
                    billingCycle: data.billingCycle,
                    startDate: new Date(),
                    endDate: newEndDate,
                },
            });
            return { updatedPayment, invoice };
        });
        (0, sockets_1.broadcastToSuperAdmins)('payment:completed', {
            transactionId: payment.transactionId,
            amount: payment.amount,
            schoolId: data.schoolId,
        });
        (0, sockets_1.broadcastToTenant)(data.schoolId, 'tenant:payment_received', {
            transactionId: payment.transactionId,
            amount: payment.amount,
        });
        return result;
    }
}
exports.PaymentService = PaymentService;
exports.paymentService = new PaymentService();
