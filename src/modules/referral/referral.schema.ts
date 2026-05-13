import { z } from 'zod';

export const CreateReferralSchema = z.object({
  jobId: z.string().cuid(),
  employeeId: z.string().cuid(),
  coverNote: z.string().max(1000).optional(),
});

export const UpdateReferralStatusSchema = z.object({
  status: z.enum(['ACCEPTED', 'REJECTED', 'SUBMITTED', 'INTERVIEWING', 'OFFERED', 'JOINED', 'WITHDRAWN']),
  employeeNote: z.string().max(500).optional(),
  rejectionReason: z.string().max(500).optional(),
});

export const ReferralQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(20),
  status: z.enum(['PENDING', 'ACCEPTED', 'REJECTED', 'SUBMITTED', 'INTERVIEWING', 'OFFERED', 'JOINED', 'WITHDRAWN']).optional(),
});

export type CreateReferralInput = z.infer<typeof CreateReferralSchema>;
export type UpdateReferralStatusInput = z.infer<typeof UpdateReferralStatusSchema>;
export type ReferralQueryInput = z.infer<typeof ReferralQuerySchema>;
