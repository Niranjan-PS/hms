import asyncHandler from '../middlewares/asyncHandler.js';
import Patient from '../model/Patient.js';


const createPatient = asyncHandler(async (req, res) => {
    
  const { dateOfBirth, gender, phone, address, medicalHistory } = req.body;

 
  if (!dateOfBirth || !gender) {
    res.status(400);
    throw new Error('Date of birth and gender are required');
  }

  
  const existingPatient = await Patient.findOne({ user: req.user._id });
  if (existingPatient) {
    res.status(400);
    throw new Error('Patient profile already exists');
  }

 
  const patient = await Patient.create({
    user: req.user._id,
    dateOfBirth,
    gender,
    phone,
    address,
    medicalHistory,
  });

  res.status(201).json(patient);
});

const getPatient = asyncHandler(async (req, res) => {

  const patient = await Patient.findById(req.params.id).populate('user', 'name email role');

  if (!patient) {
    res.status(404);
    throw new Error('Patient not found');
  }

  
  let hasAccess = false;

  if (req.user.role === 'admin') {
   
    hasAccess = true;
  } else if (req.user.role === 'patient') {
    
    hasAccess = patient.user._id.toString() === req.user._id.toString();
  } else if (req.user.role === 'doctor') {
    
    const Appointment = (await import('../model/Appointment.js')).default;
    const Doctor = (await import('../model/Doctor.js')).default;

    console.log('Get Patient - Checking doctor access for user:', req.user._id);
    const doctor = await Doctor.findOne({ user: req.user._id });

    if (doctor) {
 
      const appointment = await Appointment.findOne({
        doctor: doctor._id,
        patient: patient._id
      });
     
      hasAccess = !!appointment;
    } else {
      console.log('Get Patient - Doctor profile not found for user:', req.user._id);
    }
  }

  if (!hasAccess) {
    
    res.status(403);
    throw new Error('Not authorized to view this profile');
  }

 
  res.status(200).json(patient);
});

const getAllPatients = asyncHandler(async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized, admin access required'
      });
    }

    const patients = await Patient.find().populate('user', 'name email role');

    res.status(200).json({
      success: true,
      count: patients.length,
      patients
    });
  } catch (error) {
    
    res.status(500).json({
      success: false,
      message: 'Server Error: ' + error.message
    });
  }
});

const updatePatient = asyncHandler(async (req, res) => {
  const patient = await Patient.findById(req.params.id);

  if (!patient) {
    res.status(404);
    throw new Error('Patient not found');
  }

  
  if (patient.user._id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    res.status(403);
    throw new Error('Not authorized to update this profile');
  }

 
  patient.dateOfBirth = req.body.dateOfBirth || patient.dateOfBirth;
  patient.gender = req.body.gender || patient.gender;
  patient.phone = req.body.phone || patient.phone;
  patient.address = req.body.address || patient.address;
  patient.medicalHistory = req.body.medicalHistory || patient.medicalHistory;

  const updatedPatient = await patient.save();
  res.status(200).json(updatedPatient);
});

const deletePatient = asyncHandler(async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized, admin access required'
      });
    }

    const patient = await Patient.findById(req.params.id);

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }

    await patient.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Patient profile deleted',
      patientId: req.params.id
    });
  } catch (error) {
    
    res.status(500).json({
      success: false,
      message: 'Server Error: ' + error.message
    });
  }
});

const getCurrentPatient = asyncHandler(async (req, res) => {
  

  if (!req.user || !req.user._id) {
    res.status(401);
    throw new Error('User not authenticated');
  }

  if (req.user.role !== 'patient') {
    res.status(403);
    throw new Error('Access denied. Patient role required.');
  }

  const patient = await Patient.findOne({ user: req.user._id }).populate('user', 'name email role');

  if (!patient) {
    res.status(404);
    throw new Error('Patient profile not found');
  }

 
  res.json(patient);
});

export { createPatient, getPatient, getAllPatients, updatePatient, deletePatient, getCurrentPatient };