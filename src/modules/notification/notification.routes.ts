import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';

const router = Router();

router.get('/', authenticate, (req, res) => {
  res.json({ success: true, data: [], message: 'Notifications endpoint — coming in Phase 5' });
});

export default router;
