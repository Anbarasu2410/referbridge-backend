import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { validate, validateQuery } from '../../middleware/validate';
import { referralController } from './referral.controller';
import { CreateReferralSchema, UpdateReferralStatusSchema, ReferralQuerySchema } from './referral.schema';

const router = Router();

router.get('/', authenticate, validateQuery(ReferralQuerySchema), referralController.list);
router.get('/:id', authenticate, referralController.get);
router.post('/', authenticate, validate(CreateReferralSchema), referralController.create);
router.patch('/:id/status', authenticate, validate(UpdateReferralStatusSchema), referralController.updateStatus);

export default router;
