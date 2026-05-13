import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/authenticate';
import { validate, validateQuery } from '../../middleware/validate';
import { jobController } from './job.controller';
import { CreateJobSchema, UpdateJobSchema, JobQuerySchema } from './job.schema';

const router = Router();

router.get('/', authenticate, validateQuery(JobQuerySchema), jobController.list);
router.get('/:id', authenticate, jobController.get);
router.post('/', authenticate, authorize('EMPLOYEE'), validate(CreateJobSchema), jobController.create);
router.patch('/:id', authenticate, authorize('EMPLOYEE'), validate(UpdateJobSchema), jobController.update);
router.delete('/:id', authenticate, authorize('EMPLOYEE'), jobController.remove);

export default router;
