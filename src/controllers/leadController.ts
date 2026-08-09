import { Request, Response } from 'express';
import { supabaseAdmin } from '../lib/supabase';
import { AuthenticatedRequest } from '../middleware/authMiddleware';

// POST: Create a new lead inquiry for a trainer (Public)
export const createTrainerLead = async (req: Request, res: Response) => {
    try {
        const { clientName, clientEmail, clientPhone, message } = req.body;
        const trainerId = req.params.id;

        if (!clientName || !clientEmail || !message) {
            return res.status(400).json({ error: "Missing required fields (clientName, clientEmail, message)" });
        }

        const { data, error } = await supabaseAdmin
            .from('trainer_leads')
            .insert({
                trainer_id: trainerId,
                client_name: clientName,
                client_email: clientEmail,
                client_phone: clientPhone || null,
                message: message,
                status: 'new'
            })
            .select()
            .single();

        if (error) throw error;

        res.status(201).json({ success: true, lead: data });
    } catch (error: any) {
        console.error("Error creating trainer lead:", error);
        res.status(500).json({ error: error.message });
    }
};

// GET: Retrieve all leads for the logged-in trainer (Authenticated)
export const getTrainerLeads = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const { data: leads, error } = await supabaseAdmin
            .from('trainer_leads')
            .select('*')
            .eq('trainer_id', userId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        res.json(leads);
    } catch (error: any) {
        console.error("Error fetching trainer leads:", error);
        res.status(500).json({ error: error.message });
    }
};

// PATCH: Update the status of a lead inquiry (Authenticated)
export const updateTrainerLeadStatus = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const leadId = req.params.id;
        const { status } = req.body;

        if (!userId) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        if (!status) {
            return res.status(400).json({ error: "Missing required field status" });
        }

        const { data, error } = await supabaseAdmin
            .from('trainer_leads')
            .update({ status })
            .eq('id', leadId)
            .eq('trainer_id', userId)
            .select()
            .single();

        if (error) throw error;

        res.json(data);
    } catch (error: any) {
        console.error("Error updating trainer lead status:", error);
        res.status(500).json({ error: error.message });
    }
};

// DELETE: Remove a lead inquiry (Authenticated)
export const deleteTrainerLead = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const leadId = req.params.id;

        if (!userId) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const { error } = await supabaseAdmin
            .from('trainer_leads')
            .delete()
            .eq('id', leadId)
            .eq('trainer_id', userId);

        if (error) throw error;

        res.json({ success: true, message: "Lead deleted successfully" });
    } catch (error: any) {
        console.error("Error deleting trainer lead:", error);
        res.status(500).json({ error: error.message });
    }
};
