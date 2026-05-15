import { prisma } from '../../lib/prisma';
import { AppError, NotFoundError, ForbiddenError } from '../../utils/AppError';
import { CreateJobInput, UpdateJobInput, JobQueryInput } from './job.schema';
import { UserRole } from '@prisma/client';

export const jobService = {
  async listJobs(query: JobQueryInput, userId: string, role: UserRole) {
    const { page, limit, search, location, isRemote, skills, status, myJobs } = query;
    const skip = (page - 1) * limit;
    const where: any = {};

    if (role === 'EMPLOYEE' && myJobs) {
      // Employee viewing only their own postings
      const employee = await prisma.employee.findUnique({ where: { userId } });
      if (!employee) throw new AppError('Employee profile not found', 404);
      where.employeeId = employee.id;
      if (status) where.status = status;
    } else if (role === 'EMPLOYEE') {
      // Employee browsing all jobs — only show employee-posted jobs (referral-based), not recruiter-direct jobs
      where.status = status || 'ACTIVE';
      where.employeeId = { not: null }; // only jobs posted by employees
    } else {
      // Candidate sees all ACTIVE jobs (both employee and recruiter posted)
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
          recruiter: { select: { id: true, fullName: true } },
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

  async createJob(userId: string, data: CreateJobInput, role: UserRole) {
    if (role === 'RECRUITER') {
      const recruiter = await prisma.recruiter.findUnique({ where: { userId } });
      if (!recruiter) throw new AppError('Recruiter profile not found', 404);

      // Optionally link to an employee at the company if one exists
      const anyEmployee = await prisma.employee.findFirst({ where: { companyId: recruiter.companyId } });

      const job = await prisma.job.create({
        data: {
          title: data.title,
          description: data.description,
          requiredSkills: data.requiredSkills,
          experienceMin: data.experienceMin,
          experienceMax: data.experienceMax,
          location: data.location,
          isRemote: data.isRemote,
          salaryMin: data.salaryMin,
          salaryMax: data.salaryMax,
          referralBonus: data.referralBonus,
          openings: data.openings,
          employeeId: anyEmployee?.id ?? null,
          recruiterId: recruiter.id,
          companyId: recruiter.companyId,
          expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
        },
        include: { company: { select: { id: true, name: true, logoUrl: true } } },
      });
      return job;
    }

    const employee = await prisma.employee.findUnique({ where: { userId } });
    if (!employee) throw new AppError('Employee profile not found', 404);

    const job = await prisma.job.create({
      data: {
        title: data.title,
        description: data.description,
        requiredSkills: data.requiredSkills,
        experienceMin: data.experienceMin,
        experienceMax: data.experienceMax,
        location: data.location,
        isRemote: data.isRemote,
        salaryMin: data.salaryMin,
        salaryMax: data.salaryMax,
        referralBonus: data.referralBonus,
        openings: data.openings,
        employee: { connect: { id: employee.id } },
        company: { connect: { id: employee.companyId } },
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
      },
      include: { company: { select: { id: true, name: true, logoUrl: true } } },
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
