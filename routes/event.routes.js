import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  cancelEvent,
  createEvent,
  getPublicEvents,
  getUserEvents,
  joinPrivateEventByCode,
  joinPublicEvent,
  leaveEvent,
} from '../controllers/event.controller.js';
import { optionalAuth, protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  createEventSchema,
  eventIdParamSchema,
  publicEventsBoundsSchema,
  joinEventByCodeSchema,
} from '../models/Event.js';

const router = Router();

const inviteCodeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many invitation attempts. Try again later.' },
});

// Public events are intentionally readable without authentication for map discovery.
router.get('/public', optionalAuth, validate(publicEventsBoundsSchema, 'query'), getPublicEvents);

router.get('/', protect, getUserEvents);
router.post('/', protect, validate(createEventSchema), createEvent);
router.post('/join-code', protect, inviteCodeLimiter, validate(joinEventByCodeSchema), joinPrivateEventByCode);
router.post('/:id/join', protect, validate(eventIdParamSchema, 'params'), joinPublicEvent);
router.delete('/:id/leave', protect, validate(eventIdParamSchema, 'params'), leaveEvent);
router.delete('/:id', protect, validate(eventIdParamSchema, 'params'), cancelEvent);

export default router;
