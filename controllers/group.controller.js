import * as groupService from '../services/group.service.js';

export const createGroup = async (req, res) => {
  const data = await groupService.createGroup(req.user._id, req.body);
  res.status(201).json({ success: true, data });
};

export const getUserGroups = async (req, res) => {
  const data = await groupService.getUserGroups(req.user._id);
  res.json({ success: true, data });
};

export const getGroupById = async (req, res) => {
  const data = await groupService.getGroupById(req.params.id, req.user._id);
  res.json({ success: true, data });
};

export const joinGroup = async (req, res) => {
  const data = await groupService.joinGroup(req.user._id, req.body.inviteCode);
  res.json({ success: true, data });
};

export const leaveGroup = async (req, res) => {
  await groupService.leaveGroup(req.user._id, req.params.id);
  res.json({ success: true, message: 'Left group successfully' });
};

export const deleteGroup = async (req, res) => {
  await groupService.deleteGroup(req.user._id, req.params.id);
  res.json({ success: true, message: 'Group deleted successfully' });
};
