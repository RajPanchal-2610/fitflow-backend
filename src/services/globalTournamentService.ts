import { supabaseAdmin } from '../lib/supabase';

// =========================================================================
// Global Tournament CRUD
// =========================================================================

export async function createGlobalTournament(data: {
    name: string;
    description?: string;
    start_date: string;
    end_date: string;
    rules?: any;
    entry_criteria?: any;
    created_by?: string;
}) {
    const { data: tournament, error } = await supabaseAdmin
        .from('global_tournaments')
        .insert([{
            name: data.name,
            description: data.description,
            start_date: data.start_date,
            end_date: data.end_date,
            rules: data.rules || {},
            entry_criteria: data.entry_criteria || {},
            status: 'DRAFT',
            created_by: data.created_by
        }])
        .select()
        .single();

    if (error) throw error;
    return tournament;
}

export async function getGlobalTournaments(filters: { status?: string }) {
    let query = supabaseAdmin
        .from('global_tournaments')
        .select('*');

    if (filters.status) {
        query = query.eq('status', filters.status);
    }

    const { data, error } = await query.order('start_date', { ascending: true });
    if (error) throw error;
    return data;
}

export async function getGlobalTournamentById(id: string) {
    const { data: tournament, error } = await supabaseAdmin
        .from('global_tournaments')
        .select('*')
        .eq('id', id)
        .maybeSingle();

    if (error) throw error;
    return tournament;
}

