import { Request, Response, NextFunction } from 'express';
import { jobService } from './job.service';
import { sendSuccess, sendPaginated } from '../../utils/apiResponse';
import { JobQueryInput } from './job.schema';

export const jobController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const query = req.query as unknown as JobQueryInput;
      const { jobs, total, page, limit } = await jobService.listJobs(
        query,
        req.user!.id,
        req.user!.role
      );
      sendPaginated(res, jobs, total, page, limit);
    } catch (err) {
      next(err);
    }
  },

  async get(req: Request, res: Response, next: NextFunction) {
    try {
      const job = await jobService.getJob(req.params.id);
      sendSuccess(res, job);
    } catch (err) {
      next(err);
    }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const job = await jobService.createJob(req.user!.id, req.body, req.user!.role);
      sendSuccess(res, job, 'Job posted successfully', 201);
    } catch (err) {
      next(err);
    }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const job = await jobService.updateJob(req.params.id, req.user!.id, req.body);
      sendSuccess(res, job, 'Job updated');
    } catch (err) {
      next(err);
    }
  },

  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      await jobService.deleteJob(req.params.id, req.user!.id);
      sendSuccess(res, null, 'Job closed');
    } catch (err) {
      next(err);
    }
  },
};
