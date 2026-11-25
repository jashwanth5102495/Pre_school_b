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

// Classes & Teacher Mapping routes directly from Hierarchy Tree
router.post('/classes', (req, res, next) => hierarchyController.createClass(req, res, next));
router.delete('/classes/:id', (req, res, next) => hierarchyController.deleteClass(req, res, next));
router.post('/sections', (req, res, next) => hierarchyController.createSection(req, res, next));
router.post('/allocate', (req, res, next) => hierarchyController.allocateTeacher(req, res, next));
router.delete('/allocate/:id', (req, res, next) => hierarchyController.deleteAllocation(req, res, next));

export default router;
