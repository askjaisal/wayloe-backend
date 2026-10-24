import * as eventService from '../services/event.service.js';

export const getPublicEvents = async (req, res) => {
  const data = await eventService.getPublicEvents(req.query, req.user?._id || null);
  res.json({ success: true, data });
};

export const getUserEvents = async (req, res) => {
  const data = await eventService.getUserEvents(req.user._id);
  res.json({ success: true, data });
};

export const createEvent = async (req, res) => {
  const data = await eventService.createEvent(req.user._id, req.body);
  res.status(201).json({ success: true, data });
};

export const joinPublicEvent = async (req, res) => {
  const data = await eventService.joinPublicEvent(req.user._id, req.params.id);
  res.json({ success: true, data });
};

export const joinPrivateEventByCode = async (req, res) => {
  const data = await eventService.joinPrivateEventByCode(req.user._id, req.body.inviteCode);
  res.json({ success: true, data });
};

export const leaveEvent = async (req, res) => {
  await eventService.leaveEvent(req.user._id, req.params.id);
  res.json({ success: true, message: 'Left event successfully' });
};

export const cancelEvent = async (req, res) => {
  await eventService.cancelEvent(req.user._id, req.params.id);
  res.json({ success: true, message: 'Event cancelled successfully' });
};
