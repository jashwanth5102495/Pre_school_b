import { Router } from 'express';
import { schoolController } from '../controllers/school.controller';
import { authenticate } from '../middlewares/auth';
import { requirePlatformRole } from '../middlewares/rbac';
import { PlatformRole } from '@prisma/client';

const router = Router();

router.use(authenticate);
router.use(requirePlatformRole(PlatformRole.SUPER_ADMIN, PlatformRole.PLATFORM_SUPPORT));

router.get('/', (req, res, next) => schoolController.listSchools(req, res, next));
router.post('/', (req, res, next) => schoolController.provisionSchool(req, res, next));
router.get('/:id', (req, res, next) => schoolController.getSchoolById(req, res, next));
router.patch('/:id', (req, res, next) => schoolController.updateSchool(req, res, next));
router.patch('/:id/status', (req, res, next) => schoolController.updateSchoolStatus(req, res, next));
router.post('/:id/invitations', (req, res, next) => schoolController.resendInvitation(req, res, next));
router.delete('/:id', (req, res, next) => schoolController.deleteSchool(req, res, next));

export default router;
