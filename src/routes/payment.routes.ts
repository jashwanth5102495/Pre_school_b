import { Router } from 'express';
import { paymentController } from '../controllers/payment.controller';
import { authenticate } from '../middlewares/auth';
import { requirePlatformRole } from '../middlewares/rbac';
import { PlatformRole } from '@prisma/client';

const router = Router();

router.use(authenticate);
router.use(requirePlatformRole(PlatformRole.SUPER_ADMIN, PlatformRole.PLATFORM_FINANCE));

router.get('/', (req, res, next) => paymentController.listPayments(req, res, next));
router.get('/invoices', (req, res, next) => paymentController.listInvoices(req, res, next));
router.post('/create-order', (req, res, next) => paymentController.createOrder(req, res, next));
router.post('/verify', (req, res, next) => paymentController.verifyPayment(req, res, next));

export default router;
