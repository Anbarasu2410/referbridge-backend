import { prisma } from '../../lib/prisma';
import { AppError } from '../../utils/AppError';
import { UserRole } from '@prisma/client';

export const userService = {
  async getProfile(userId: string, role: UserRole) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        phone: true,
        role: true,
        isVerified: true,
        createdAt: true,
        candidate: true,
        employee: {
          include: { company: true },
        },
        recruiter: {
          include: { company: true },
        },
      },
    });

    if (!user) throw new AppError('User not found', 404);
    return user;
  },

  async updateCandidateProfile(userId: string, data: any) {
    const candidate = await prisma.candidate.upsert({
      where: { userId },
      update: data,
      create: { userId, fullName: data.fullName || '', ...data },
    });
    return candidate;
  },
};
