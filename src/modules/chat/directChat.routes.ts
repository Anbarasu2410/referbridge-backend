import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/authenticate';
import { directChatController } from './directChat.controller';

const router = Router();

// List all direct chats (recruiter or candidate)
router.get('/', authenticate, authorize('RECRUITER', 'CANDIDATE'), directChatController.list);

// Recruiter opens/creates a direct chat with a candidate
router.post('/', authenticate, authorize('RECRUITER'), directChatController.getOrCreate);

// Messages
router.get('/:id/messages', authenticate, directChatController.getMessages);
router.post('/:id/messages', authenticate, directChatController.sendMessage);

export default router;
