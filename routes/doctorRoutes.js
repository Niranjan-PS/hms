import express from 'express';
import {
  createDoctor,
  getAllDoctors,
  getDoctor,
  updateDoctor,
  deleteDoctor,
  getCurrentDoctor,
} from '../controller/doctorController.js';
import {protect,admin } from '../middlewares/protect.js'

const router = express.Router();

router.route('/')
  .post(protect, admin, createDoctor)
  .get(protect, getAllDoctors);


router.get('/current', protect, getCurrentDoctor);

router.route('/:id')
  .get(protect, getDoctor)
  .put(protect, updateDoctor)
  .delete(protect, admin, deleteDoctor);

export default router;