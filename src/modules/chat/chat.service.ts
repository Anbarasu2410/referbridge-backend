import { prisma } from '../../lib/prisma';
import { AppError, NotFoundError, ForbiddenError } from '../../utils/AppError';
import { UserRole } from '@prisma/client';

export const chatService = {
  async listChats(userId: string, role: UserRole) {
    let whereClause: any;

    if (role === 'CANDIDATE') {
      const candidate = await prisma.candidate.findUnique({ where: { userId } });
      if (!candidate) throw new AppError('Candidate profile not found', 404);
      whereClause = { referralRequest: { candidateId: candidate.id } };
    } else if (role === 'EMPLOYEE') {
      const employee = await prisma.employee.findUnique({ where: { userId } });
      if (!employee) throw new AppError('Employee profile not found', 404);
      whereClause = { referralRequest: { employeeId: employee.id } };
    } else {
      // RECRUITER: only sees chats for referrals they directly manage (recruiterId on referral)
      const recruiter = await prisma.recruiter.findUnique({ where: { userId } });
      if (!recruiter) throw new AppError('Recruiter profile not found', 404);
      whereClause = { referralRequest: { recruiterId: recruiter.id } };
    }

    const chats = await prisma.chat.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      include: {
        referralRequest: {
          include: {
            candidate: { select: { id: true, fullName: true, avatarUrl: true } },
            employee: { select: { id: true, fullName: true, avatarUrl: true } },
            job: { include: { company: { select: { id: true, name: true, logoUrl: true } } } },
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { sender: { select: { id: true } } },
        },
        _count: {
          select: {
            messages: {
              where: { isRead: false, sender: { id: { not: userId } } },
            },
          },
        },
      },
    });

    return chats;
  },

  async getMessages(chatId: string, userId: string, page = 1, limit = 50) {
    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      include: {
        referralRequest: {
          select: {
            candidate: { select: { userId: true } },
            employee: { select: { userId: true } },
          },
        },
      },
    });

    if (!chat) throw NotFoundError('Chat');

    const { candidate, employee } = chat.referralRequest;
    // Only candidate and employee are participants in referral chats
    const isParticipant = candidate.userId === userId || (employee && employee.userId === userId);
    if (!isParticipant) {
      // Check if recruiter owns this referral directly
      const recruiter = await prisma.recruiter.findFirst({
        where: { userId, referralRequests: { some: { chat: { id: chatId } } } },
      });
      if (!recruiter) throw ForbiddenError('You are not part of this chat');
    }

    const skip = (page - 1) * limit;
    const [messages, total] = await Promise.all([
      prisma.message.findMany({
        where: { chatId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          sender: { select: { id: true, role: true, candidate: { select: { fullName: true, avatarUrl: true } }, employee: { select: { fullName: true, avatarUrl: true } } } },
        },
      }),
      prisma.message.count({ where: { chatId } }),
    ]);

    // Mark messages as read
    await prisma.message.updateMany({
      where: { chatId, isRead: false, senderId: { not: userId } },
      data: { isRead: true },
    });

    return { messages: messages.reverse(), total, page, limit };
  },

  async sendMessage(chatId: string, userId: string, content: string) {
    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      include: {
        referralRequest: {
          select: {
            candidate: { select: { userId: true } },
            employee: { select: { userId: true } },
          },
        },
      },
    });

    if (!chat) throw NotFoundError('Chat');

    const { candidate, employee } = chat.referralRequest;
    const isParticipant = candidate.userId === userId || (employee && employee.userId === userId);
    if (!isParticipant) {
      const recruiter = await prisma.recruiter.findFirst({
        where: { userId, referralRequests: { some: { chat: { id: chatId } } } },
      });
      if (!recruiter) throw ForbiddenError('You are not part of this chat');
    }

    const message = await prisma.message.create({
      data: { chatId, senderId: userId, content },
      include: {
        sender: { select: { id: true, role: true, candidate: { select: { fullName: true, avatarUrl: true } }, employee: { select: { fullName: true, avatarUrl: true } } } },
      },
    });

    return message;
  },
};
