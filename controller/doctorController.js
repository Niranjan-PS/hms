import asyncHandler from '../middlewares/asyncHandler.js';
import Doctor from '../model/Doctor.js';
import User from '../model/userModel.js';


const createDoctor = asyncHandler(async (req, res) => {
  const { name, email, password, phone, department, licenseNumber, availability } = req.body;


  if (!name || !email || !password || !phone || !department || !licenseNumber) {
    res.status(400);
    throw new Error('Name, email, password, phone, department, and license number are required');
  }

  const userExists = await User.findOne({ email });
  if (userExists) {
    res.status(400);
    throw new Error('Email already in use');
  }

  const user = await User.create({
    name,
    email,
    password,
    role: 'doctor',
  });

  const doctor = await Doctor.create({
    user: user._id,
    name,
    email,
    phone,
    department,
    licenseNumber,
    availability,
  });

  res.status(201).json({
    _id: doctor._id,
    name: doctor.name,
    email: doctor.email,
    phone: doctor.phone,
    department: doctor.department,
    licenseNumber: doctor.licenseNumber,
    availability: doctor.availability,
  });
});


const getAllDoctors = asyncHandler(async (req, res) => {
  const doctors = await Doctor.find().populate('user', 'name email role');
  res.json(doctors);
});


const getDoctor = asyncHandler(async (req, res) => {
  const doctor = await Doctor.findById(req.params.id).populate('user', 'name email role');
  if (doctor) {
    res.json(doctor);
  } else {
    res.status(404);
    throw new Error('Doctor not found');
  }
});

const updateDoctor = asyncHandler(async (req, res) => {
  const doctor = await Doctor.findById(req.params.id);
  if (doctor) {
    if (req.user._id.toString() === doctor.user.toString() || req.user.role === 'admin') {
      doctor.name = req.body.name || doctor.name;
      doctor.email = req.body.email || doctor.email;
      doctor.phone = req.body.phone || doctor.phone;
      doctor.department = req.body.department || doctor.department;
      doctor.licenseNumber = req.body.licenseNumber || doctor.licenseNumber;
      doctor.availability = req.body.availability || doctor.availability;

      const updatedDoctor = await doctor.save();
      res.json(updatedDoctor);
    } else {
      res.status(403);
      throw new Error('Not authorized to update this profile');
    }
  } else {
    res.status(404);
    throw new Error('Doctor not found');
  }
});

const deleteDoctor = asyncHandler(async (req, res) => {
  const doctor = await Doctor.findById(req.params.id);
  if (doctor) {
    await User.findByIdAndDelete(doctor.user);
    await Doctor.findByIdAndDelete(req.params.id);
    res.json({ message: 'Doctor removed' });
  } else {
    res.status(404);
    throw new Error('Doctor not found');
  }
});

const getCurrentDoctor = asyncHandler(async (req, res) => {
  

  if (!req.user || !req.user._id) {
    res.status(401);
    throw new Error('User not authenticated');
  }

  if (req.user.role !== 'doctor') {
    res.status(403);
    throw new Error('Access denied. Doctor role required.');
  }

  const doctor = await Doctor.findOne({ user: req.user._id }).populate('user', 'name email');

  if (!doctor) {
    res.status(404);
    throw new Error('Doctor profile not found');
  }

  
  res.json(doctor);
});

export { createDoctor, getAllDoctors, getDoctor, updateDoctor, deleteDoctor, getCurrentDoctor };