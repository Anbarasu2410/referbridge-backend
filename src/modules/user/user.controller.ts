import { Request, Response, NextFunction } from 'express';
import { userService } from './user.service';
import { sendSuccess } from '../../utils/apiResponse';

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
      const updated = await userService.updateCandidateProfile(req.user!.id, req.body);
      sendSuccess(res, updated, 'Profile updated');
    } catch (error) {
      next(error);
    }
  },
};
