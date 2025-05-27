import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import Patient from '../model/Patient.js';
import User from '../model/UserModel.js';
import asyncHandler from '../middlewares/asyncHandler.js';
import Doctor from '../model/Doctor.js';

const authMiddleware = async (req, res, next) => {
  try {
    console.log('Protect middleware: Entering middleware for route:', req.originalUrl);
    const authHeader = req.header('Authorization');
    console.log('Protect middleware: Headers:', req.headers);
    console.log('Protect middleware: Authorization:', authHeader);

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('Protect middleware: No token provided');
      return res.status(401).json({ success: false, error: 'Not authorized, no token' });
    }

    const token = authHeader.replace('Bearer ', '');
    console.log('Protect middleware: Token:', token);

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Protect middleware: Decoded:', decoded);

    if (decoded.role !== 'patient') {
      console.log('Protect middleware: User role is not patient:', decoded.role);
      return res.status(403).json({ success: false, error: 'Access denied: Patient role required' });
    }

    if (!mongoose.Types.ObjectId.isValid(decoded.id)) {
      console.log('Protect middleware: Invalid ObjectId:', decoded.id);
      return res.status(401).json({ success: false, error: 'Invalid user ID in token' });
    }

    console.log('Protect middleware: Database connection state:', mongoose.connection.readyState);
    console.log('Protect middleware: Database name:', mongoose.connection.db ? mongoose.connection.db.databaseName : 'No database connected');

    const user = await User.findById(decoded.id);
    console.log('Protect middleware: Query result for User ID:', decoded.id, user);
    if (!user) {
      console.log('Protect middleware: User not found for ID:', decoded.id);
      return res.status(401).json({ success: false, error: 'User not found' });
    }

    const patient = await Patient.findOne({ user: decoded.id });
    console.log('Protect middleware: Associated Patient:', patient);

    req.user = user;
    req.patient = patient;
    console.log('Protect middleware: User set:', req.user);
    if (patient) {
      console.log('Protect middleware: Patient set:', req.patient);
    } else {
      console.log('Protect middleware: No associated patient found for user ID:', decoded.id);
    }

    next();
  } catch (error) {
    console.error('Protect middleware: Error:', error.message);
    return res.status(401).json({ success: false, error: 'Not authorized: ' + error.message });
  }
};
// Middleware to enforce doctor role and attach doctor data
export const doctorRoleMiddleware = asyncHandler(async (req, res, next) => {
  console.log('Doctor Role Middleware: User:', req.user);

  if (req.user.role !== 'doctor') {
    console.log('Doctor Role Middleware: User role is not doctor:', req.user.role);
    return res.status(403).json({ success: false, error: 'Access denied: Doctor role required' });
  }

  const doctor = await Doctor.findOne({ user: req.user._id });
  console.log('Doctor Role Middleware: Associated Doctor:', doctor);

  if (!doctor) {
    console.log('Doctor Role Middleware: No associated doctor found for user ID:', req.user._id);
    return res.status(404).json({ success: false, error: 'Doctor profile not found' });
  }

  req.doctor = doctor;
  console.log('Doctor Role Middleware: Doctor set:', req.doctor);
  next();
});

// Middleware to enforce patient role and attach patient data
export const patientRoleMiddleware = asyncHandler(async (req, res, next) => {
  console.log('Patient Role Middleware: User:', req.user);

  if (req.user.role !== 'patient') {
    console.log('Patient Role Middleware: User role is not patient:', req.user.role);
    return res.status(403).json({ success: false, error: 'Access denied: Patient role required' });
  }

  const patient = await Patient.findOne({ user: req.user._id });
  console.log('Patient Role Middleware: Associated Patient:', patient);

  if (!patient) {
    console.log('Patient Role Middleware: No associated patient found for user ID:', req.user._id);
    return res.status(404).json({ success: false, error: 'Patient profile not found' });
  }

  req.patient = patient;
  console.log('Patient Role Middleware: Patient set:', req.patient);
  next();
});

export default authMiddleware;