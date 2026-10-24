import mongoose from 'mongoose';
import crypto from 'crypto';
import env from '../config/env.js';
import { durationToMilliseconds } from '../utils/duration.js';

const refreshTokenSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  token: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expireAfterSeconds: 0 },
  },
  isRevoked: {
    type: Boolean,
    default: false,
  },
  userAgent: {
    type: String,
    default: null,
  },
  ipAddress: {
    type: String,
    default: null,
  },
}, {
  timestamps: true,
});

refreshTokenSchema.statics.generateToken = function() {
  return crypto.randomBytes(64).toString('hex');
};

refreshTokenSchema.statics.createRefreshToken = async function(userId, req) {
  const token = this.generateToken();
  const expiresAt = new Date(Date.now() + durationToMilliseconds(env.JWT_REFRESH_EXPIRES_IN));

  return this.create({
    user: userId,
    token,
    expiresAt,
    userAgent: req?.headers?.['user-agent'] || null,
    ipAddress: req?.ip || null,
  });
};

refreshTokenSchema.statics.findValidToken = function(token) {
  return this.findOne({
    token,
    isRevoked: false,
    expiresAt: { $gt: new Date() },
  });
};

refreshTokenSchema.statics.revokeToken = function(token) {
  return this.updateOne({ token }, { isRevoked: true });
};

refreshTokenSchema.statics.revokeAllUserTokens = function(userId) {
  return this.updateMany({ user: userId }, { isRevoked: true });
};

export default mongoose.model('RefreshToken', refreshTokenSchema);
