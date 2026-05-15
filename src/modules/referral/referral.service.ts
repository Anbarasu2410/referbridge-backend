import { prisma } from '../../lib/prisma';
import { AppError, NotFoundError, ForbiddenError, ConflictError } from '../../utils/AppError';
import { CreateReferralInput, UpdateReferralStatusInput, ReferralQueryInput } from './referral.schema';
import { UserRole } from '@prisma/client';

const referralInclude = {
  candidate: { select: { id: true, fullName: true, avatarUrl: true, headline: true, skills: true } },
  employee: { select: { id: true, fullName: true, avatarUrl: true, designation: true } },
  recruiter: { select: { id: true, fullName: true } },
  job: { include: { company: { select: { id: true, name: true, logoUrl: true } } } },
  chat: { select: { id: true } },
  reward: { select: { id: true, amount: true, status: true } },
};

export const referralService = {
  async listReferrals(userId: string, role: UserRole, query: ReferralQueryInput) {
    const { page, limit, status } = query;
    const skip = (page - 1) * limit;
    const where: any = {};

    if (status) where.status = status;

    if (role === 'CANDIDATE') {
      const candidate = await prisma.candidate.findUnique({ where: { userId } });
      if (!candidate) throw new AppError('Candidate profile not found', 404);
      where.candidateId = candidate.id;
    } else if (role === 'EMPLOYEE') {
      const employee = await prisma.employee.findUnique({ where: { userId } });
      if (!employee) throw new AppError('Employee profile not found', 404);
      where.employeeId = employee.id;
    } else {
      // Recruiter sees all referrals for their company's jobs
      const recruiter = await prisma.recruiter.findUnique({ where: { userId } });
      if (!recruiter) throw new AppError('Recruiter profile not found', 404);
      where.job = { companyId: recruiter.companyId };
    }

    const [referrals, total] = await Promise.all([
      prisma.referralRequest.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: referralInclude,
      }),
      prisma.referralRequest.count({ where }),
    ]);

    return { referrals, total, page, limit };
  },

  async getReferral(referralId: string, userId: string, role: UserRole) {
    const referral = await prisma.referralRequest.findUnique({
      where: { id: referralId },
      include: referralInclude,
    });
    if (!referral) throw NotFoundError('Referral request');

    // Access check
    if (role === 'CANDIDATE') {
      const candidate = await prisma.candidate.findUnique({ where: { userId } });
      if (referral.candidateId !== candidate?.id) throw ForbiddenError();
    } else if (role === 'EMPLOYEE') {
      const employee = await prisma.employee.findUnique({ where: { userId } });
      if (referral.employeeId !== employee?.id) throw ForbiddenError();
    }

    return referral;
  },

  async createReferral(userId: string, data: CreateReferralInput) {
    const candidate = await prisma.candidate.findUnique({ where: { userId } });
    if (!candidate) throw new AppError('Candidate profile not found', 404);

    const job = await prisma.job.findUnique({
      where: { id: data.jobId },
      include: { recruiter: { select: { id: true } } },
    });
    if (!job || job.status !== 'ACTIVE') throw new AppError('Job is not available', 400);

    // Check for duplicate
    const existing = await prisma.referralRequest.findUnique({
      where: { candidateId_jobId: { candidateId: candidate.id, jobId: data.jobId } },
    });
    if (existing) throw ConflictError('You have already requested a referral for this job');

    // Determine if this is a recruiter-direct job or employee-referred job
    const employeeId = data.employeeId || job.employeeId;
    const recruiterId = job.recruiter?.id ?? null;
    const isRecruiterJob = !employeeId && !!recruiterId;

    if (!isRecruiterJob && employeeId) {
      const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
      if (!employee || !employee.canRefer) throw new AppError('Employee cannot accept referrals', 400);
    }

    const referral = await prisma.$transaction(async (tx) => {
      const ref = await tx.referralRequest.create({
        data: {
          candidateId: candidate.id,
          employeeId: isRecruiterJob ? null : employeeId,
          recruiterId: isRecruiterJob ? recruiterId : null,
          jobId: data.jobId,
          coverNote: data.coverNote,
        },
        include: referralInclude,
      });
      await tx.chat.create({ data: { referralRequestId: ref.id } });
      return ref;
    });

    return referral;
  },

  async updateStatus(referralId: string, userId: string, role: UserRole, data: UpdateReferralStatusInput) {
    const referral = await prisma.referralRequest.findUnique({ where: { id: referralId } });
    if (!referral) throw NotFoundError('Referral request');

    // Validate who can update to what status
    if (role === 'CANDIDATE') {
      const candidate = await prisma.candidate.findUnique({ where: { userId } });
      if (referral.candidateId !== candidate?.id) throw ForbiddenError();
      if (data.status !== 'WITHDRAWN') throw ForbiddenError('Candidates can only withdraw referrals');
    } else if (role === 'EMPLOYEE') {
      const employee = await prisma.employee.findUnique({ where: { userId } });
      if (referral.employeeId !== employee?.id) throw ForbiddenError();
      const allowed = ['ACCEPTED', 'REJECTED', 'SUBMITTED'];
      if (!allowed.includes(data.status)) throw ForbiddenError('Employees can accept, reject, or submit referrals');
    } else if (role === 'RECRUITER') {
      // Recruiters can manage the full hiring pipeline including accepting pending referrals
      const allowed = ['ACCEPTED', 'REJECTED', 'SUBMITTED', 'INTERVIEWING', 'OFFERED', 'JOINED'];
      if (!allowed.includes(data.status)) throw ForbiddenError('Recruiters can accept, reject, or update hiring status');
    }

    const updateData: any = {
      status: data.status,
      employeeNote: data.employeeNote,
      rejectionReason: data.rejectionReason,
    };

    if (data.status === 'SUBMITTED') updateData.submittedAt = new Date();
    if (data.status === 'JOINED') {
      updateData.joinedAt = new Date();
      // Unlock reward if referral bonus exists
      const job = await prisma.job.findUnique({ where: { id: referral.jobId } });
      if (job?.referralBonus && referral.employeeId) {
        await prisma.reward.upsert({
          where: { referralRequestId: referralId },
          update: {},
          create: {
            employeeId: referral.employeeId,
            referralRequestId: referralId,
            amount: job.referralBonus,
          },
        });
        await prisma.employee.update({
          where: { id: referral.employeeId },
          data: { successfulReferrals: { increment: 1 } },
        });
      }
    }

    return prisma.referralRequest.update({
      where: { id: referralId },
      data: updateData,
      include: referralInclude,
    });
  },
};
