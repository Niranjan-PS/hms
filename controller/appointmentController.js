import mongoose from 'mongoose';
import Appointment from '../model/Appointment.js';
import Doctor from '../model/Doctor.js';
import Patient from '../model/Patient.js';
import asyncHandler from '../middlewares/asyncHandler.js';
import moment from 'moment-timezone';

// Helper function to check doctor availability
// Helper function to convert time string (e.g., "09:00") to minutes for comparison
// Helper function to convert time string (e.g., "09:00") to minutes for comparison



// Helper function to convert time string (e.g., "09:00") to minutes for comparison
const timeToMinutes = (timeStr) => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
};

// Helper function to check doctor availability
const checkDoctorAvailability = async (doctorId, appointmentDate) => {
  const doctor = await Doctor.findById(doctorId);
  if (!doctor || !doctor.availability) {
    console.log('checkDoctorAvailability - Doctor not found or no availability:', doctorId);
    return { isAvailable: false, error: 'Doctor not found or has no availability' };
  }

  // Log the raw appointment date in UTC
  console.log('checkDoctorAvailability - Raw Appointment Date (UTC):', appointmentDate);

  // Convert appointment date to IST using moment-timezone
  const appointmentDateIST = moment(appointmentDate).tz('Asia/Kolkata');

  // Calculate day of week and time in IST
  const dayOfWeek = appointmentDateIST.format('dddd'); // e.g., "Tuesday"
  const appointmentTime = appointmentDateIST.format('HH:mm'); // e.g., "22:30"

  console.log('checkDoctorAvailability - Day of Week (IST):', dayOfWeek);
  console.log('checkDoctorAvailability - Appointment Time (IST):', appointmentTime);

  const availability = doctor.availability.find(slot => slot.day === dayOfWeek);
  if (!availability) {
    console.log('checkDoctorAvailability - No availability for day:', dayOfWeek);
    return { isAvailable: false, error: `Doctor is not available on ${dayOfWeek}.` };
  }

  const appointmentMinutes = timeToMinutes(appointmentTime);
  const startMinutes = timeToMinutes(availability.startTime);
  const endMinutes = timeToMinutes(availability.endTime);

  console.log('checkDoctorAvailability - Availability:', availability);
  console.log('checkDoctorAvailability - Appointment Minutes:', appointmentMinutes, 'Start:', startMinutes, 'End:', endMinutes);

if (startMinutes < endMinutes) {
  // Time range is within the same day
  if (appointmentMinutes < startMinutes || appointmentMinutes >= endMinutes) {
    return { isAvailable: false, error: `Doctor is not available at the specified time. Available hours on ${dayOfWeek}: ${availability.startTime} to ${availability.endTime} (IST).` };
  }
} else {
  // Time range spans midnight (e.g., 22:00 to 02:00)
  const isWithinRange =
    appointmentMinutes >= startMinutes || appointmentMinutes < endMinutes;

  if (!isWithinRange) {
    return { isAvailable: false, error: `Doctor is not available at the specified time. Available hours on ${dayOfWeek}: ${availability.startTime} to ${availability.endTime} (IST).` };
  }
}
  return { isAvailable: true };
};

