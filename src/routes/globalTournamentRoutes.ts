import { Router } from 'express';
import { authenticate, requireSuperAdmin } from '../middleware/authMiddleware';
import * as globalTournamentController from '../controllers/globalTournamentController';

const router = Router();

// =========================================
// Global Tournament Management (Super Admin only)
// =========================================
router.post('/', ...requireSuperAdmin, globalTournamentController.createGlobalTournament);
router.patch('/:id', ...requireSuperAdmin, globalTournamentController.updateGlobalTournament);
router.delete('/:id', ...requireSuperAdmin, globalTournamentController.deleteGlobalTournament);
router.post('/sessions/:sessionId/disqualify', ...requireSuperAdmin, globalTournamentController.disqualifySession);
router.get('/sessions/:sessionId/audit', ...requireSuperAdmin, globalTournamentController.getSessionAuditLogs);

// =========================================
// Mobile App & Participant Interactions
// =========================================
router.get('/', authenticate, globalTournamentController.getGlobalTournaments);
router.get('/:id', authenticate, globalTournamentController.getGlobalTournamentById);
router.post('/:id/register', authenticate, globalTournamentController.registerForTournament);
router.get('/:id/leaderboard', authenticate, globalTournamentController.getTournamentLeaderboard);

// Session Actions
router.post('/sessions/start', authenticate, globalTournamentController.startSession);
router.get('/sessions/eligibility/me', authenticate, globalTournamentController.getMySessionsEligibility);
router.post('/sessions/:sessionId/logs', authenticate, globalTournamentController.submitSessionLog);
router.post('/sessions/:sessionId/pause', authenticate, globalTournamentController.pauseSession);
router.post('/sessions/:sessionId/resume', authenticate, globalTournamentController.resumeSession);
router.post('/sessions/:sessionId/end', authenticate, globalTournamentController.endSession);
router.get('/sessions/:sessionId/upload-eligibility', authenticate, globalTournamentController.getSessionUploadEligibility);

export default router;
