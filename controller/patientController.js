import asyncHandler from '../middlewares/asyncHandler.js';
import Patient from '../model/Patient.js';

// @desc    Create a new patient profile
// @route   POST /api/patients
// @access  Private (patient or admin)
const createPatient = asyncHandler(async (req, res) => {
    console.log('Create patient request body:', req.body);
  const { dateOfBirth, gender, phone, address, medicalHistory } = req.body;

  // Validate input
  if (!dateOfBirth || !gender) {
    res.status(400);
    throw new Error('Date of birth and gender are required');
  }

  // Check if patient profile already exists for the user
  const existingPatient = await Patient.findOne({ user: req.user._id });
  if (existingPatient) {
    res.status(400);
    throw new Error('Patient profile already exists');
  }

  // Create patient profile
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

// @desc    Get patient profile by ID or current user
// @route   GET /api/patients/:id
// @access  Private (patient for own profile, admin for any, doctor for their patients)
const getPatient = asyncHandler(async (req, res) => {
  console.log('Get Patient - User:', req.user);
  console.log('Get Patient - Patient ID:', req.params.id);

  const patient = await Patient.findById(req.params.id).populate('user', 'name email role');

  if (!patient) {
    res.status(404);
    throw new Error('Patient not found');
  }

  // Check access permissions
  let hasAccess = false;

  if (req.user.role === 'admin') {
    // Admin can view any patient
    hasAccess = true;
  } else if (req.user.role === 'patient') {
    // Patient can view their own profile
    hasAccess = patient.user._id.toString() === req.user._id.toString();
  } else if (req.user.role === 'doctor') {
    // Doctor can view patients they have appointments with
    const Appointment = (await import('../model/Appointment.js')).default;
    const Doctor = (await import('../model/Doctor.js')).default;

    console.log('Get Patient - Checking doctor access for user:', req.user._id);
    const doctor = await Doctor.findOne({ user: req.user._id });

    if (doctor) {
      console.log('Get Patient - Found doctor:', doctor._id);
      const appointment = await Appointment.findOne({
        doctor: doctor._id,
        patient: patient._id
      });
      console.log('Get Patient - Found appointment:', !!appointment);
      hasAccess = !!appointment;
    } else {
      console.log('Get Patient - Doctor profile not found for user:', req.user._id);
    }
  }

  if (!hasAccess) {
    console.log('Get Patient - Access denied for user:', req.user._id);
    res.status(403);
    throw new Error('Not authorized to view this profile');
  }

  console.log('Get Patient - Success:', patient);
  res.status(200).json(patient);
});

// @desc    Get all patients (admin only)
// @route   GET /api/patients
// @access  Private (admin)
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
    console.error('Error fetching patients:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server Error: ' + error.message
    });
  }
});

// @desc    Update patient profile
// @route   PUT /api/patients/:id
// @access  Private (patient for own profile, admin for any)
const updatePatient = asyncHandler(async (req, res) => {
  const patient = await Patient.findById(req.params.id);

  if (!patient) {
    res.status(404);
    throw new Error('Patient not found');
  }

  // Check if user is patient themselves or admin
  if (patient.user._id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    res.status(403);
    throw new Error('Not authorized to update this profile');
  }

  // Update fields
  patient.dateOfBirth = req.body.dateOfBirth || patient.dateOfBirth;
  patient.gender = req.body.gender || patient.gender;
  patient.phone = req.body.phone || patient.phone;
  patient.address = req.body.address || patient.address;
  patient.medicalHistory = req.body.medicalHistory || patient.medicalHistory;

  const updatedPatient = await patient.save();
  res.status(200).json(updatedPatient);
});

// @desc    Delete patient profile
// @route   DELETE /api/patients/:id
// @access  Private (admin only)
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
    console.error('Error deleting patient:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server Error: ' + error.message
    });
  }
});

// @desc    Get current patient's profile
// @route   GET /api/patients/current
// @access  Private (patient only)
const getCurrentPatient = asyncHandler(async (req, res) => {
  console.log('Get Current Patient - User:', req.user);

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

  console.log('Get Current Patient - Found:', patient);
  res.json(patient);
});

export { createPatient, getPatient, getAllPatients, updatePatient, deletePatient, getCurrentPatient };