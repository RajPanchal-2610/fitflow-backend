import { Router } from 'express';
import { authenticate } from '../middleware/authMiddleware';
import { logPersonalWorkout, getPersonalStats } from '../controllers/workoutController';

const router = Router();

router.post('/personal', authenticate, logPersonalWorkout);
router.get('/stats', authenticate, getPersonalStats);

export default router;
