import express from 'express';
import { protect } from '../middlewares/protect.js';
import { createPatient, getPatient, getAllPatients, updatePatient, deletePatient, getCurrentPatient } from '../controller/patientController.js';

const router = express.Router();

router.route('/').post(protect, createPatient).get(protect, getAllPatients);


router.get('/current', protect, getCurrentPatient);

router.route('/:id').get(protect, getPatient).put(protect, updatePatient).delete(protect, deletePatient);

export default router;