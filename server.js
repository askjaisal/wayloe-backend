import express from 'express';
import http from 'http';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';

import env from './config/env.js';
import connectDB from './config/database.js';
import { corsMiddleware } from './config/cors.js';
import { attachSocket } from './config/socket.js';
import logger from './utils/logger.js';
import { errorHandler } from './middleware/errorHandler.js';

import authRoutes from './routes/auth.routes.js';
import mapRoutes from './routes/map.routes.js';
import uploadRoutes from './routes/upload.routes.js';
import groupRoutes from './routes/group.routes.js';
import messageRoutes from './routes/message.routes.js';
import eventRoutes from './routes/event.routes.js';

process.on('unhandledRejection', (reason) => {
  logger.fatal({ err: reason }, 'Unhandled Rejection');
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught Exception');
  process.exit(1);
});

await connectDB();

const app = express();

app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: { directives: { defaultSrc: ["'self'"] } },
  hsts: { maxAge: 31536000, includeSubDomains: true },
}));
app.use(corsMiddleware);
app.use(morgan('short', {
  stream: { write: (msg) => logger.info(msg.trim()) },
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser(env.COOKIE_SECRET));

const isDev = env.NODE_ENV === 'development';

const globalLimiter = rateLimit({
  windowMs: isDev ? 60 * 1000 : env.RATE_LIMIT_WINDOW_MS,
  max: isDev ? 10000 : env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests, please try again later.' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 1000 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many auth attempts, please try again later.' },
});

if (!isDev) {
  app.use('/api', globalLimiter);
  app.use('/api/auth/login', authLimiter);
  app.use('/api/auth/register', authLimiter);
}

app.get('/', (_req, res) => {
  res.json({ message: 'Welcome to Wayloe API' });
});

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: env.NODE_ENV,
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/map', mapRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/events', eventRoutes);

app.use('/api', (_req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

app.use(errorHandler);

const server = http.createServer(app);
const io = attachSocket(server);
app.set('io', io);

const shutdown = async (signal) => {
  logger.info({ signal }, 'Received shutdown signal');

  server.close(() => {
    logger.info('HTTP server closed');
  });

  try {
    const mongoose = await import('mongoose');
    await mongoose.default.connection.close();
    logger.info('MongoDB connection closed');
  } catch (err) {
    logger.error({ err }, 'Error closing MongoDB');
  }

  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);

  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

server.listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, 'Server running');
});

export { app, server };
