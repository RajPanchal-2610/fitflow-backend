import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import * as globalTournamentService from '../services/globalTournamentService';

// =========================================================================
// Super Admin Controllers
// =========================================================================

export const createGlobalTournament = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { name, description, start_date, end_date, rules, entry_criteria } = req.body;
        const userId = req.user?.id;

        if (!name || !start_date || !end_date) {
            return res.status(400).json({ error: 'Missing required fields: name, start_date, end_date' });
        }

        const tournament = await globalTournamentService.createGlobalTournament({
            name,
            description,
            start_date,
            end_date,
            rules,
            entry_criteria,
            created_by: userId
        });

        res.status(201).json(tournament);
    } catch (error: any) {
        console.error('Create global tournament error:', error);
        res.status(500).json({ error: error.message || 'Failed to create global tournament' });
    }
};

export const updateGlobalTournament = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id } = req.params;
        const tournament = await globalTournamentService.updateGlobalTournament(id, req.body);
        res.json(tournament);
    } catch (error: any) {
        console.error('Update global tournament error:', error);
        res.status(500).json({ error: error.message || 'Failed to update global tournament' });
    }
};

export const deleteGlobalTournament = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id } = req.params;
        await globalTournamentService.deleteGlobalTournament(id);
        res.json({ success: true, message: 'Tournament deleted successfully' });
    } catch (error: any) {
        console.error('Delete global tournament error:', error);
        res.status(500).json({ error: error.message || 'Failed to delete global tournament' });
    }
};

export const disqualifySession = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { sessionId } = req.params;
        const { reason } = req.body;

        if (!reason) {
            return res.status(400).json({ error: 'Disqualification reason is required' });
        }

        const session = await globalTournamentService.disqualifySession(sessionId, reason);
        res.json(session);
    } catch (error: any) {
        console.error('Disqualify session error:', error);
        res.status(500).json({ error: error.message || 'Failed to disqualify session' });
    }
};

export const getSessionAuditLogs = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { sessionId } = req.params;
        const auditData = await globalTournamentService.getSessionAuditLogs(sessionId);
        res.json(auditData);
    } catch (error: any) {
        console.error('Get session audit logs error:', error);
        res.status(500).json({ error: error.message || 'Failed to fetch session audit logs' });
    }
};

// =========================================================================
// User & Public Controllers
// =========================================================================

export const getGlobalTournaments = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { status } = req.query;
        const tournaments = await globalTournamentService.getGlobalTournaments({ status: status as string });
        res.json(tournaments);
    } catch (error: any) {
        console.error('Get global tournaments error:', error);
        res.status(500).json({ error: 'Failed to fetch global tournaments' });
    }
};

export const getGlobalTournamentById = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id } = req.params;
        const tournament = await globalTournamentService.getGlobalTournamentById(id);
        if (!tournament) {
            return res.status(404).json({ error: 'Global tournament not found' });
        }
        res.json(tournament);
    } catch (error: any) {
        console.error('Get global tournament detail error:', error);
        res.status(500).json({ error: 'Failed to fetch global tournament details' });
    }
};

export const registerForTournament = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id } = req.params;
        const userId = req.user?.id;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized: User ID not found' });
        }

        const registration = await globalTournamentService.registerParticipant(id, userId);
        res.status(201).json(registration);
    } catch (error: any) {
        console.error('Register for global tournament error:', error);
        res.status(500).json({ error: error.message || 'Failed to register for tournament' });
    }
};

export const startSession = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { tournamentId, baselineFaceEmbedding, baselinePhotoUrl } = req.body;
        const userId = req.user?.id;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized: User ID not found' });
        }
        if (!tournamentId || !baselineFaceEmbedding || !baselinePhotoUrl) {
            return res.status(400).json({ error: 'Missing baseline verification parameters' });
        }

        const session = await globalTournamentService.startSession({
            tournamentId,
            userId,
            baselineFaceEmbedding,
            baselinePhotoUrl
        });

        res.status(201).json(session);
    } catch (error: any) {
        console.error('Start tournament session error:', error);
        res.status(500).json({ error: error.message || 'Failed to start tournament session' });
    }
};

export const submitSessionLog = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { sessionId } = req.params;
        const { pushupCountAtMoment, faceMatchConfidence, poseConfidence, isSuspicious, suspiciousReason, screenshotUrl } = req.body;

        if (pushupCountAtMoment === undefined || faceMatchConfidence === undefined || poseConfidence === undefined) {
            return res.status(400).json({ error: 'Missing log metadata' });
        }

        const result = await globalTournamentService.submitSessionLog({
            sessionId,
            pushupCountAtMoment,
            faceMatchConfidence,
            poseConfidence,
            isSuspicious: !!isSuspicious,
            suspiciousReason,
            screenshotUrl
        });

        res.json(result);
    } catch (error: any) {
        console.error('Submit session log error:', error);
        res.status(500).json({ error: error.message || 'Failed to record session log' });
    }
};

export const pauseSession = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { sessionId } = req.params;
        const session = await globalTournamentService.pauseSession(sessionId);
        res.json(session);
    } catch (error: any) {
        console.error('Pause session error:', error);
        res.status(500).json({ error: error.message || 'Failed to pause session' });
    }
};

export const resumeSession = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { sessionId } = req.params;
        const session = await globalTournamentService.resumeSession(sessionId);
        res.json(session);
    } catch (error: any) {
        console.error('Resume session error:', error);
        res.status(500).json({ error: error.message || 'Failed to resume session' });
    }
};

export const endSession = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { sessionId } = req.params;
        const session = await globalTournamentService.endSession(sessionId);
        res.json(session);
    } catch (error: any) {
        console.error('End session error:', error);
        res.status(500).json({ error: error.message || 'Failed to end session' });
    }
};

export const getTournamentLeaderboard = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id } = req.params;
        const leaderboard = await globalTournamentService.getTournamentLeaderboard(id);
        res.json(leaderboard);
    } catch (error: any) {
        console.error('Get leaderboard error:', error);
        res.status(500).json({ error: error.message || 'Failed to fetch leaderboard' });
    }
};

export const getSessionUploadEligibility = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { sessionId } = req.params;
        const eligibility = await globalTournamentService.getSessionUploadEligibility(sessionId);
        res.json(eligibility);
    } catch (error: any) {
        console.error('Get upload eligibility error:', error);
        res.status(500).json({ error: error.message || 'Failed to check upload eligibility' });
    }
};

export const getMySessionsEligibility = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        const eligibilities = await globalTournamentService.getMySessionsEligibility(userId);
        res.json(eligibilities);
    } catch (error: any) {
        console.error('Get user-wide upload eligibility error:', error);
        res.status(500).json({ error: error.message || 'Failed to check user upload eligibility' });
    }
};


