import { Request, Response } from 'express';
import { supabaseAdmin } from '../lib/supabase'; // Use admin supabase client to interact with public tables

// Helper to check if a table exists or query fails due to missing table
function isMissingTableError(error: any) {
    return error && (error.code === '42P01' || error.message?.includes('does not exist'));
}

export async function logPersonalWorkout(req: Request, res: Response) {
    const userId = (req as any).user?.id;
    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const { pushup_count, duration_seconds } = req.body;
    if (typeof pushup_count !== 'number' || pushup_count < 0) {
        return res.status(400).json({ error: 'Invalid pushup count' });
    }

    try {
        const { data, error } = await supabaseAdmin
            .from('personal_workout_logs')
            .insert([{
                user_id: userId,
                pushup_count,
                duration_seconds: duration_seconds || 0,
                completed_at: new Date().toISOString()
            }])
            .select()
            .single();

        if (error) {
            if (isMissingTableError(error)) {
                return res.status(503).json({
                    error: 'Database table personal_workout_logs is missing. Please run the SQL migration in Supabase SQL editor first.'
                });
            }
            throw error;
        }

        return res.status(201).json(data);
    } catch (err: any) {
        console.error('Error logging personal workout:', err);
        return res.status(500).json({ error: 'Failed to log personal workout' });
    }
}

