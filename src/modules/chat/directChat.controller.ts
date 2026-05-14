import { Request, Response, NextFunction } from 'express';
import { directChatService } from './directChat.service';
import { sendSuccess, sendPaginated } from '../../utils/apiResponse';

export const directChatController = {
  async getOrCreate(req: Request, res: Response, next: NextFunction) {
    try {
      const { candidateId } = req.body;
      const chat = await directChatService.getOrCreate(req.user!.id, candidateId);
      sendSuccess(res, chat);
    } catch (err) {
      next(err);
    }
  },

  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const role = req.user!.role;
      const chats = role === 'RECRUITER'
        ? await directChatService.listForRecruiter(req.user!.id)
        : await directChatService.listForCandidate(req.user!.id);
      sendSuccess(res, chats);
    } catch (err) {
      next(err);
    }
  },

  async getMessages(req: Request, res: Response, next: NextFunction) {
    try {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 50;
      const { messages, total } = await directChatService.getMessages(req.params.id, req.user!.id, page, limit);
      sendPaginated(res, messages, total, page, limit);
    } catch (err) {
      next(err);
    }
  },

  async sendMessage(req: Request, res: Response, next: NextFunction) {
    try {
      const { content } = req.body;
      if (!content?.trim()) return sendSuccess(res, null, 'Message cannot be empty', 400);
      const message = await directChatService.sendMessage(req.params.id, req.user!.id, content.trim());
      sendSuccess(res, message, 'Message sent', 201);
    } catch (err) {
      next(err);
    }
  },
};
