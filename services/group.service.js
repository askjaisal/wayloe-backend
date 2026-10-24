import Group from '../models/Group.js';
import FavoritePlace from '../models/FavoritePlace.js';
import Message from '../models/Message.js';
import { AppError } from '../middleware/errorHandler.js';
import { moderateFields } from './moderation.service.js';
import { getIO } from './realtime.service.js';
import logger from '../utils/logger.js';

export const createGroup = async (userId, { name, description, profileImage }) => {
  const moderation = await moderateFields({ name, description });
  if (!moderation.approved) {
    throw new AppError('Content violates community guidelines', 400);
  }

  const group = await Group.create({
    name,
    description: description || '',
    profileImage: profileImage || null,
    createdBy: userId,
    members: [userId],
  });

  logger.info({ groupId: group._id, userId }, 'Group created');
  return group;
};

export const getUserGroups = async (userId) => {
  const groups = await Group.find({ members: userId })
    .sort({ createdAt: -1 })
    .populate('createdBy', 'firstName lastName profileImage');

  const groupsWithCounts = await Promise.all(
    groups.map(async (group) => {
      const obj = group.toObject();
      obj.memberCount = obj.members.length;
      const favoriteCount = await FavoritePlace.countDocuments({ groupId: group._id });
      obj.favoriteCount = favoriteCount;
      delete obj.members;
      return obj;
    })
  );

  return groupsWithCounts;
};

export const getGroupById = async (groupId, userId) => {
  const group = await Group.findById(groupId)
    .populate('createdBy', 'firstName lastName profileImage')
    .populate('members', 'firstName lastName profileImage');

  if (!group) {
    throw new AppError('Group not found', 404);
  }

  const isMember = group.members.some(
    (m) => m._id.toString() === userId.toString()
  );

  if (!isMember) {
    throw new AppError('You are not a member of this group', 403);
  }

  const obj = group.toObject();
  obj.memberCount = obj.members.length;
  const favoriteCount = await FavoritePlace.countDocuments({ groupId: group._id });
  obj.favoriteCount = favoriteCount;

  return obj;
};

export const joinGroup = async (userId, inviteCode) => {
  const group = await Group.findOne({ inviteCode: inviteCode.toUpperCase() });

  if (!group) {
    throw new AppError('Invalid invite code', 404);
  }

  const alreadyMember = group.members.some(
    (m) => m.toString() === userId.toString()
  );

  if (alreadyMember) {
    throw new AppError('You are already a member of this group', 400);
  }

  group.members.push(userId);
  await group.save();

  logger.info({ groupId: group._id, userId }, 'User joined group');
  return group;
};

export const leaveGroup = async (userId, groupId) => {
  const group = await Group.findById(groupId);

  if (!group) {
    throw new AppError('Group not found', 404);
  }

  if (group.createdBy.toString() === userId.toString()) {
    throw new AppError('Group creator cannot leave the group', 400);
  }

  const isMember = group.members.some(
    (m) => m.toString() === userId.toString()
  );

  if (!isMember) {
    throw new AppError('You are not a member of this group', 403);
  }

  group.members = group.members.filter(
    (m) => m.toString() !== userId.toString()
  );
  await group.save();

  logger.info({ groupId: group._id, userId }, 'User left group');
};

export const deleteGroup = async (userId, groupId) => {
  const group = await Group.findById(groupId);
  if (!group) {
    throw new AppError('Group not found', 404);
  }
  if (group.createdBy.toString() !== userId.toString()) {
    throw new AppError('Only the group creator can delete this group', 403);
  }

  await FavoritePlace.deleteMany({ groupId: group._id });
  await Message.deleteMany({ groupId: group._id });
  await group.deleteOne();

  const io = getIO();
  if (io) {
    const room = `group:${groupId}`;
    try {
      io.to(room).emit('group_deleted', { groupId: groupId.toString() });
      await io.in(room).socketsLeave(room);
    } catch (error) {
      logger.warn({ err: error, groupId }, 'Could not close sockets for deleted group');
    }
  }

  logger.info({ groupId, userId }, 'Group deleted');
};
