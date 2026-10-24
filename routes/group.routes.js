import { Router } from 'express';
import { createGroup, getUserGroups, getGroupById, joinGroup, leaveGroup, deleteGroup } from '../controllers/group.controller.js';
import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createGroupSchema, joinGroupSchema, groupIdParamSchema } from '../models/Group.js';

const router = Router();

router.post('/', protect, validate(createGroupSchema), createGroup);
router.get('/', protect, getUserGroups);
router.get('/:id', protect, validate(groupIdParamSchema, 'params'), getGroupById);
router.post('/join', protect, validate(joinGroupSchema), joinGroup);
router.delete('/:id/leave', protect, validate(groupIdParamSchema, 'params'), leaveGroup);
router.delete('/:id', protect, validate(groupIdParamSchema, 'params'), deleteGroup);

export default router;