export async function updateGlobalTournament(id: string, updates: any) {
    const { data, error } = await supabaseAdmin
        .from('global_tournaments')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function deleteGlobalTournament(id: string) {
    const { error } = await supabaseAdmin
        .from('global_tournaments')
        .delete()
        .eq('id', id);

    if (error) throw error;
    return true;
}

// =========================================================================
// Participant Registration
// =========================================================================

export async function registerParticipant(tournamentId: string, userId: string) {
    // 1. Check if tournament exists
    const tournament = await getGlobalTournamentById(tournamentId);
    if (!tournament) {
        throw new Error('Tournament not found');
    }

    // 2. Check if already registered
    const { data: existing, error: checkError } = await supabaseAdmin
        .from('global_tournament_participants')
        .select('*')
        .eq('tournament_id', tournamentId)
        .eq('user_id', userId)
        .maybeSingle();

    if (checkError) throw checkError;
    if (existing) {
        return existing; // Already registered
    }

    // 3. Register user
    const { data, error } = await supabaseAdmin
        .from('global_tournament_participants')
        .insert([{
            tournament_id: tournamentId,
            user_id: userId,
            status: 'REGISTERED',
            total_pushups: 0
        }])
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function getParticipants(tournamentId: string) {
    const { data: participants, error } = await supabaseAdmin
        .from('global_tournament_participants')
        .select('*')
        .eq('tournament_id', tournamentId);

    if (error) throw error;

    const userIds = participants?.map((p: any) => p.user_id) || [];
    let profiles: any[] = [];
    if (userIds.length > 0) {
        const { data: pData, error: pError } = await supabaseAdmin
            .from('profiles')
            .select('user_id, full_name, email')
            .in('user_id', userIds);
        if (pError) throw pError;
        profiles = pData || [];
    }

    const profileMap = new Map(profiles.map(p => [p.user_id, p]));
    return participants.map((p: any) => {
        const prof = profileMap.get(p.user_id);
        return {
            ...p,
            user: {
                id: p.user_id,
                email: prof?.email || 'Anonymous'
            }
        };
    });
}

// =========================================================================
// Active Tournament Sessions
// =========================================================================

export async function startSession(data: {
    tournamentId: string;
    userId: string;
    baselineFaceEmbedding: any;
    baselinePhotoUrl: string;
}) {
    // 1. Verify user is registered for the tournament
    const { data: participant, error: pError } = await supabaseAdmin
        .from('global_tournament_participants')
        .select('*')
        .eq('tournament_id', data.tournamentId)
        .eq('user_id', data.userId)
        .maybeSingle();

    if (pError) throw pError;
    if (!participant) {
        throw new Error('User is not registered for this tournament');
    }

    // 2. Create the session
    const { data: session, error } = await supabaseAdmin
        .from('global_tournament_sessions')
        .insert([{
            tournament_id: data.tournamentId,
            user_id: data.userId,
            status: 'STARTED',
            baseline_face_embedding: data.baselineFaceEmbedding,
            baseline_photo_url: data.baselinePhotoUrl,
            pushup_count: 0,
            average_form_score: 100.00
        }])
        .select()
        .single();

    if (error) throw error;

    // Update participant status to PARTICIPATED
    await supabaseAdmin
        .from('global_tournament_participants')
        .update({ status: 'PARTICIPATED' })
        .eq('id', participant.id);

    return session;
}

export async function getSessionById(id: string) {
    const { data, error } = await supabaseAdmin
        .from('global_tournament_sessions')
        .select('*')
        .eq('id', id)
        .maybeSingle();

    if (error) throw error;
    return data;
}

export async function submitSessionLog(data: {
    sessionId: string;
    pushupCountAtMoment: number;
    faceMatchConfidence: number;
    poseConfidence: number;
    isSuspicious: boolean;
    suspiciousReason?: string;
    screenshotUrl?: string;
}) {
    const session = await getSessionById(data.sessionId);
    if (!session) throw new Error('Session not found');

    if (session.status !== 'ONGOING' && session.status !== 'STARTED') {
        throw new Error(`Cannot submit logs to a session in ${session.status} status`);
    }

    // 1. Create the session log entry
    const { data: log, error: logError } = await supabaseAdmin
        .from('global_tournament_session_logs')
        .insert([{
            session_id: data.sessionId,
            pushup_count_at_moment: data.pushupCountAtMoment,
            face_match_confidence: data.faceMatchConfidence,
            pose_confidence: data.poseConfidence,
            is_suspicious: data.isSuspicious,
            suspicious_reason: data.suspiciousReason
        }])
        .select()
        .single();

    if (logError) throw logError;

    // 2. If a screenshot is provided, record it in media
    if (data.screenshotUrl) {
        const { error: mediaError } = await supabaseAdmin
            .from('global_tournament_media')
            .insert([{
                session_id: data.sessionId,
                log_id: log.id,
                media_url: data.screenshotUrl,
                is_flagged: data.isSuspicious,
                flagged_reason: data.suspiciousReason
            }]);

        if (mediaError) throw mediaError;
    }

    // 3. Compute rolling average form score (using pose confidence)
    const { count: logCount, error: countError } = await supabaseAdmin
        .from('global_tournament_session_logs')
        .select('*', { count: 'exact', head: true })
        .eq('session_id', data.sessionId);

    if (countError) throw countError;

    const countVal = logCount || 1;
    const currentAvg = Number(session.average_form_score) || 100.0;
    const newAverage = ((currentAvg * (countVal - 1)) + data.poseConfidence) / countVal;

    // 4. Update the session state (reps count, average form score, active status)
    const { data: updatedSession, error: updateError } = await supabaseAdmin
        .from('global_tournament_sessions')
        .update({
            pushup_count: Math.max(session.pushup_count, data.pushupCountAtMoment),
            average_form_score: Math.min(100.0, Math.max(0.0, newAverage)),
            status: 'ONGOING'
        })
        .eq('id', data.sessionId)
        .select()
        .single();

    if (updateError) throw updateError;

    // 5. Update participant's total pushup count in participant table
    await supabaseAdmin
        .from('global_tournament_participants')
        .update({ total_pushups: updatedSession.pushup_count })
        .eq('tournament_id', session.tournament_id)
        .eq('user_id', session.user_id);

    return { log, session: updatedSession };
}

export async function pauseSession(sessionId: string) {
    const { data, error } = await supabaseAdmin
        .from('global_tournament_sessions')
        .update({ status: 'PAUSED' })
        .eq('id', sessionId)
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function resumeSession(sessionId: string) {
    const { data, error } = await supabaseAdmin
        .from('global_tournament_sessions')
        .update({ status: 'ONGOING' })
        .eq('id', sessionId)
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function endSession(sessionId: string) {
    const session = await getSessionById(sessionId);
    if (!session) throw new Error('Session not found');

    const { data, error } = await supabaseAdmin
        .from('global_tournament_sessions')
        .update({
            status: 'COMPLETED',
            ended_at: new Date().toISOString()
        })
        .eq('id', sessionId)
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function disqualifySession(sessionId: string, reason: string) {
    // 1. Update session status
    const { data: session, error } = await supabaseAdmin
        .from('global_tournament_sessions')
        .update({
            status: 'DISQUALIFIED',
            disqualification_reason: reason,
            ended_at: new Date().toISOString()
        })
        .eq('id', sessionId)
        .select()
        .single();

    if (error) throw error;

    // 2. Disqualify participant
    await supabaseAdmin
        .from('global_tournament_participants')
        .update({ status: 'DISQUALIFIED', total_pushups: 0 })
        .eq('tournament_id', session.tournament_id)
        .eq('user_id', session.user_id);

    return session;
}

// =========================================================================
// Real-Time Leaderboard & Verification Audit
// =========================================================================

export async function getTournamentLeaderboard(tournamentId: string) {
    // 1. Fetch all participants for this tournament
    const { data: participants, error: partError } = await supabaseAdmin
        .from('global_tournament_participants')
        .select('user_id, status, registered_at')
        .eq('tournament_id', tournamentId);

    if (partError) throw partError;
    if (!participants || participants.length === 0) return [];

    // 2. Fetch all completed sessions for this tournament
    const { data: sessions, error: sessError } = await supabaseAdmin
        .from('global_tournament_sessions')
        .select('id, user_id, started_at, ended_at, pushup_count, average_form_score, status')
        .eq('tournament_id', tournamentId)
        .eq('status', 'COMPLETED');

    if (sessError) throw sessError;

    // 3. Fetch profiles for all participants
    const userIds = participants.map((p: any) => p.user_id);
    let profiles: any[] = [];
    if (userIds.length > 0) {
        const { data: pData, error: pError } = await supabaseAdmin
            .from('profiles')
            .select('user_id, full_name, email')
            .in('user_id', userIds);
        if (pError) throw pError;
        profiles = pData || [];
    }

    const profileMap = new Map(profiles.map(p => [p.user_id, p]));

    // Fallback: If any profiles are missing, fetch directly from Supabase Auth and backfill public.profiles
    const missingUserIds = userIds.filter(id => !profileMap.has(id));
    if (missingUserIds.length > 0) {
        await Promise.all(
            missingUserIds.map(async (userId) => {
                try {
                    const { data: authData } = await supabaseAdmin.auth.admin.getUserById(userId);
                    if (authData?.user) {
                        const email = authData.user.email || '';
                        const fullName = authData.user.user_metadata?.full_name || email.split('@')[0];

                        // Attempt to backfill the public.profiles record
                        await supabaseAdmin
                            .from('profiles')
                            .insert([{
                                user_id: userId,
                                full_name: fullName,
                                email: email
                            }]);

                        profileMap.set(userId, {
                            user_id: userId,
                            full_name: fullName,
                            email: email
                        });
                    }
                } catch (authErr) {
                    console.error("Failed to fetch user fallback from auth system:", userId, authErr);
                }
            })
        );
    }

    const sessionMap = new Map(sessions?.map(s => [s.user_id, s]) || []);

    // 4. Combine into leaderboard entries
    const leaderboard = participants.map((p: any) => {
        const prof = profileMap.get(p.user_id);
        const email = prof?.email || 'Anonymous';
        const username = prof?.full_name || email.split('@')[0];
        const s = sessionMap.get(p.user_id);

        if (s) {
            const start = new Date(s.started_at).getTime();
            const end = s.ended_at ? new Date(s.ended_at).getTime() : start;
            const durationSeconds = (end - start) / 1000;
            return {
                id: s.id,
                user_id: p.user_id,
                started_at: s.started_at,
                ended_at: s.ended_at,
                pushup_count: s.pushup_count,
                average_form_score: s.average_form_score,
                status: p.status, // PARTICIPATED or DISQUALIFIED
                durationSeconds,
                email,
                username,
                registered_at: p.registered_at
            };
        } else {
            return {
                id: null,
                user_id: p.user_id,
                started_at: null,
                ended_at: null,
                pushup_count: 0,
                average_form_score: 0,
                status: p.status, // REGISTERED or DISQUALIFIED
                durationSeconds: 0,
                email,
                username,
                registered_at: p.registered_at
            };
        }
    });

    // 5. Perform sorting including duration & form score tie-breaker
    leaderboard.sort((a, b) => {
        // Disqualified participants always go to the very bottom
        if (a.status === 'DISQUALIFIED' && b.status !== 'DISQUALIFIED') return 1;
        if (b.status === 'DISQUALIFIED' && a.status !== 'DISQUALIFIED') return -1;

        // Sort by reps count desc
        if (b.pushup_count !== a.pushup_count) {
            return b.pushup_count - a.pushup_count;
        }

        // Active completed sessions take priority over registered-only users
        const aHasSession = a.id !== null;
        const bHasSession = b.id !== null;
        if (aHasSession && !bHasSession) return -1;
        if (bHasSession && !aHasSession) return 1;

        if (aHasSession && bHasSession) {
            // Sort by duration asc (faster is better)
            if (a.durationSeconds !== b.durationSeconds) {
                return a.durationSeconds - b.durationSeconds;
            }
            // Sort by average form score desc
            return b.average_form_score - a.average_form_score;
        }

        // Both are registered-only: sort by registration date asc (first to register wins tie-break)
        const dateA = a.registered_at ? new Date(a.registered_at).getTime() : 0;
        const dateB = b.registered_at ? new Date(b.registered_at).getTime() : 0;
        return dateA - dateB;
    });

    return leaderboard;
}

export async function getSessionAuditLogs(sessionId: string) {
    const { data: logs, error: lError } = await supabaseAdmin
        .from('global_tournament_session_logs')
        .select('*')
        .eq('session_id', sessionId)
        .order('timestamp', { ascending: true });

    if (lError) throw lError;

    const { data: media, error: mError } = await supabaseAdmin
        .from('global_tournament_media')
        .select('*')
        .eq('session_id', sessionId)
        .order('captured_at', { ascending: true });

    if (mError) throw mError;

    return { logs, media };
}

export async function getSessionUploadEligibility(sessionId: string) {
    const session = await getSessionById(sessionId);
    if (!session) throw new Error('Session not found');

    const leaderboard = await getTournamentLeaderboard(session.tournament_id);
    const rankIndex = leaderboard.findIndex((entry: any) => entry.id === sessionId);

    const rank = rankIndex !== -1 ? rankIndex + 1 : null;
    const eligible = rank !== null && rank <= 3;

    const { data: mediaList } = await supabaseAdmin
        .from('global_tournament_media')
        .select('media_url')
        .eq('session_id', sessionId);

    const hasVideo = mediaList?.some((media: any) => 
        media.media_url.endsWith('.mp4') || 
        media.media_url.endsWith('.mov') || 
        media.media_url.includes('session_videos')
    ) || false;

    return {
        eligible,
        rank,
        pushupCount: session.pushup_count,
        isAlreadyUploaded: hasVideo
    };
}

export async function getMySessionsEligibility(userId: string) {
    const { data: sessions, error } = await supabaseAdmin
        .from('global_tournament_sessions')
        .select('id, tournament_id, pushup_count, average_form_score')
        .eq('user_id', userId)
        .eq('status', 'COMPLETED');

    if (error) throw error;
    if (!sessions || sessions.length === 0) return [];

    const tournamentIds = sessions.map(s => s.tournament_id);
    const { data: allSessions, error: allErr } = await supabaseAdmin
        .from('global_tournament_sessions')
        .select('id, tournament_id, started_at, ended_at, pushup_count, average_form_score')
        .in('tournament_id', tournamentIds)
        .eq('status', 'COMPLETED');

    if (allErr) throw allErr;

    const sessionIds = sessions.map(s => s.id);
    const { data: mediaList, error: mediaErr } = await supabaseAdmin
        .from('global_tournament_media')
        .select('session_id, media_url')
        .in('session_id', sessionIds);

    if (mediaErr) throw mediaErr;

    const mediaMap = new Map();
    mediaList?.forEach(m => {
        const isVideo = m.media_url.endsWith('.mp4') || m.media_url.endsWith('.mov') || m.media_url.includes('session_videos');
        if (isVideo) {
            mediaMap.set(m.session_id, true);
        }
    });

    const tournamentSessionsMap = new Map<string, any[]>();
    allSessions?.forEach(s => {
        if (!tournamentSessionsMap.has(s.tournament_id)) {
            tournamentSessionsMap.set(s.tournament_id, []);
        }
        const start = new Date(s.started_at).getTime();
        const end = s.ended_at ? new Date(s.ended_at).getTime() : start;
        const durationSeconds = (end - start) / 1000;
        tournamentSessionsMap.get(s.tournament_id)?.push({
            ...s,
            durationSeconds
        });
    });

    const eligibilities = sessions.map(session => {
        const tSessions = tournamentSessionsMap.get(session.tournament_id) || [];
        tSessions.sort((a, b) => {
            if (b.pushup_count !== a.pushup_count) {
                return b.pushup_count - a.pushup_count;
            }
            if (a.durationSeconds !== b.durationSeconds) {
                return a.durationSeconds - b.durationSeconds;
            }
            return b.average_form_score - a.average_form_score;
        });

        const rankIndex = tSessions.findIndex(s => s.id === session.id);
        const rank = rankIndex !== -1 ? rankIndex + 1 : null;
        const eligible = rank !== null && rank <= 3;
        const isAlreadyUploaded = mediaMap.get(session.id) || false;

        return {
            tournamentId: session.tournament_id,
            sessionId: session.id,
            eligible,
            rank,
            isAlreadyUploaded
        };
    });

    return eligibilities;
}


