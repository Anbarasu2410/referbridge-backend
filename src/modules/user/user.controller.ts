import { Request, Response, NextFunction } from 'express';
import { userService } from './user.service';
import { sendSuccess, sendPaginated } from '../../utils/apiResponse';

export const userController = {
  async getProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const profile = await userService.getProfile(req.user!.id, req.user!.role);
      sendSuccess(res, profile);
    } catch (error) {
      next(error);
    }
  },

  async updateProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const role = req.user!.role;
      let updated;
      if (role === 'RECRUITER') {
        updated = await userService.updateRecruiterProfile(req.user!.id, req.body);
      } else {
        updated = await userService.updateCandidateProfile(req.user!.id, req.body);
      }
      sendSuccess(res, updated, 'Profile updated');
    } catch (error) {
      next(error);
    }
  },

  async getRecruiterPipeline(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const status = req.query.status as string | undefined;
      const result = await userService.getRecruiterPipeline(req.user!.id, { page, limit, status });
      sendPaginated(res, result.referrals, result.total, result.page, result.limit);
    } catch (error) {
      next(error);
    }
  },

  async getRecruiterStats(req: Request, res: Response, next: NextFunction) {
    try {
      const stats = await userService.getRecruiterStats(req.user!.id);
      sendSuccess(res, stats);
    } catch (error) {
      next(error);
    }
  },
};
