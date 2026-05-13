import { Request, Response, NextFunction } from 'express';
import { otpService } from './otp.service';
import { sendSuccess } from '../../utils/apiResponse';
import { z } from 'zod';
import { AppError } from '../../utils/AppError';

const ForgotSchema = z.object({ email: z.string().email() });
const ResetSchema = z.object({
  email: z.string().email(),
  otp: z.string().length(6),
  newPassword: z.string().min(8).regex(/[A-Z]/).regex(/[0-9]/),
});

export const otpController = {
  async sendOTP(req: Request, res: Response, next: NextFunction) {
    try {
      const { email } = ForgotSchema.parse(req.body);
      const result = await otpService.sendPasswordResetOTP(email);
      sendSuccess(res, null, result.message);
    } catch (error) {
      next(error);
    }
  },

  async resetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, otp, newPassword } = ResetSchema.parse(req.body);
      const result = await otpService.verifyOTPAndResetPassword(email, otp, newPassword);
      sendSuccess(res, null, result.message);
    } catch (error) {
      next(error);
    }
  },
};
