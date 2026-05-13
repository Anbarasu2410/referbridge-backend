import { Request, Response, NextFunction } from 'express';
import { chatService } from './chat.service';
import { sendSuccess, sendPaginated } from '../../utils/apiResponse';

export const chatController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const chats = await chatService.listChats(req.user!.id, req.user!.role);
      sendSuccess(res, chats);
    } catch (err) {
      next(err);
    }
  },

  async getMessages(req: Request, res: Response, next: NextFunction) {
    try {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 50;
      const { messages, total } = await chatService.getMessages(req.params.id, req.user!.id, page, limit);
      sendPaginated(res, messages, total, page, limit);
    } catch (err) {
      next(err);
    }
  },

  async sendMessage(req: Request, res: Response, next: NextFunction) {
    try {
      const { content } = req.body;
      if (!content?.trim()) {
        return sendSuccess(res, null, 'Message cannot be empty', 400);
      }
      const message = await chatService.sendMessage(req.params.id, req.user!.id, content.trim());
      sendSuccess(res, message, 'Message sent', 201);
    } catch (err) {
      next(err);
    }
  },
};
