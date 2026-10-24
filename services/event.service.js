import { randomBytes } from 'node:crypto';
import Event from '../models/Event.js';
import { AppError } from '../middleware/errorHandler.js';
import { moderateFields } from './moderation.service.js';
import logger from '../utils/logger.js';

const memberFields = 'firstName lastName username profileImage';

function withAttendeeCount(event) {
  const result = event.toObject();
  result.attendeeCount = result.attendees.length;
  return result;
}

export const createEvent = async (userId, eventData) => {
  const moderation = await moderateFields({
    name: eventData.name,
    description: eventData.description,
  });
  if (!moderation.approved) {
    throw new AppError('Content violates community guidelines', 400);
  }

  const eventFields = {
    name: eventData.name,
    description: eventData.description,
    createdBy: userId,
    attendees: [userId],
    capacity: eventData.capacity,
    visibility: eventData.visibility,
    startsAt: eventData.startsAt,
    endsAt: eventData.endsAt,
    address: eventData.address,
    location: {
      type: 'Point',
      coordinates: [eventData.longitude, eventData.latitude],
    },
  };

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const event = await Event.create({
        ...eventFields,
        ...(eventData.visibility === 'private'
          ? { inviteCode: randomBytes(5).toString('hex').toUpperCase() }
          : {}),
      });
      await event.populate('createdBy', memberFields);
      await event.populate('attendees', memberFields);
      logger.info({ eventId: event._id, userId, visibility: event.visibility }, 'Event created');
      return withAttendeeCount(event);
    } catch (error) {
      if (error.code !== 11000 || eventData.visibility !== 'private' || attempt === 2) {
        throw error;
      }
    }
  }

  throw new AppError('Could not create an invitation code. Please try again.', 503);
};

export const getPublicEvents = async ({ south, north, west, east }, userId = null) => {
  const now = new Date();
  const makePolygonFilter = (left, right) => ({
    location: {
      $geoWithin: {
        $geometry: {
          type: 'Polygon',
          coordinates: [[
            [left, south],
            [right, south],
            [right, north],
            [left, north],
            [left, south],
          ]],
        },
      },
    },
  });

  const locationFilters = west <= east
    ? [makePolygonFilter(west, east)]
    : [makePolygonFilter(west, 180), makePolygonFilter(-180, east)];

  const locationFilter = locationFilters.length === 1
    ? locationFilters[0]
    : { $or: locationFilters };

  const events = await Event.find({
    ...locationFilter,
    visibility: 'public',
    cancelledAt: null,
    endsAt: { $gt: now },
    $expr: { $lt: [{ $size: '$attendees' }, '$capacity'] },
  })
    .sort({ startsAt: 1 })
    .limit(100)
    .select('name description location address startsAt endsAt capacity attendees');

  return events.map((event) => {
    const result = event.toObject();
    return {
      _id: result._id,
      name: result.name,
      description: result.description,
      location: result.location,
      address: result.address,
      startsAt: result.startsAt,
      endsAt: result.endsAt,
      capacity: result.capacity,
      attendeeCount: result.attendees.length,
      isAttending: userId
        ? result.attendees.some((attendeeId) => attendeeId.toString() === userId.toString())
        : false,
    };
  });
};

export const getUserEvents = async (userId) => {
  const events = await Event.find({
    attendees: userId,
    cancelledAt: null,
    endsAt: { $gt: new Date() },
  })
    .sort({ startsAt: 1 })
    .select('+inviteCode')
    .populate('createdBy', memberFields)
    .populate('attendees', memberFields);

  return events.map(withAttendeeCount);
};

async function joinEvent(userId, event) {
  const now = new Date();

  if (event.cancelledAt || event.endsAt <= now) {
    throw new AppError('This event is no longer available', 410);
  }

  if (event.attendees.some((attendeeId) => attendeeId.toString() === userId.toString())) {
    throw new AppError('You have already joined this event', 409);
  }

  const joinedEvent = await Event.findOneAndUpdate(
    {
      _id: event._id,
      cancelledAt: null,
      endsAt: { $gt: now },
      attendees: { $ne: userId },
      $expr: { $lt: [{ $size: '$attendees' }, '$capacity'] },
    },
    { $addToSet: { attendees: userId } },
    { new: true },
  )
    .select('+inviteCode')
    .populate('createdBy', memberFields)
    .populate('attendees', memberFields);

  if (!joinedEvent) {
    throw new AppError('This event is full or no longer available', 409);
  }

  logger.info({ eventId: event._id, userId }, 'User joined event');
  return withAttendeeCount(joinedEvent);
}

export const joinPublicEvent = async (userId, eventId) => {
  const event = await Event.findOne({ _id: eventId, visibility: 'public' });
  if (!event) {
    throw new AppError('Public event not found', 404);
  }
  return joinEvent(userId, event);
};

export const joinPrivateEventByCode = async (userId, inviteCode) => {
  const event = await Event.findOne({
    inviteCode: inviteCode.toUpperCase(),
    visibility: 'private',
  }).select('+inviteCode');

  if (!event) {
    throw new AppError('Invalid or unavailable invitation code', 404);
  }
  return joinEvent(userId, event);
};

export const leaveEvent = async (userId, eventId) => {
  const event = await Event.findById(eventId);
  if (!event) {
    throw new AppError('Event not found', 404);
  }
  if (event.createdBy.toString() === userId.toString()) {
    throw new AppError('The event host cannot leave. Cancel the event instead.', 400);
  }
  if (!event.attendees.some((attendeeId) => attendeeId.toString() === userId.toString())) {
    throw new AppError('You have not joined this event', 409);
  }

  await Event.updateOne({ _id: eventId }, { $pull: { attendees: userId } });
};

export const cancelEvent = async (userId, eventId) => {
  const event = await Event.findById(eventId);
  if (!event) {
    throw new AppError('Event not found', 404);
  }
  if (event.createdBy.toString() !== userId.toString()) {
    throw new AppError('Only the event host can cancel this event', 403);
  }
  if (event.cancelledAt) {
    throw new AppError('This event is already cancelled', 409);
  }

  event.cancelledAt = new Date();
  await event.save();
};
