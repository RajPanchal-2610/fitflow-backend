import { Router } from 'express';
import { authenticate } from '../middleware/authMiddleware';
import * as gymController from '../controllers/gymController';

const router = Router();

// Public routes
router.get('/', gymController.searchGyms);
router.post('/register-owner', gymController.registerGymOwner);

// Authenticated athlete routes
router.post('/join-request', authenticate, gymController.createJoinRequest);

// Authenticated owner routes (requiring the owner to verify they own the gym)
router.get('/join-requests/:gymId', authenticate, gymController.getJoinRequests);
router.put('/join-requests/:requestId', authenticate, gymController.updateJoinRequest);

export default router;
