import { Router } from 'express';
import { authenticate } from '../middleware/authMiddleware';
import * as leadController from '../controllers/leadController';

const router = Router();

// Public routes (Client submitting an inquiry from the website)
router.post('/public/trainers/:id/inquiry', leadController.createTrainerLead);

// Authenticated trainer routes (Trainer managing their leads in the dashboard)
router.get('/staff/leads', authenticate, leadController.getTrainerLeads);
router.patch('/staff/leads/:id', authenticate, leadController.updateTrainerLeadStatus);
router.delete('/staff/leads/:id', authenticate, leadController.deleteTrainerLead);

export default router;
