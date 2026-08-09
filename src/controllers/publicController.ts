import { Request, Response } from 'express';
import { supabaseAdmin } from '../lib/supabase';

// GET: Retrieve public trainers list for the website directory
export const getPublicTrainers = async (req: Request, res: Response) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 12;
        const search = (req.query.search as string) || '';

        const from = (page - 1) * limit;
        const to = from + limit - 1;

        // 1. Build profiles query with count and filters
        let query = supabaseAdmin
            .from('profiles')
            .select('user_id, full_name, email, phone, title, bio, specialties, experience_years, social_links, avatar_url', { count: 'exact' })
            .eq('show_on_website', true);

        if (search.trim() !== '') {
            query = query.or(`full_name.ilike.%${search}%,title.ilike.%${search}%`);
        }

        // Consistent ordering and range selection
        query = query.order('full_name', { ascending: true }).range(from, to);

        const { data: profiles, error: profilesError, count } = await query;

        if (profilesError) throw profilesError;

        if (!profiles || profiles.length === 0) {
            return res.json({
                trainers: [],
                pagination: {
                    page,
                    limit,
                    total: 0,
                    has_more: false
                }
            });
        }

        const userIds = profiles
            .map((p: any) => p.user_id)
            .filter((uid: any) => uid !== null);

        const staffMap = new Map();

        // 2. Fetch gym details for these users if they exist
        if (userIds.length > 0) {
            const { data: staffData, error: staffError } = await supabaseAdmin
                .from('gym_staff')
                .select(`
                    user_id,
                    gym_id,
                    gyms (
                        id,
                        name,
                        city
                    )
                `)
                .in('user_id', userIds)
                .eq('is_deleted', false);

            if (!staffError && staffData) {
                staffData.forEach((s: any) => {
                    if (s.gyms) {
                        staffMap.set(s.user_id, {
                            name: s.gyms.name,
                            city: s.gyms.city
                        });
                    }
                });
            }
        }

        // 3. Map gym info back to profiles
        const result = profiles.map((profile: any) => {
            const gymInfo = staffMap.get(profile.user_id) || null;
            return {
                user_id: profile.user_id,
                full_name: profile.full_name,
                email: profile.email,
                phone: profile.phone,
                title: profile.title || 'Personal Trainer',
                bio: profile.bio || '',
                specialties: profile.specialties || [],
                experience_years: profile.experience_years || 0,
                social_links: profile.social_links || {},
                avatar_url: profile.avatar_url || null,
                gym: gymInfo
            };
        });

        res.json({
            trainers: result,
            pagination: {
                page,
                limit,
                total: count || 0,
                has_more: (count || 0) > to + 1
            }
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};
