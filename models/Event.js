import mongoose from 'mongoose';
import { z } from 'zod';

const latitudeSchema = z.coerce.number().min(-90).max(90);
const longitudeSchema = z.coerce.number().min(-180).max(180);

export const eventIdParamSchema = z.object({
  id: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid event ID format'),
});

export const createEventSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(1000).optional().default(''),
  latitude: latitudeSchema,
  longitude: longitudeSchema,
  address: z.string().trim().max(250).optional().default(''),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  visibility: z.enum(['public', 'private']),
  capacity: z.coerce.number().int().min(2).max(500),
}).refine((event) => event.startsAt.getTime() > Date.now(), {
  path: ['startsAt'],
  message: 'Event must start in the future',
}).refine((event) => event.endsAt.getTime() > event.startsAt.getTime(), {
  path: ['endsAt'],
  message: 'Event end must be after its start',
});

export const publicEventsBoundsSchema = z.object({
  south: latitudeSchema,
  north: latitudeSchema,
  west: longitudeSchema,
  east: longitudeSchema,
}).refine((bounds) => bounds.north > bounds.south, {
  path: ['north'],
  message: 'Map bounds are invalid',
});

export const joinEventByCodeSchema = z.object({
  inviteCode: z.string().trim().toUpperCase().regex(/^[A-F0-9]{10}$/, 'Enter a valid 10-character invitation code'),
});

const eventSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
  },
  description: {
    type: String,
    trim: true,
    maxlength: 1000,
    default: '',
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  attendees: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  capacity: {
    type: Number,
    required: true,
    min: 2,
    max: 500,
  },
  visibility: {
    type: String,
    enum: ['public', 'private'],
    required: true,
    index: true,
  },
  inviteCode: {
    type: String,
    unique: true,
    sparse: true,
    select: false,
  },
  startsAt: {
    type: Date,
    required: true,
    index: true,
  },
  endsAt: {
    type: Date,
    required: true,
    index: true,
  },
  cancelledAt: {
    type: Date,
    default: null,
  },
  address: {
    type: String,
    trim: true,
    maxlength: 250,
    default: '',
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      required: true,
    },
    coordinates: {
      type: [Number],
      required: true,
      validate: {
        validator: (coordinates) => coordinates.length === 2
          && coordinates[0] >= -180 && coordinates[0] <= 180
          && coordinates[1] >= -90 && coordinates[1] <= 90,
        message: 'Invalid event coordinates',
      },
    },
  },
}, {
  timestamps: true,
});

eventSchema.index({ location: '2dsphere', visibility: 1, endsAt: 1 });
eventSchema.index({ attendees: 1, startsAt: 1 });

export default mongoose.model('Event', eventSchema);
