import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/authenticate';
import { chatController } from './chat.controller';

const router = Router();

router.get('/', authenticate, authorize('CANDIDATE', 'EMPLOYEE'), chatController.list);
router.get('/:id/messages', authenticate, chatController.getMessages);
router.post('/:id/messages', authenticate, chatController.sendMessage);

export default router;
