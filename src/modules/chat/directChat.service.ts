import { prisma } from '../../lib/prisma';
import { AppError, NotFoundError, ForbiddenError } from '../../utils/AppError';

const directChatInclude = {
  recruiter: { select: { id: true, fullName: true, avatarUrl: true } },
  candidate: { select: { id: true, fullName: true, avatarUrl: true } },
  messages: {
    orderBy: { createdAt: 'desc' as const },
    take: 1,
    include: { sender: { select: { id: true } } },
  },
  _count: { select: { messages: true } },
};

export const directChatService = {
  async getOrCreate(recruiterUserId: string, candidateId: string) {
    const recruiter = await prisma.recruiter.findUnique({ where: { userId: recruiterUserId } });
    if (!recruiter) throw new AppError('Recruiter profile not found', 404);

    const candidate = await prisma.candidate.findUnique({ where: { id: candidateId } });
    if (!candidate) throw NotFoundError('Candidate');

    const existing = await prisma.directChat.findUnique({
      where: { recruiterId_candidateId: { recruiterId: recruiter.id, candidateId } },
      include: directChatInclude,
    });
    if (existing) return existing;

    return prisma.directChat.create({
      data: { recruiterId: recruiter.id, candidateId },
      include: directChatInclude,
    });
  },

  async listForRecruiter(recruiterUserId: string) {
    const recruiter = await prisma.recruiter.findUnique({ where: { userId: recruiterUserId } });
    if (!recruiter) throw new AppError('Recruiter profile not found', 404);

    return prisma.directChat.findMany({
      where: { recruiterId: recruiter.id },
      orderBy: { createdAt: 'desc' },
      include: directChatInclude,
    });
  },

  async listForCandidate(candidateUserId: string) {
    const candidate = await prisma.candidate.findUnique({ where: { userId: candidateUserId } });
    if (!candidate) throw new AppError('Candidate profile not found', 404);

    return prisma.directChat.findMany({
      where: { candidateId: candidate.id },
      orderBy: { createdAt: 'desc' },
      include: directChatInclude,
    });
  },

  async getMessages(directChatId: string, userId: string, page = 1, limit = 50) {
    const chat = await prisma.directChat.findUnique({
      where: { id: directChatId },
      include: {
        recruiter: { select: { userId: true } },
        candidate: { select: { userId: true } },
      },
    });
    if (!chat) throw NotFoundError('Chat');
    if (chat.recruiter.userId !== userId && chat.candidate.userId !== userId) {
      throw ForbiddenError('You are not part of this chat');
    }

    const skip = (page - 1) * limit;
    const [messages, total] = await Promise.all([
      prisma.directMessage.findMany({
        where: { directChatId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          sender: {
            select: {
              id: true, role: true,
              candidate: { select: { fullName: true, avatarUrl: true } },
              recruiter: { select: { fullName: true, avatarUrl: true } },
            },
          },
        },
      }),
      prisma.directMessage.count({ where: { directChatId } }),
    ]);

    await prisma.directMessage.updateMany({
      where: { directChatId, isRead: false, senderId: { not: userId } },
      data: { isRead: true },
    });

    return { messages: messages.reverse(), total, page, limit };
  },

  async sendMessage(directChatId: string, userId: string, content: string) {
    const chat = await prisma.directChat.findUnique({
      where: { id: directChatId },
      include: {
        recruiter: { select: { userId: true } },
        candidate: { select: { userId: true } },
      },
    });
    if (!chat) throw NotFoundError('Chat');
    if (chat.recruiter.userId !== userId && chat.candidate.userId !== userId) {
      throw ForbiddenError('You are not part of this chat');
    }

    return prisma.directMessage.create({
      data: { directChatId, senderId: userId, content },
      include: {
        sender: {
          select: {
            id: true, role: true,
            candidate: { select: { fullName: true, avatarUrl: true } },
            recruiter: { select: { fullName: true, avatarUrl: true } },
          },
        },
      },
    });
  },
};
