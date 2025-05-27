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

// Protect all routes with general authentication
router.use(protect);

router.route('/')
  .post(createAppointment) // Remove patient role middleware to allow all authenticated users
  .get(getAppointments);

// Routes requiring doctor role - must be before /:id route
router.get('/doctor', (req, _, next) => {
  console.log('Route Matched: GET /api/appointments/doctor');
  console.log('Request headers:', req.headers);
  next();
}, doctorRoleMiddleware, getDoctorAppointments);

router.route('/:id')
  .get(getAppointment)
  .put(updateAppointment)
  .delete(cancelAppointment);

router.use((req, _, next) => {
  console.log('Unmatched appointment route:', req.originalUrl);
  next();
});


export default router;