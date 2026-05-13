import { Router } from 'express';
import { authController } from './auth.controller';
import { otpController } from './otp.controller';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/authenticate';
import { authRateLimiter } from '../../middleware/rateLimiter';
import { RegisterSchema, LoginSchema, RefreshTokenSchema } from './auth.schema';

const router = Router();

router.post('/register', authRateLimiter, validate(RegisterSchema), authController.register);
router.post('/login', authRateLimiter, validate(LoginSchema), authController.login);
router.post('/refresh', validate(RefreshTokenSchema), authController.refresh);
router.post('/logout', authController.logout);
router.get('/me', authenticate, authController.me);
router.post('/forgot-password', authRateLimiter, otpController.sendOTP);
router.post('/reset-password', authRateLimiter, otpController.resetPassword);

export default router;
