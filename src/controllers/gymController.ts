import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { supabaseAdmin } from '../lib/supabase';

// GET: Public Search Partner Gyms
export const searchGyms = async (req: Request, res: Response) => {
    try {
        const query = (req.query.q as string || '').trim();
        let supabaseQuery = supabaseAdmin.from('gyms').select('id, name, phone');
        if (query) {
            supabaseQuery = supabaseQuery.ilike('name', `%${query}%`);
        }
        const { data, error } = await supabaseQuery.limit(50);
        if (error) throw error;
        res.json(data);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

// POST: Create a Join Request (Athlete applying to join a gym)
export const createJoinRequest = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { gym_id, role } = req.body;
        const userId = req.user.id;

        if (!gym_id || !role) {
            return res.status(400).json({ error: 'Missing gym_id or role' });
        }

        if (role !== 'member' && role !== 'staff') {
            return res.status(400).json({ error: 'Role must be member or staff' });
        }

        // Check if there is already a pending request for this gym
        const { data: existing, error: checkError } = await supabaseAdmin
            .from('gym_join_requests')
            .select('id, status')
            .eq('user_id', userId)
            .eq('gym_id', gym_id)
            .eq('status', 'pending')
            .maybeSingle();

        if (checkError) throw checkError;
        if (existing) {
            return res.status(400).json({ error: 'You already have a pending request for this gym.' });
        }

        const { data, error } = await supabaseAdmin
            .from('gym_join_requests')
            .insert({
                user_id: userId,
                gym_id,
                role,
                status: 'pending'
            })
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

// GET: Retrieve Pending Requests for a Gym (Owner Only)
export const getJoinRequests = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const gymId = parseInt(req.params.gymId);
        const userId = req.user.id;

        // Verify requester owns the gym
        const { data: gym, error: gymError } = await supabaseAdmin
            .from('gyms')
            .select('owner_id')
            .eq('id', gymId)
            .maybeSingle();

        if (gymError || !gym) {
            return res.status(404).json({ error: 'Gym not found' });
        }

        if (gym.owner_id !== userId && !req.isSuperAdmin) {
            return res.status(403).json({ error: 'Forbidden: You do not own this gym' });
        }

        // Fetch requests and join with profiles
        const { data, error } = await supabaseAdmin
            .from('gym_join_requests')
            .select(`
                id,
                user_id,
                gym_id,
                role,
                status,
                created_at,
                profiles:profiles(full_name, email, phone)
            `)
            .eq('gym_id', gymId)
            .eq('status', 'pending')
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json(data);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

// PUT: Approve / Reject a Join Request (Owner Only)
export const updateJoinRequest = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { requestId } = req.params;
        const { status } = req.body; // 'approved' or 'rejected'
        const userId = req.user.id;

        if (status !== 'approved' && status !== 'rejected') {
            return res.status(400).json({ error: 'Invalid status. Must be approved or rejected.' });
        }

        // 1. Fetch join request
        const { data: request, error: fetchError } = await supabaseAdmin
            .from('gym_join_requests')
            .select('*')
            .eq('id', requestId)
            .maybeSingle();

        if (fetchError || !request) {
            return res.status(404).json({ error: 'Join request not found' });
        }

        if (request.status !== 'pending') {
            return res.status(400).json({ error: 'Request has already been processed' });
        }

        // 2. Verify logged in user owns the gym
        const { data: gym, error: gymError } = await supabaseAdmin
            .from('gyms')
            .select('owner_id')
            .eq('id', request.gym_id)
            .maybeSingle();

        if (gymError || !gym) {
            return res.status(404).json({ error: 'Gym not found' });
        }

        if (gym.owner_id !== userId && !req.isSuperAdmin) {
            return res.status(403).json({ error: 'Forbidden: You do not own this gym' });
        }

        // 3. Process
        if (status === 'rejected') {
            const { data, error } = await supabaseAdmin
                .from('gym_join_requests')
                .update({ status: 'rejected', updated_at: new Date().toISOString() })
                .eq('id', requestId)
                .select()
                .single();
            if (error) throw error;
            return res.json({ message: 'Request rejected successfully', request: data });
        }

        // Approved -> Fetch applicant profile
        const { data: profile, error: profileError } = await supabaseAdmin
            .from('profiles')
            .select('full_name, email, phone')
            .eq('user_id', request.user_id)
            .maybeSingle();

        if (profileError || !profile) {
            return res.status(404).json({ error: 'Applicant profile not found' });
        }

        if (request.role === 'member') {
            // Check if member already exists in the gym
            const { data: existingMember } = await supabaseAdmin
                .from('gym_members')
                .select('id')
                .eq('gym_id', request.gym_id)
                .eq('user_id', request.user_id)
                .maybeSingle();

            if (!existingMember) {
                const { error: insertError } = await supabaseAdmin
                    .from('gym_members')
                    .insert({
                        gym_id: request.gym_id,
                        user_id: request.user_id,
                        full_name: profile.full_name,
                        email: profile.email,
                        phone: profile.phone,
                        status: 'active'
                    });
                if (insertError) throw insertError;
            }
        } else if (request.role === 'staff') {
            // Check if staff already exists in the gym staff
            const { data: existingStaff } = await supabaseAdmin
                .from('gym_staff')
                .select('id')
                .eq('gym_id', request.gym_id)
                .eq('user_id', request.user_id)
                .maybeSingle();

            if (!existingStaff) {
                // Use custom role_id passed by the owner during approval, or fallback
                let roleId = req.body.role_id || null;

                if (!roleId) {
                    // Try to find a role with "coach" or "staff" in the name for this gym
                    let { data: roleData } = await supabaseAdmin
                        .from('gym_roles')
                        .select('id')
                        .eq('gym_id', request.gym_id)
                        .or('name.ilike.%trainer%,name.ilike.%coach%')
                        .limit(1)
                        .maybeSingle();

                    if (!roleData) {
                        // Fallback: search default roles
                        const { data: defaultRole } = await supabaseAdmin
                            .from('gym_roles')
                            .select('id')
                            .is('gym_id', null)
                            .or('name.ilike.%trainer%,name.ilike.%coach%')
                            .limit(1)
                            .maybeSingle();
                        roleData = defaultRole;
                    }

                    if (!roleData) {
                        // Ultimate fallback: first available role for the gym
                        const { data: anyRole } = await supabaseAdmin
                            .from('gym_roles')
                            .select('id')
                            .eq('gym_id', request.gym_id)
                            .limit(1)
                            .maybeSingle();
                        roleData = anyRole;
                    }

                    roleId = roleData?.id || null;
                }

                const { error: insertError } = await supabaseAdmin
                    .from('gym_staff')
                    .insert({
                        gym_id: request.gym_id,
                        user_id: request.user_id,
                        full_name: profile.full_name,
                        email: profile.email,
                        phone: profile.phone,
                        role_id: roleId,
                        allow_login: true,
                        status: 'active'
                    });
                if (insertError) throw insertError;
            }
        }

        // Update request status to approved
        const { data: updatedRequest, error: updateError } = await supabaseAdmin
            .from('gym_join_requests')
            .update({ status: 'approved', updated_at: new Date().toISOString() })
            .eq('id', requestId)
            .select()
            .single();

        if (updateError) throw updateError;
        res.json({ message: 'Request approved successfully', request: updatedRequest });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

// POST: Register Gym Owner & Gym (App Owner Signup Flow)
export const registerGymOwner = async (req: Request, res: Response) => {
    try {
        const { email, password, full_name, gym_name, phone } = req.body;

        if (!email || !password || !full_name || !gym_name || !phone) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // 1. Create Auth User
        const { data: authData, error: authError } = await supabaseAdmin.auth.signUp({
            email: email.trim().toLowerCase(),
            password,
            options: {
                data: {
                    full_name
                }
            }
        });

        if (authError || !authData.user) {
            return res.status(400).json({ error: authError?.message || 'Auth registration failed' });
        }

        const userId = authData.user.id;

        // 2. Create Profile
        const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .insert({
                user_id: userId,
                full_name,
                phone,
                email: email.trim().toLowerCase()
            });

        if (profileError) {
            await supabaseAdmin.auth.admin.deleteUser(userId);
            return res.status(400).json({ error: 'Failed to create user profile' });
        }

        // 3. Create Gym
        const { data: gymData, error: gymError } = await supabaseAdmin
            .from('gyms')
            .insert({
                name: gym_name,
                owner_id: userId,
                phone
            })
            .select()
            .single();

        if (gymError) {
            await supabaseAdmin.from('profiles').delete().eq('user_id', userId);
            await supabaseAdmin.auth.admin.deleteUser(userId);
            return res.status(400).json({ error: 'Failed to create gym' });
        }

        // 4. Create Trial Subscription
        const { data: planData } = await supabaseAdmin
            .from('plans')
            .select(`
                id, 
                max_gyms, 
                max_members,
                plan_prices ( id ),
                plan_features ( feature_id, value )
            `)
            .eq('is_trial_plan', true)
            .limit(1)
            .maybeSingle();

        let selectedPlan = planData;
        if (!selectedPlan) {
            const { data: fallbackPlan } = await supabaseAdmin
                .from('plans')
                .select(`
                    id, 
                    max_gyms, 
                    max_members,
                    plan_prices ( id ),
                    plan_features ( feature_id, value )
                `)
                .eq('is_active', true)
                .limit(1)
                .maybeSingle();
            selectedPlan = fallbackPlan;
        }

        if (selectedPlan && selectedPlan.plan_prices?.[0]) {
            const startDate = new Date();
            const endDate = new Date();
            endDate.setDate(startDate.getDate() + 14);

            const { data: subscription, error: subError } = await supabaseAdmin
                .from('subscriptions')
                .insert({
                    user_id: userId,
                    plan_id: selectedPlan.id,
                    plan_price_id: selectedPlan.plan_prices[0].id,
                    max_gyms: selectedPlan.max_gyms,
                    max_members: selectedPlan.max_members,
                    status: 'trial',
                    start_date: startDate.toISOString(),
                    end_date: endDate.toISOString(),
                    amount: 0
                })
                .select()
                .single();

            if (!subError && subscription && selectedPlan.plan_features && selectedPlan.plan_features.length > 0) {
                const featuresToInsert = selectedPlan.plan_features.map((pf: any) => ({
                    subscription_id: subscription.id,
                    feature_id: pf.feature_id,
                    value: pf.value
                }));

                await supabaseAdmin
                    .from('subscription_features')
                    .insert(featuresToInsert);
            }
        }

        res.json({ message: 'Gym and Owner registered successfully' });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};
