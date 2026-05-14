import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { rateLimiter } from './middleware/rateLimiter';
import { errorHandler } from './middleware/errorHandler';
import { notFoundHandler } from './middleware/notFoundHandler';
import { logger } from './utils/logger';

// Route imports
import authRoutes from './modules/auth/auth.routes';
import userRoutes from './modules/user/user.routes';
import jobRoutes from './modules/job/job.routes';
import referralRoutes from './modules/referral/referral.routes';
import chatRoutes from './modules/chat/chat.routes';
import directChatRoutes from './modules/chat/directChat.routes';
import notificationRoutes from './modules/notification/notification.routes';

const app = express();

// ─────────────────────────────────────────
// Security Middleware
// ─────────────────────────────────────────
app.use(helmet()); // Sets secure HTTP headers
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  credentials: true,
}));

// ─────────────────────────────────────────
// General Middleware
// ─────────────────────────────────────────
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined', {
  stream: { write: (msg) => logger.http(msg.trim()) },
}));

// ─────────────────────────────────────────
// Rate Limiting
// ─────────────────────────────────────────
app.use('/api', rateLimiter);

// ─────────────────────────────────────────
// Health Check
// ─────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─────────────────────────────────────────
// API Routes
// ─────────────────────────────────────────
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/jobs', jobRoutes);
app.use('/api/v1/referrals', referralRoutes);
app.use('/api/v1/chats', chatRoutes);
app.use('/api/v1/direct-chats', directChatRoutes);
app.use('/api/v1/notifications', notificationRoutes);

// ─────────────────────────────────────────
// Error Handling (must be last)
// ─────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
