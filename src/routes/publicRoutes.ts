import express from 'express';
import * as publicController from '../controllers/publicController';

const router = express.Router();

// GET: Retrieve list of public trainers
router.get('/trainers', publicController.getPublicTrainers);

export default router;