export const createAppointment = async (req, res) => {
  try {
    console.log('Create Appointment - Request Body:', req.body);
    console.log('Create Appointment - req.user:', req.user);

    // Check if req.user is defined
    if (!req.user || !req.user._id) {
      console.log('Create Appointment - No authenticated user');
      return res.status(401).json({ success: false, error: 'User not authenticated' });
    }

    const { doctor, date, reason } = req.body;
    if (!doctor || !date || !reason) {
      console.log('Create Appointment - Missing required fields');
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    // Validate doctor
    const doctorExists = await Doctor.findById(doctor);
    if (!doctorExists) {
      console.log('Create Appointment - Doctor not found:', doctor);
      return res.status(404).json({ success: false, error: 'Doctor not found' });
    }

    // Find or create patient record
    let patientRecord = req.patient;

    if (!patientRecord) {
      console.log('Create Appointment - Patient not found in request, searching by user ID:', req.user._id);
      patientRecord = await Patient.findOne({ user: req.user._id });

      if (!patientRecord) {
        console.log('Create Appointment - Creating new patient record for user ID:', req.user._id);
        patientRecord = new Patient({
          user: req.user._id,
          name: req.user.name || 'Unknown',
          email: req.user.email || '',
          gender: 'male', // Use a valid enum value (adjust based on schema)
          phone: '+10000000000', // Placeholder for required field
          address: 'Unknown', // Placeholder for required field
          dateOfBirth: new Date('1970-01-01'), // Placeholder for required field
        });
        await patientRecord.save();
        console.log('Create Appointment - Created new patient record:', patientRecord);
      }
    }

    console.log('Create Appointment - Patient record found:', patientRecord);

    // Parse the appointment date (assumed to be in UTC)
    const appointmentDate = new Date(date);
    const currentDate = new Date();
    console.log('Create Appointment - Appointment Date (UTC):', appointmentDate);
    console.log('Create Appointment - Current Date (UTC):', currentDate);

    // Check if the appointment is in the past
    if (appointmentDate < currentDate) {
      console.log('Create Appointment - Appointment date is in the past');
      return res.status(400).json({
        success: false,
        error: 'Cannot schedule an appointment in the past.',
      });
    }

    // Check doctor's availability
    const availabilityCheck = await checkDoctorAvailability(doctor, appointmentDate);
    if (!availabilityCheck.isAvailable) {
      return res.status(400).json({ success: false, error: availabilityCheck.error });
    }

    // Check for overlapping appointments (within a 30-minute window)
    const overlappingAppointments = await Appointment.find({
      doctor,
      date: {
        $gte: new Date(appointmentDate.getTime() - 15 * 60 * 1000), // 15 minutes before
        $lte: new Date(appointmentDate.getTime() + 15 * 60 * 1000), // 15 minutes after
      },
      status: { $ne: 'cancelled' },
    });

    if (overlappingAppointments.length > 0) {
      console.log('Create Appointment - Overlapping appointments found:', overlappingAppointments);
      return res.status(400).json({
        success: false,
        error: 'Doctor has another appointment at this time.',
      });
    }

    // Create the appointment
    console.log('Create Appointment - Creating appointment with patient ID:', patientRecord._id);
    const appointment = new Appointment({
      patient: patientRecord._id,
      doctor,
      date: appointmentDate,
      reason,
      status: 'pending',
    });

    const savedAppointment = await appointment.save();
    console.log('Create Appointment - Saved Appointment:', savedAppointment);

    // Populate patient and doctor details
    const populatedAppointment = await Appointment.findById(savedAppointment._id)
      .populate('patient')
      .populate('doctor');

    console.log('Create Appointment - Populated Appointment:', populatedAppointment);

    res.status(201).json({
      success: true,
      message: 'Appointment created successfully',
      appointment: populatedAppointment,
    });
  } catch (error) {
    console.error('Create Appointment - Error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Server error: ' + error.message,
    });
  }
};
// @desc    Get all appointments (filtered by role)
// @route   GET /api/appointments
// @access  Private

export const getAppointments = async (req, res) => {
  try {
    console.log('Get Appointments - req.user:', req.user);
    console.log('Get Appointments - User role:', req.user?.role);

    if (!req.user || !req.user._id) {
      console.log('Get Appointments - No authenticated user');
      return res.status(401).json({ success: false, error: 'User not authenticated' });
    }

    // Get appointments based on user role
    let appointments = [];

    if (req.user.role === 'admin') {
      // Admin can see all appointments
      console.log('Get Appointments - Admin user, fetching all appointments');
      appointments = await Appointment.find()
        .populate({
          path: 'patient',
          populate: {
            path: 'user',
            select: 'name email role'
          },
          select: 'user dateOfBirth gender phone address medicalHistory',
        })
        .populate({
          path: 'doctor',
          populate: {
            path: 'user',
            select: 'name email'
          },
          select: 'name department user email phone'
        })
        .sort({ date: -1 });
    } else if (req.user.role === 'doctor') {
      // Doctor can see their own appointments
      console.log('Get Appointments - Doctor user, fetching doctor appointments');
      const doctorRecord = await Doctor.findOne({ user: req.user._id });

      if (!doctorRecord) {
        console.log('Get Appointments - Doctor profile not found for user:', req.user._id);
        return res.status(404).json({
          success: false,
          error: 'Doctor profile not found'
        });
      }

      console.log('Get Appointments - Found doctor record:', doctorRecord._id);

      appointments = await Appointment.find({ doctor: doctorRecord._id })
        .populate({
          path: 'patient',
          populate: {
            path: 'user',
            select: 'name email role'
          },
          select: 'user dateOfBirth gender phone address medicalHistory',
        })
        .populate({
          path: 'doctor',
          populate: {
            path: 'user',
            select: 'name email'
          },
          select: 'name department user email phone'
        })
        .sort({ date: -1 });
    } else if (req.user.role === 'patient') {
      // Patient can see their own appointments
      console.log('Get Appointments - Patient user, fetching patient appointments');

      // Find patient record
      const patientRecord = await Patient.findOne({ user: req.user._id });

      if (!patientRecord) {
        console.log('Get Appointments - Patient record not found for user ID:', req.user._id);
        return res.status(404).json({
          success: false,
          error: 'Patient profile not found. Please create a patient profile first.'
        });
      }

      console.log('Get Appointments - Found patient record:', patientRecord._id);

      appointments = await Appointment.find({ patient: patientRecord._id })
        .populate({
          path: 'patient',
          populate: {
            path: 'user',
            select: 'name email role'
          },
          select: 'user dateOfBirth gender phone address medicalHistory',
        })
        .populate({
          path: 'doctor',
          populate: {
            path: 'user',
            select: 'name email'
          },
          select: 'name department user email phone'
        })
        .sort({ date: -1 });
    } else {
      console.log('Get Appointments - Unknown user role:', req.user.role);
      return res.status(403).json({
        success: false,
        error: 'Invalid user role'
      });
    }

    // Filter out invalid appointments (missing patient or doctor data)
    const validAppointments = appointments.filter(appointment => {
      const isValid = appointment.patient && appointment.patient.user && appointment.doctor;
      if (!isValid) {
        console.log('Get Appointments - Invalid appointment found:', appointment._id);
      }
      return isValid;
    });

    console.log('Get Appointments - Total appointments found:', appointments.length);
    console.log('Get Appointments - Valid appointments:', validAppointments.length);

    res.status(200).json({
      success: true,
      count: validAppointments.length,
      appointments: validAppointments
    });
  } catch (error) {
    console.error('Get Appointments - Error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Server error: ' + error.message
    });
  }
};

