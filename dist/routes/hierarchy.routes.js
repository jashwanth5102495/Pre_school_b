"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const hierarchy_controller_1 = require("../controllers/hierarchy.controller");
const auth_1 = require("../middlewares/auth");
const router = (0, express_1.Router)();
// All hierarchy routes require valid authentication (Platform or School user)
router.use(auth_1.authenticate);
router.get('/tree', (req, res, next) => hierarchy_controller_1.hierarchyController.getTree(req, res, next));
router.post('/members', (req, res, next) => hierarchy_controller_1.hierarchyController.createMember(req, res, next));
router.patch('/members/:id', (req, res, next) => hierarchy_controller_1.hierarchyController.updateMember(req, res, next));
router.delete('/members/:id', (req, res, next) => hierarchy_controller_1.hierarchyController.deleteMember(req, res, next));
exports.default = router;
