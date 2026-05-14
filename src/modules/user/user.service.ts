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

  async updateRecruiterProfile(userId: string, data: any) {
    const existing = await prisma.recruiter.findUnique({ where: { userId } });

    // Resolve company — find existing or create new
    const resolveCompany = async (companyName: string) => {
      const found = await prisma.company.findFirst({
        where: { name: { equals: companyName.trim(), mode: 'insensitive' } },
      });
      if (found) return found;
      return prisma.company.create({ data: { name: companyName.trim() } });
    };

    if (existing) {
      let companyId = existing.companyId;

      // If a new company name is provided, switch to that company
      if (data.companyName?.trim()) {
        const company = await resolveCompany(data.companyName);
        companyId = company.id;
      }

      return prisma.recruiter.update({
        where: { userId },
        data: {
          fullName: data.fullName || existing.fullName,
          designation: data.designation ?? existing.designation,
          linkedinUrl: data.linkedinUrl ?? existing.linkedinUrl,
          companyId,
        },
        include: { company: true },
      });
    }

    // No recruiter row yet — create one
    const companyName = data.companyName?.trim() || `${data.fullName || 'My'}'s Company`;
    const company = await resolveCompany(companyName);

    return prisma.recruiter.create({
      data: {
        userId,
        fullName: data.fullName || '',
        companyId: company.id,
        designation: data.designation || 'Recruiter',
        linkedinUrl: data.linkedinUrl,
      },
      include: { company: true },
    });
  },

  async getRecruiterPipeline(userId: string, query: { page: number; limit: number; status?: string }) {
    const recruiter = await prisma.recruiter.findUnique({ where: { userId } });
    if (!recruiter) throw new AppError('Recruiter profile not found', 404);

    const { page, limit, status } = query;
    const skip = (page - 1) * limit;
    const where: any = { job: { companyId: recruiter.companyId } };
    if (status) where.status = status;

    const [referrals, total] = await Promise.all([
      prisma.referralRequest.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: {
          candidate: { select: { id: true, fullName: true, avatarUrl: true, headline: true, skills: true, experienceYears: true } },
          employee: { select: { id: true, fullName: true, designation: true } },
          job: { select: { id: true, title: true, company: { select: { id: true, name: true } } } },
          chat: { select: { id: true } },
        },
      }),
      prisma.referralRequest.count({ where }),
    ]);

    return { referrals, total, page, limit };
  },

  async getRecruiterStats(userId: string) {
    const recruiter = await prisma.recruiter.findUnique({ where: { userId } });
    if (!recruiter) throw new AppError('Recruiter profile not found', 404);

    const companyId = recruiter.companyId;

    const [activeJobs, totalCandidates, hired, interviewing] = await Promise.all([
      prisma.job.count({ where: { companyId, status: 'ACTIVE' } }),
      prisma.referralRequest.count({ where: { job: { companyId } } }),
      prisma.referralRequest.count({ where: { job: { companyId }, status: 'JOINED' } }),
      prisma.referralRequest.count({ where: { job: { companyId }, status: 'INTERVIEWING' } }),
    ]);

    return { activeJobs, totalCandidates, hired, interviewing };
  },

  async getAllCandidates(query: { page: number; limit: number; search?: string; skills?: string }) {
    const { page, limit, search, skills } = query;
    const skip = (page - 1) * limit;
    const where: any = {};

    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { headline: { contains: search, mode: 'insensitive' } },
        { currentLocation: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (skills) {
      const skillList = skills.split(',').map((s) => s.trim());
      where.skills = { hasSome: skillList };
    }

    const [candidates, total] = await Promise.all([
      prisma.candidate.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          fullName: true,
          avatarUrl: true,
          headline: true,
          skills: true,
          experienceYears: true,
          currentLocation: true,
          isOpenToWork: true,
          userId: true,
          directChats: { select: { id: true, recruiterId: true } },
        },
      }),
      prisma.candidate.count({ where }),
    ]);

    return { candidates, total, page, limit };
  },
};