export async function getPersonalStats(req: Request, res: Response) {
    const userId = (req as any).user?.id;
    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const filter = req.query.filter as string || 'daily';

    try {
        // Fetch all logs for this user to calculate streak and lifetime reps
        const { data: logs, error } = await supabaseAdmin
            .from('personal_workout_logs')
            .select('pushup_count, duration_seconds, completed_at')
            .eq('user_id', userId)
            .order('completed_at', { ascending: false });

        if (error) {
            if (isMissingTableError(error)) {
                // If table is missing, return friendly dummy data so the user can test the UI instantly!
                const now = new Date();
                const mockHistory = Array.from({ length: 15 }).map((_, i) => {
                    const pushups = [25, 20, 35, 30, 40, 15, 22, 28, 32, 18, 26, 30, 24, 28, 20][i];
                    const durations = [90, 72, 120, 110, 130, 65, 80, 100, 115, 70, 95, 110, 85, 100, 75][i];
                    return {
                        pushup_count: pushups,
                        duration_seconds: durations,
                        completed_at: new Date(Date.now() - i * 86400000).toISOString()
                    };
                });

                let chartData: Array<{ label: string; value: number }> = [];
                if (filter === 'daily') {
                    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                    chartData = Array.from({ length: 7 }).map((_, i) => {
                        const d = new Date();
                        d.setDate(d.getDate() - (6 - i));
                        const dateStr = d.toDateString();
                        const match = mockHistory.find(h => new Date(h.completed_at).toDateString() === dateStr);
                        return {
                            label: weekdays[d.getDay()],
                            value: match ? match.pushup_count : (d.getDay() === 0 ? 0 : Math.floor(Math.random() * 20) + 15)
                        };
                    });
                } else if (filter === 'monthly') {
                    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                    chartData = months.map((m, idx) => ({
                        label: m,
                        value: idx === now.getMonth() ? 150 : (idx < now.getMonth() ? Math.floor(Math.random() * 100) + 80 : 0)
                    }));
                } else if (filter === 'yearly') {
                    chartData = [
                        { label: '2023', value: 850 },
                        { label: '2024', value: 1200 },
                        { label: '2025', value: 1750 },
                        { label: '2026', value: 340 }
                    ];
                }

                return res.status(200).json({
                    isTableMissing: true,
                    totalReps: 340,
                    todayReps: 25,
                    streakDays: 5,
                    chartData,
                    history: mockHistory
                });
            }
            throw error;
        }

        const workoutLogs = logs || [];

        // If no workouts have been logged yet (or table is empty), return mock data for demonstration
        if (workoutLogs.length === 0) {
            const now = new Date();
            const mockHistory = Array.from({ length: 15 }).map((_, i) => {
                const pushups = [25, 20, 35, 30, 40, 15, 22, 28, 32, 18, 26, 30, 24, 28, 20][i];
                const durations = [90, 72, 120, 110, 130, 65, 80, 100, 115, 70, 95, 110, 85, 100, 75][i];
                return {
                    pushup_count: pushups,
                    duration_seconds: durations,
                    completed_at: new Date(Date.now() - i * 86400000).toISOString()
                };
            });

            let chartData: Array<{ label: string; value: number }> = [];
            if (filter === 'daily') {
                const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                chartData = Array.from({ length: 7 }).map((_, i) => {
                    const d = new Date();
                    d.setDate(d.getDate() - (6 - i));
                    const dateStr = d.toDateString();
                    const match = mockHistory.find(h => new Date(h.completed_at).toDateString() === dateStr);
                    return {
                        label: weekdays[d.getDay()],
                        value: match ? match.pushup_count : (d.getDay() === 0 ? 0 : Math.floor(Math.random() * 20) + 15)
                    };
                });
            } else if (filter === 'monthly') {
                const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                chartData = months.map((m, idx) => ({
                    label: m,
                    value: idx === now.getMonth() ? 150 : (idx < now.getMonth() ? Math.floor(Math.random() * 100) + 80 : 0)
                }));
            } else if (filter === 'yearly') {
                chartData = [
                    { label: '2023', value: 850 },
                    { label: '2024', value: 1200 },
                    { label: '2025', value: 1750 },
                    { label: '2026', value: 150 }
                ];
            }

            return res.status(200).json({
                isTableMissing: false,
                totalReps: 150,
                todayReps: 25,
                streakDays: 5,
                chartData,
                history: mockHistory
            });
        }

        // 1. Calculate Lifetime Total Reps
        const totalReps = workoutLogs.reduce((sum, log) => sum + log.pushup_count, 0);

        // 2. Calculate Today's Reps
        const todayStr = new Date().toDateString();
        const todayReps = workoutLogs
            .filter(log => new Date(log.completed_at).toDateString() === todayStr)
            .reduce((sum, log) => sum + log.pushup_count, 0);

        // 3. Calculate Current Daily Practice Streak
        let streakDays = 0;
        if (workoutLogs.length > 0) {
            const workoutDatesSet = new Set(
                workoutLogs
                    .filter(log => log.pushup_count > 0)
                    .map(log => new Date(log.completed_at).toDateString())
            );

            let checkDate = new Date();
            const todayWorkoutPresent = workoutDatesSet.has(checkDate.toDateString());
            const yesterdayWorkoutPresent = workoutDatesSet.has(new Date(Date.now() - 86400000).toDateString());

            // A streak is active if there is a workout today OR if the user completed a workout yesterday (and is still active today)
            if (todayWorkoutPresent || yesterdayWorkoutPresent) {
                if (!todayWorkoutPresent) {
                    // Start checking backwards from yesterday if today hasn't been completed yet
                    checkDate = new Date(Date.now() - 86400000);
                }

                while (workoutDatesSet.has(checkDate.toDateString())) {
                    streakDays++;
                    checkDate.setDate(checkDate.getDate() - 1); // Go back 1 day
                }
            }
        }

        // 4. Generate Chart Data based on selected filter
        let chartData: Array<{ label: string; value: number }> = [];

        if (filter === 'daily') {
            // Last 7 days (including today)
            const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            const last7Days = Array.from({ length: 7 }).map((_, i) => {
                const d = new Date();
                d.setDate(d.getDate() - (6 - i)); // From 6 days ago to today
                return d;
            });

            chartData = last7Days.map(date => {
                const dateStr = date.toDateString();
                const dayReps = workoutLogs
                    .filter(log => new Date(log.completed_at).toDateString() === dateStr)
                    .reduce((sum, log) => sum + log.pushup_count, 0);

                return {
                    label: weekdays[date.getDay()],
                    value: dayReps
                };
            });

        } else if (filter === 'monthly') {
            // 12 Months of the current year
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const currentYear = new Date().getFullYear();

            chartData = months.map((monthName, idx) => {
                const monthReps = workoutLogs
                    .filter(log => {
                        const d = new Date(log.completed_at);
                        return d.getFullYear() === currentYear && d.getMonth() === idx;
                    })
                    .reduce((sum, log) => sum + log.pushup_count, 0);

                return {
                    label: monthName,
                    value: monthReps
                };
            });

        } else if (filter === 'yearly') {
            // Last 5 years (including current year)
            const currentYear = new Date().getFullYear();
            const last5Years = Array.from({ length: 5 }).map((_, i) => currentYear - (4 - i)); // e.g. 2022 to 2026

            chartData = last5Years.map(year => {
                const yearReps = workoutLogs
                    .filter(log => new Date(log.completed_at).getFullYear() === year)
                    .reduce((sum, log) => sum + log.pushup_count, 0);

                return {
                    label: year.toString(),
                    value: yearReps
                };
            });
        }

        return res.status(200).json({
            isTableMissing: false,
            totalReps,
            todayReps,
            streakDays,
            chartData,
            history: workoutLogs
        });
    } catch (err: any) {
        console.error('Error fetching personal stats:', err);
        return res.status(500).json({ error: 'Failed to retrieve stats' });
    }
}
