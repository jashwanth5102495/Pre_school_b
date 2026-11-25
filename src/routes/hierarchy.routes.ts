import { Router } from 'express';
import { hierarchyController } from '../controllers/hierarchy.controller';
import { authenticate } from '../middlewares/auth';

const router = Router();

// All hierarchy routes require valid authentication (Platform or School user)
router.use(authenticate);

router.get('/tree', (req, res, next) => hierarchyController.getTree(req, res, next));
router.post('/members', (req, res, next) => hierarchyController.createMember(req, res, next));
router.patch('/members/:id', (req, res, next) => hierarchyController.updateMember(req, res, next));
router.delete('/members/:id', (req, res, next) => hierarchyController.deleteMember(req, res, next));

export default router;