// @desc    Get single appointment
// @route   GET /api/appointments/:id
// @access  Private
export const getAppointment = asyncHandler(async (req, res) => {
  console.log('Get Appointment - Params:', req.params);
  console.log('Get Appointment - User:', req.user);

  const appointment = await Appointment.findById(req.params.id)
    .populate({
      path: 'patient',
      populate: { path: 'user', select: 'name email' }, // Populate patient.user
    })
    .populate('doctor', 'name department user'); // Include user field for doctor

  console.log('Get Appointment - Fetched:', appointment);

  if (!appointment) {
    console.log('Get Appointment - Not found:', req.params.id);
    res.status(404);
    throw new Error('Appointment not found');
  }

  // Check access
  if (
    req.user.role !== 'admin' &&
    appointment.patient.user?._id.toString() !== req.user._id.toString() &&
    appointment.doctor.user?._id.toString() !== req.user._id.toString()
  ) {
    console.log('Get Appointment - Unauthorized for user:', req.user._id);
    res.status(403);
    throw new Error('Unauthorized');
  }

  res.json({ success: true, appointment });
});

// @desc    Update appointment
// @route   PUT /api/appointments/:id
// @access  Private
export const updateAppointment = asyncHandler(async (req, res) => {
  try {
    console.log('Update Appointment - User:', req.user);
    console.log('Update Appointment - Appointment ID:', req.params.id);
    console.log('Update Appointment - Body:', req.body);

    // Validate appointment ID
    if (!req.params.id || !mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400);
      throw new Error('Invalid appointment ID');
    }

    const appointment = await Appointment.findById(req.params.id)
      .populate({
        path: 'patient',
        populate: {
          path: 'user',
          select: 'name email'
        }
      })
      .populate({
        path: 'doctor',
        populate: {
          path: 'user',
          select: 'name email'
        }
      });

    if (!appointment) {
      console.log('Update Appointment - Appointment not found:', req.params.id);
      res.status(404);
      throw new Error('Appointment not found');
    }

    console.log('Update Appointment - Found appointment:', {
      id: appointment._id,
      patient: appointment.patient?.user?.name,
      doctor: appointment.doctor?.user?.name,
      status: appointment.status
    });

    // Check access - need to properly check doctor access
    let hasAccess = false;

    if (req.user.role === 'admin') {
      hasAccess = true;
      console.log('Update Appointment - Admin access granted');
    } else if (req.user.role === 'patient') {
      // Patient can only update their own appointments
      hasAccess = appointment.patient.user?._id.toString() === req.user._id.toString();
      console.log('Update Appointment - Patient access check:', hasAccess);
    } else if (req.user.role === 'doctor') {
      // Doctor can update appointments assigned to them
      hasAccess = appointment.doctor.user?._id.toString() === req.user._id.toString();
      console.log('Update Appointment - Doctor access check:', hasAccess, {
        appointmentDoctorUserId: appointment.doctor.user?._id.toString(),
        currentUserId: req.user._id.toString()
      });
    }

    if (!hasAccess) {
      console.log('Update Appointment - Unauthorized access attempt');
      res.status(403);
      throw new Error('You are not authorized to update this appointment');
    }

  const { date, reason, status } = req.body;

  // Validate doctor availability if date changes
  if (date && date !== appointment.date.toISOString()) {
    const availabilityCheck = await checkDoctorAvailability(appointment.doctor._id, new Date(date));
    if (!availabilityCheck.isAvailable) {
      res.status(400);
      throw new Error(availabilityCheck.error || 'Doctor is not available at the specified time');
    }

    // Check for conflicting appointments
     const conflictingAppointment = await Appointment.findOne({
      doctor: appointment.doctor,
      date: new Date(date),
      status: { $in: ['pending', 'confirmed'] },
      _id: { $ne: appointment._id },
    });
    if (conflictingAppointment) {
      res.status(400);
      throw new Error('Doctor already has an appointment at this time');
    }
  }

  // Restrict status changes
  if (status) {
    if (req.user.role === 'patient' && status !== 'cancelled') {
      res.status(403);
      throw new Error('Patients can only cancel appointments');
    }
    if (req.user.role === 'doctor' && !['confirmed', 'completed', 'cancelled'].includes(status)) {
      res.status(400);
      throw new Error('Invalid status for doctor');
    }
  }

  appointment.date = date ? new Date(date) : appointment.date;
  appointment.reason = reason || appointment.reason;
  appointment.status = status || appointment.status;

  const updatedAppointment = await appointment.save();

  console.log('Update Appointment - Success:', updatedAppointment);
  res.json({
    success: true,
    message: 'Appointment updated successfully',
    appointment: updatedAppointment
  });

  } catch (error) {
    console.error('Update Appointment - Error:', error);
    res.status(error.status || 500);
    throw new Error(error.message || 'Failed to update appointment');
  }
});

