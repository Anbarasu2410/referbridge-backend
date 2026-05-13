import { z } from 'zod';

export const CreateJobSchema = z.object({
  title: z.string().min(3).max(100),
  description: z.string().min(10),
  requiredSkills: z.array(z.string()).min(1),
  experienceMin: z.number().int().min(0).default(0),
  experienceMax: z.number().int().min(0).default(10),
  location: z.string().min(2),
  isRemote: z.boolean().default(false),
  salaryMin: z.number().int().positive().optional(),
  salaryMax: z.number().int().positive().optional(),
  referralBonus: z.number().int().positive().optional(),
  openings: z.number().int().positive().default(1),
  expiresAt: z.string().datetime().optional(),
});

export const UpdateJobSchema = CreateJobSchema.partial().extend({
  status: z.enum(['ACTIVE', 'PAUSED', 'CLOSED']).optional(),
});

export const JobQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(20),
  search: z.string().optional(),
  location: z.string().optional(),
  isRemote: z.coerce.boolean().optional(),
  skills: z.string().optional(), // comma-separated
  status: z.enum(['ACTIVE', 'PAUSED', 'CLOSED']).optional(),
});

export type CreateJobInput = z.infer<typeof CreateJobSchema>;
export type UpdateJobInput = z.infer<typeof UpdateJobSchema>;
export type JobQueryInput = z.infer<typeof JobQuerySchema>;
