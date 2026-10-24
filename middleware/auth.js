import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import User from '../models/User.js';
import logger from '../utils/logger.js';

export const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization?.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Not authorized to access this route',
    });
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select('-password');

    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User not found',
      });
    }

    next();
  } catch (error) {
    logger.error({ err: error }, 'Auth middleware error');
    return res.status(401).json({
      success: false,
      error: 'Not authorized to access this route',
    });
  }
};

export const optionalAuth = async (req, _res, next) => {
  const token = req.headers.authorization?.startsWith('Bearer')
    ? req.headers.authorization.split(' ')[1]
    : null;

  if (!token) return next();

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select('-password');
  } catch {
    // Public event discovery stays available if a guest has a stale token.
  }

  next();
};