// @desc    Cancel appointment
// @route   DELETE /api/appointments/:id
// @access  Private
export const cancelAppointment = asyncHandler(async (req, res) => {
  console.log('Cancel Appointment - User:', req.user);

  const appointment = await Appointment.findById(req.params.id)
    .populate('patient')
    .populate('doctor');

  if (!appointment) {
    res.status(404);
    throw new Error('Appointment not found');
  }

  // Check access - same logic as update
  let hasAccess = false;

  if (req.user.role === 'admin') {
    hasAccess = true;
  } else if (req.user.role === 'patient') {
    hasAccess = appointment.patient.user?.toString() === req.user._id.toString();
  } else if (req.user.role === 'doctor') {
    hasAccess = appointment.doctor.user?.toString() === req.user._id.toString();
  }

  if (!hasAccess) {
    console.log('Cancel Appointment - Unauthorized access attempt');
    res.status(403);
    throw new Error('Unauthorized');
  }

  appointment.status = 'cancelled';
  const updatedAppointment = await appointment.save();

  console.log('Cancel Appointment - Success:', updatedAppointment);
  res.json({ message: 'Appointment cancelled', appointment: updatedAppointment });
});
// @desc    Get doctor's appointments
// @route   GET /api/appointments/doctor
// @access  Private
export const getDoctorAppointments = asyncHandler(async (req, res) => {
  console.log('Get Doctor Appointments - User:', req.user);
  console.log('Get Doctor Appointments - Headers:', req.headers.authorization);

  const user = req.user;

  if (!user || !user._id) {
    console.log('Get Doctor Appointments - No authenticated user');
    res.status(401);
    throw new Error('User not authenticated');
  }

  if (user.role !== 'doctor') {
    console.log('Get Doctor Appointments - Unauthorized: Not a doctor, role:', user.role);
    res.status(403);
    throw new Error('Unauthorized: Doctor role required');
  }

  const doctor = await Doctor.findOne({ user: user._id }).select('_id name department');
  if (!doctor) {
    console.log('Get Doctor Appointments - Doctor not found for user:', user._id);
    res.status(404);
    throw new Error('Doctor profile not found');
  }

  console.log('Get Doctor Appointments - Found doctor:', doctor._id);

  const appointments = await Appointment.find({ doctor: doctor._id })
    .populate({
      path: 'patient',
      populate: {
        path: 'user',
        select: 'name email role'
      },
      select: 'user dateOfBirth gender phone address medicalHistory',
    })
    .populate({
      path: 'doctor',
      populate: {
        path: 'user',
        select: 'name email'
      },
      select: 'name department user email phone'
    })
    .sort({ date: -1 });

  // Filter out appointments with missing patient or doctor data
  const validAppointments = appointments.filter(appointment => {
    const isValid = appointment.patient && appointment.patient.user && appointment.doctor;
    if (!isValid) {
      console.log('Get Doctor Appointments - Invalid appointment found:', appointment._id);
    }
    return isValid;
  });

  console.log('Get Doctor Appointments - Total appointments:', appointments.length);
  console.log('Get Doctor Appointments - Valid appointments:', validAppointments.length);

  res.json({
    success: true,
    count: validAppointments.length,
    appointments: validAppointments
  });
});

