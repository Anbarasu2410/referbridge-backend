import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { userController } from './user.controller';

const router = Router();

router.get('/profile', authenticate, userController.getProfile);
router.put('/profile', authenticate, userController.updateProfile);

export default router;
