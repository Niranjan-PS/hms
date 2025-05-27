import express from 'express';
const router = express.Router();
import {
  createAppointment,
  getAppointments,
  getAppointment,
  updateAppointment,
  cancelAppointment,
  getDoctorAppointments,
} from '../controller/appointmentController.js'
import { protect } from '../middlewares/protect.js';
import { doctorRoleMiddleware } from '../middlewares/auth.js';


router.use(protect);

router.route('/')
  .post(createAppointment) 
  .get(getAppointments);


router.get('/doctor', (req, _, next) => {
  next();
}, doctorRoleMiddleware, getDoctorAppointments);

router.route('/:id')
  .get(getAppointment)
  .put(updateAppointment)
  .delete(cancelAppointment);

router.use((req, _, next) => {
  next();
});


export default router;