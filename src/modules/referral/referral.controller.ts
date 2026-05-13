import { Request, Response, NextFunction } from 'express';
import { referralService } from './referral.service';
import { sendSuccess, sendPaginated } from '../../utils/apiResponse';
import { ReferralQueryInput } from './referral.schema';

export const referralController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const query = req.query as unknown as ReferralQueryInput;
      const { referrals, total, page, limit } = await referralService.listReferrals(
        req.user!.id,
        req.user!.role,
        query
      );
      sendPaginated(res, referrals, total, page, limit);
    } catch (err) {
      next(err);
    }
  },

  async get(req: Request, res: Response, next: NextFunction) {
    try {
      const referral = await referralService.getReferral(req.params.id, req.user!.id, req.user!.role);
      sendSuccess(res, referral);
    } catch (err) {
      next(err);
    }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const referral = await referralService.createReferral(req.user!.id, req.body);
      sendSuccess(res, referral, 'Referral request sent', 201);
    } catch (err) {
      next(err);
    }
  },

  async updateStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const referral = await referralService.updateStatus(
        req.params.id,
        req.user!.id,
        req.user!.role,
        req.body
      );
      sendSuccess(res, referral, 'Status updated');
    } catch (err) {
      next(err);
    }
  },
};
