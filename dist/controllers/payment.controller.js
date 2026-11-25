"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentController = exports.PaymentController = void 0;
const payment_service_1 = require("../services/payment.service");
const response_1 = require("../utils/response");
const plan_validator_1 = require("../validators/plan.validator");
class PaymentController {
    async listPayments(req, res, next) {
        try {
            const page = parseInt(req.query.page, 10) || 1;
            const limit = parseInt(req.query.limit, 10) || 10;
            const search = req.query.search || undefined;
            const status = req.query.status || undefined;
            const result = await payment_service_1.paymentService.listPayments({ page, limit, search, status });
            return (0, response_1.paginatedResponse)(res, result.payments, result.total, page, limit);
        }
        catch (err) {
            next(err);
        }
    }
    async listInvoices(req, res, next) {
        try {
            const page = parseInt(req.query.page, 10) || 1;
            const limit = parseInt(req.query.limit, 10) || 10;
            const result = await payment_service_1.paymentService.listInvoices({ page, limit });
            return (0, response_1.paginatedResponse)(res, result.invoices, result.total, page, limit);
        }
        catch (err) {
            next(err);
        }
    }
    async createOrder(req, res, next) {
        try {
            const validated = plan_validator_1.createPaymentOrderSchema.parse(req.body);
            const result = await payment_service_1.paymentService.createRazorpayOrder(validated);
            return (0, response_1.successResponse)(res, result, 'Payment order created');
        }
        catch (err) {
            if (err.name === 'ZodError')
                return next(err);
            return (0, response_1.errorResponse)(res, err.message, 400, 'ORDER_CREATION_FAILED');
        }
    }
    async verifyPayment(req, res, next) {
        try {
            const validated = plan_validator_1.verifyPaymentSchema.parse(req.body);
            const result = await payment_service_1.paymentService.verifyAndCompletePayment(validated);
            return (0, response_1.successResponse)(res, result, 'Payment verified and credited successfully');
        }
        catch (err) {
            if (err.name === 'ZodError')
                return next(err);
            return (0, response_1.errorResponse)(res, err.message, 400, 'PAYMENT_VERIFICATION_FAILED');
        }
    }
}
exports.PaymentController = PaymentController;
exports.paymentController = new PaymentController();
