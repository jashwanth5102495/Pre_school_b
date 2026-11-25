import { Request, Response, NextFunction } from 'express';
import { paymentService } from '../services/payment.service';
import { successResponse, paginatedResponse, errorResponse } from '../utils/response';
import { createPaymentOrderSchema, verifyPaymentSchema } from '../validators/plan.validator';

export class PaymentController {
  async listPayments(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 10;
      const search = (req.query.search as string) || undefined;
      const status = (req.query.status as any) || undefined;

      const result = await paymentService.listPayments({ page, limit, search, status });
      return paginatedResponse(res, result.payments, result.total, page, limit);
    } catch (err) {
      next(err);
    }
  }

  async listInvoices(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 10;

      const result = await paymentService.listInvoices({ page, limit });
      return paginatedResponse(res, result.invoices, result.total, page, limit);
    } catch (err) {
      next(err);
    }
  }

  async createOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = createPaymentOrderSchema.parse(req.body);
      const result = await paymentService.createRazorpayOrder(validated);
      return successResponse(res, result, 'Payment order created');
    } catch (err: any) {
      if (err.name === 'ZodError') return next(err);
      return errorResponse(res, err.message, 400, 'ORDER_CREATION_FAILED');
    }
  }

  async verifyPayment(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = verifyPaymentSchema.parse(req.body);
      const result = await paymentService.verifyAndCompletePayment(validated);
      return successResponse(res, result, 'Payment verified and credited successfully');
    } catch (err: any) {
      if (err.name === 'ZodError') return next(err);
      return errorResponse(res, err.message, 400, 'PAYMENT_VERIFICATION_FAILED');
    }
  }
}

export const paymentController = new PaymentController();
