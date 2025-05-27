import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import Patient from '../model/Patient.js';
import User from '../model/UserModel.js';
import asyncHandler from '../middlewares/asyncHandler.js';
import Doctor from '../model/Doctor.js';

const authMiddleware = async (req, res, next) => {
  try {
    
    const authHeader = req.header('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      
      return res.status(401).json({ success: false, error: 'Not authorized, no token' });
    }

    const token = authHeader.replace('Bearer ', '');
   

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    

    if (decoded.role !== 'patient') {
      
      return res.status(403).json({ success: false, error: 'Access denied: Patient role required' });
    }

    if (!mongoose.Types.ObjectId.isValid(decoded.id)) {
    
      return res.status(401).json({ success: false, error: 'Invalid user ID in token' });
    }

   
    const user = await User.findById(decoded.id);
   
    if (!user) {
      
      return res.status(401).json({ success: false, error: 'User not found' });
    }

    const patient = await Patient.findOne({ user: decoded.id });
   

    req.user = user;
    req.patient = patient;
    
   

    next();
  } catch (error) {
    
    return res.status(401).json({ success: false, error: 'Not authorized: ' + error.message });
  }
};

export const doctorRoleMiddleware = asyncHandler(async (req, res, next) => {
  

  if (req.user.role !== 'doctor') {
   
    return res.status(403).json({ success: false, error: 'Access denied: Doctor role required' });
  }

  const doctor = await Doctor.findOne({ user: req.user._id });
  

  if (!doctor) {
    
    return res.status(404).json({ success: false, error: 'Doctor profile not found' });
  }

  req.doctor = doctor;
  
  next();
});


export const patientRoleMiddleware = asyncHandler(async (req, res, next) => {
  

  if (req.user.role !== 'patient') {
   
    return res.status(403).json({ success: false, error: 'Access denied: Patient role required' });
  }

  const patient = await Patient.findOne({ user: req.user._id });
  

  if (!patient) {
   
    return res.status(404).json({ success: false, error: 'Patient profile not found' });
  }

  req.patient = patient;
  
  next();
});

export default authMiddleware;