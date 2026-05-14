import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/authenticate';
import { userController } from './user.controller';

const router = Router();

router.get('/profile', authenticate, userController.getProfile);
router.put('/profile', authenticate, userController.updateProfile);
router.get('/recruiter/pipeline', authenticate, authorize('RECRUITER'), userController.getRecruiterPipeline);
router.get('/recruiter/stats', authenticate, authorize('RECRUITER'), userController.getRecruiterStats);
router.get('/candidates', authenticate, authorize('RECRUITER'), userController.getAllCandidates);

export default router;
