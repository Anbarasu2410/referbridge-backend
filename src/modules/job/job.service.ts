import { prisma } from '../../lib/prisma';
import { AppError, NotFoundError, ForbiddenError } from '../../utils/AppError';
import { CreateJobInput, UpdateJobInput, JobQueryInput } from './job.schema';
import { UserRole } from '@prisma/client';

export const jobService = {
  async listJobs(query: JobQueryInput, userId: string, role: UserRole) {
    const { page, limit, search, location, isRemote, skills, status } = query;
    const skip = (page - 1) * limit;

    const where: any = {};

    // Employees see only their own jobs; candidates/recruiters see all ACTIVE
    if (role === 'EMPLOYEE') {
      const employee = await prisma.employee.findUnique({ where: { userId } });
      if (!employee) throw new AppError('Employee profile not found', 404);
      where.employeeId = employee.id;
      if (status) where.status = status;
    } else {
      where.status = status || 'ACTIVE';
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { company: { name: { contains: search, mode: 'insensitive' } } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (location) {
      where.location = { contains: location, mode: 'insensitive' };
    }

    if (isRemote !== undefined) {
      where.isRemote = isRemote;
    }

    if (skills) {
      const skillList = skills.split(',').map((s) => s.trim());
      where.requiredSkills = { hasSome: skillList };
    }

    const [jobs, total] = await Promise.all([
      prisma.job.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          company: { select: { id: true, name: true, logoUrl: true, industry: true } },
          employee: { select: { id: true, fullName: true, designation: true } },
          _count: { select: { referralRequests: true } },
        },
      }),
      prisma.job.count({ where }),
    ]);

    return { jobs, total, page, limit };
  },

  async getJob(jobId: string) {
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: {
        company: true,
        employee: { select: { id: true, fullName: true, designation: true, avatarUrl: true } },
        _count: { select: { referralRequests: true } },
      },
    });
    if (!job) throw NotFoundError('Job');
    return job;
  },

  async createJob(userId: string, data: CreateJobInput) {
    const employee = await prisma.employee.findUnique({ where: { userId } });
    if (!employee) throw new AppError('Employee profile not found', 404);

    const job = await prisma.job.create({
      data: {
        ...data,
        employeeId: employee.id,
        companyId: employee.companyId,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
      },
      include: {
        company: { select: { id: true, name: true, logoUrl: true } },
      },
    });
    return job;
  },

  async updateJob(jobId: string, userId: string, data: UpdateJobInput) {
    const employee = await prisma.employee.findUnique({ where: { userId } });
    if (!employee) throw new AppError('Employee profile not found', 404);

    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) throw NotFoundError('Job');
    if (job.employeeId !== employee.id) throw ForbiddenError('You do not own this job');

    return prisma.job.update({
      where: { id: jobId },
      data: {
        ...data,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
      },
      include: {
        company: { select: { id: true, name: true, logoUrl: true } },
      },
    });
  },

  async deleteJob(jobId: string, userId: string) {
    const employee = await prisma.employee.findUnique({ where: { userId } });
    if (!employee) throw new AppError('Employee profile not found', 404);

    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) throw NotFoundError('Job');
    if (job.employeeId !== employee.id) throw ForbiddenError('You do not own this job');

    await prisma.job.update({ where: { id: jobId }, data: { status: 'CLOSED' } });
  },
};
