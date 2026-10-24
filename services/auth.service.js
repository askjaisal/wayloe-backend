import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import RefreshToken from '../models/RefreshToken.js';
import env from '../config/env.js';
import logger from '../utils/logger.js';
import { AppError } from '../middleware/errorHandler.js';
import { durationToMilliseconds } from '../utils/duration.js';

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
  maxAge: durationToMilliseconds(env.JWT_REFRESH_EXPIRES_IN),
  path: '/',
};

const generateAccessToken = (id) => {
  return jwt.sign({ id }, env.JWT_SECRET, { expiresIn: env.JWT_ACCESS_EXPIRES_IN });
};

export const setRefreshTokenCookie = (res, token) => {
  res.cookie('refresh_token', token, REFRESH_COOKIE_OPTIONS);
};

export const clearRefreshTokenCookie = (res) => {
  res.clearCookie('refresh_token', {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
    path: '/',
  });
};

export const registerUser = async ({ firstName, lastName, email, password }, req) => {
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new AppError('User already exists', 409);
  }

  const user = await User.create({ firstName, lastName, email, password });
  const refreshTokenDoc = await RefreshToken.createRefreshToken(user._id, req);
  const accessToken = generateAccessToken(user._id);

  logger.info({ userId: user._id }, 'User registered');

  return { user, accessToken, refreshToken: refreshTokenDoc.token };
};

export const loginUser = async ({ email, password }, req) => {
  const user = await User.findOne({ email }).select('+password');
  if (!user || !(await user.matchPassword(password))) {
    throw new AppError('Invalid credentials', 401);
  }

  const refreshTokenDoc = await RefreshToken.createRefreshToken(user._id, req);
  const accessToken = generateAccessToken(user._id);

  logger.info({ userId: user._id }, 'User logged in');

  return { user, accessToken, refreshToken: refreshTokenDoc.token };
};

export const refreshUserToken = async (refreshToken, req) => {
  if (!refreshToken) {
    return null;
  }

  const tokenDoc = await RefreshToken.findValidToken(refreshToken);
  if (!tokenDoc) {
    return null;
  }

  const user = await User.findById(tokenDoc.user);
  if (!user) {
    await RefreshToken.revokeToken(refreshToken);
    return null;
  }

  await RefreshToken.revokeToken(refreshToken);
  const newRefreshTokenDoc = await RefreshToken.createRefreshToken(user._id, req);
  const accessToken = generateAccessToken(user._id);

  return { accessToken, newRefreshToken: newRefreshTokenDoc.token };
};

export const logoutUser = async (refreshToken) => {
  if (refreshToken) {
    await RefreshToken.revokeToken(refreshToken);
  }
};

export const checkUsernameAvailability = async (username, currentUserId) => {
  if (!username) {
    return { available: false, message: 'Username is required' };
  }
  const cleanUsername = username.toLowerCase().trim();
  if (cleanUsername.length < 3 || cleanUsername.length > 30) {
    return { available: false, message: 'Username must be between 3 and 30 characters' };
  }
  if (!/^[a-zA-Z0-9_]+$/.test(cleanUsername)) {
    return { available: false, message: 'Username can only contain letters, numbers, and underscores' };
  }

  const existingUser = await User.findOne({
    username: cleanUsername,
    _id: { $ne: currentUserId },
  });

  if (existingUser) {
    return { available: false, message: 'Username is already taken' };
  }

  return { available: true, message: 'Username is available' };
};

export const updateUserProfile = async (userId, { firstName, lastName, username, profileImage }) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError('User not found', 404);
  }

  if (username !== undefined && username !== null && username !== '') {
    const cleanUsername = username.toLowerCase().trim();
    if (cleanUsername !== user.username) {
      const check = await checkUsernameAvailability(cleanUsername, userId);
      if (!check.available) {
        throw new AppError(check.message, 400);
      }
      user.username = cleanUsername;
    }
  }

  if (firstName !== undefined) user.firstName = firstName;
  if (lastName !== undefined) user.lastName = lastName;
  if (profileImage !== undefined) user.profileImage = profileImage;

  const updatedUser = await user.save();
  const accessToken = generateAccessToken(updatedUser._id);

  return { user: updatedUser, accessToken };
};

export const getUserById = async (userId) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError('User not found', 404);
  }
  return user;
};
