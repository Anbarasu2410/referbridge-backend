import { Server as HttpServer } from 'http';
import { Server as SocketServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';
import { prisma } from '../lib/prisma';

let io: SocketServer;

// Track online users: userId → socketId
const onlineUsers = new Map<string, string>();

export function initSocket(httpServer: HttpServer) {
  io = new SocketServer(httpServer, {
    cors: {
      origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
      credentials: true,
    },
    pingTimeout: 60000,
  });

  // Auth middleware for socket connections
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) return next(new Error('Authentication required'));

      const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET!) as {
        id: string;
        role: string;
      };

      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: { id: true, role: true, isActive: true },
      });

      if (!user || !user.isActive) return next(new Error('User not found'));

      socket.data.userId = user.id;
      socket.data.role = user.role;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const userId = socket.data.userId;
    logger.info(`Socket connected: ${userId}`);

    // Track online status
    onlineUsers.set(userId, socket.id);
    socket.broadcast.emit('user:online', { userId });

    // Join personal room for direct notifications
    socket.join(`user:${userId}`);

    // ─── Chat Events ───────────────────────────────
    socket.on('chat:join', (chatId: string) => {
      socket.join(`chat:${chatId}`);
    });

    socket.on('chat:leave', (chatId: string) => {
      socket.leave(`chat:${chatId}`);
    });

    socket.on('chat:message', async (data: { chatId: string; content: string }) => {
      try {
        const message = await prisma.message.create({
          data: {
            chatId: data.chatId,
            senderId: userId,
            content: data.content,
          },
          include: {
            sender: { select: { id: true } },
          },
        });

        // Emit to everyone in the chat room
        io.to(`chat:${data.chatId}`).emit('chat:message', message);
      } catch (error) {
        logger.error('Socket message error:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    socket.on('chat:typing', (data: { chatId: string; isTyping: boolean }) => {
      socket.to(`chat:${data.chatId}`).emit('chat:typing', {
        userId,
        isTyping: data.isTyping,
      });
    });

    // ─── Direct Chat Events ────────────────────────
    socket.on('direct-chat:join', (directChatId: string) => {
      socket.join(`direct-chat:${directChatId}`);
    });

    socket.on('direct-chat:leave', (directChatId: string) => {
      socket.leave(`direct-chat:${directChatId}`);
    });

    socket.on('direct-chat:message', async (data: { directChatId: string; content: string }) => {
      try {
        const message = await prisma.directMessage.create({
          data: {
            directChatId: data.directChatId,
            senderId: userId,
            content: data.content,
          },
          include: {
            sender: { select: { id: true } },
          },
        });
        io.to(`direct-chat:${data.directChatId}`).emit('direct-chat:message', message);
      } catch (error) {
        logger.error('Socket direct message error:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    socket.on('direct-chat:typing', (data: { directChatId: string; isTyping: boolean }) => {
      socket.to(`direct-chat:${data.directChatId}`).emit('direct-chat:typing', {
        userId,
        isTyping: data.isTyping,
      });
    });

    // ─── Disconnect ────────────────────────────────
    socket.on('disconnect', () => {
      onlineUsers.delete(userId);
      socket.broadcast.emit('user:offline', { userId });
      logger.info(`Socket disconnected: ${userId}`);
    });
  });

  logger.info('✅ Socket.IO initialized');
  return io;
}

// Export for use in controllers (emit notifications, status updates)
export function getIO() {
  if (!io) throw new Error('Socket.IO not initialized');
  return io;
}

export function isUserOnline(userId: string) {
  return onlineUsers.has(userId);
}

export function emitToUser(userId: string, event: string, data: unknown) {
  getIO().to(`user:${userId}`).emit(event, data);
}
