import mongoose from 'mongoose';
import Appointment from '../model/Appointment.js';
import Doctor from '../model/Doctor.js';
import Patient from '../model/Patient.js';
import asyncHandler from '../middlewares/asyncHandler.js';
import moment from 'moment-timezone';


const timeToMinutes = (timeStr) => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
};


const checkDoctorAvailability = async (doctorId, appointmentDate) => {
  const doctor = await Doctor.findById(doctorId);
  if (!doctor || !doctor.availability) {

    return { isAvailable: false, error: 'Doctor not found or has no availability' };
  }

  
  

  
  const appointmentDateIST = moment(appointmentDate).tz('Asia/Kolkata');

  
  const dayOfWeek = appointmentDateIST.format('dddd');
  const appointmentTime = appointmentDateIST.format('HH:mm'); 


  const availability = doctor.availability.find(slot => slot.day === dayOfWeek);
  if (!availability) {
   
    return { isAvailable: false, error: `Doctor is not available on ${dayOfWeek}.` };
  }

  const appointmentMinutes = timeToMinutes(appointmentTime);
  const startMinutes = timeToMinutes(availability.startTime);
  const endMinutes = timeToMinutes(availability.endTime);

if (startMinutes < endMinutes) {
  
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

    
    if (!req.user || !req.user._id) {
      
      return res.status(401).json({ success: false, error: 'User not authenticated' });
    }

    const { doctor, date, reason } = req.body;
    if (!doctor || !date || !reason) {
      
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    
    const doctorExists = await Doctor.findById(doctor);
    if (!doctorExists) {
      
      return res.status(404).json({ success: false, error: 'Doctor not found' });
    }

    
    let patientRecord = req.patient;

    if (!patientRecord) {
      
      patientRecord = await Patient.findOne({ user: req.user._id });

      if (!patientRecord) {
        
        patientRecord = new Patient({
          user: req.user._id,
          name: req.user.name || 'Unknown',
          email: req.user.email || '',
          gender: 'male', 
          phone: '+10000000000', 
          address: 'Unknown', 
          dateOfBirth: new Date('1970-01-01'), 
        });
        await patientRecord.save();
       
      }
    }

    

    
    const appointmentDate = new Date(date);
    const currentDate = new Date();

    // Check if the appointment is in the past
    if (appointmentDate < currentDate) {
     
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

    
    const overlappingAppointments = await Appointment.find({
      doctor,
      date: {
        $gte: new Date(appointmentDate.getTime() - 15 * 60 * 1000), // 15 minutes before
        $lte: new Date(appointmentDate.getTime() + 15 * 60 * 1000), // 15 minutes after
      },
      status: { $ne: 'cancelled' },
    });

    if (overlappingAppointments.length > 0) {
   
      return res.status(400).json({
        success: false,
        error: 'Doctor has another appointment at this time.',
      });
    }

    // Create the appointment
   
    const appointment = new Appointment({
      patient: patientRecord._id,
      doctor,
      date: appointmentDate,
      reason,
      status: 'pending',
    });

    const savedAppointment = await appointment.save();
    

    // Populate patient and doctor details
    const populatedAppointment = await Appointment.findById(savedAppointment._id)
      .populate('patient')
      .populate('doctor');

    

    res.status(201).json({
      success: true,
      message: 'Appointment created successfully',
      appointment: populatedAppointment,
    });
  } catch (error) {
    
    res.status(500).json({
      success: false,
      error: 'Server error: ' + error.message,
    });
  }
};

export const getAppointments = async (req, res) => {
  try {

    if (!req.user || !req.user._id) {
      
      return res.status(401).json({ success: false, error: 'User not authenticated' });
    }

    
    let appointments = [];

    if (req.user.role === 'admin') {
      
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
      const doctorRecord = await Doctor.findOne({ user: req.user._id });

      if (!doctorRecord) {
      
        return res.status(404).json({
          success: false,
          error: 'Doctor profile not found'
        });
      }

      

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

      // Find patient record
      const patientRecord = await Patient.findOne({ user: req.user._id });

      if (!patientRecord) {
        return res.status(404).json({
          success: false,
          error: 'Patient profile not found. Please create a patient profile first.'
        });
      }

      

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
    
      return res.status(403).json({
        success: false,
        error: 'Invalid user role'
      });
    }

    // Filter out invalid appointments (missing patient or doctor data)
    const validAppointments = appointments.filter(appointment => {
      const isValid = appointment.patient && appointment.patient.user && appointment.doctor;
      if (!isValid) {
        
      }
      return isValid;
    });


    res.status(200).json({
      success: true,
      count: validAppointments.length,
      appointments: validAppointments
    });
  } catch (error) {
    
    res.status(500).json({
      success: false,
      error: 'Server error: ' + error.message
    });
  }
};

export const getAppointment = asyncHandler(async (req, res) => {


  const appointment = await Appointment.findById(req.params.id)
    .populate({
      path: 'patient',
      populate: { path: 'user', select: 'name email' }, 
    })
    .populate('doctor', 'name department user'); 

 

  if (!appointment) {
    
    res.status(404);
    throw new Error('Appointment not found');
  }

  // Check access
  if (
    req.user.role !== 'admin' &&
    appointment.patient.user?._id.toString() !== req.user._id.toString() &&
    appointment.doctor.user?._id.toString() !== req.user._id.toString()
  ) {
    
    res.status(403);
    throw new Error('Unauthorized');
  }

  res.json({ success: true, appointment });
});


export const updateAppointment = asyncHandler(async (req, res) => {
  try {

    
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
      res.status(404);
      throw new Error('Appointment not found');
    }

    

   
    let hasAccess = false;

    if (req.user.role === 'admin') {
      hasAccess = true;
     
    } else if (req.user.role === 'patient') {
      
      hasAccess = appointment.patient.user?._id.toString() === req.user._id.toString();
      
    } else if (req.user.role === 'doctor') {
      
      hasAccess = appointment.doctor.user?._id.toString() === req.user._id.toString();
     
    }

    if (!hasAccess) {
      
      res.status(403);
      throw new Error('You are not authorized to update this appointment');
    }

  const { date, reason, status } = req.body;

  if (date && date !== appointment.date.toISOString()) {
    const availabilityCheck = await checkDoctorAvailability(appointment.doctor._id, new Date(date));
    if (!availabilityCheck.isAvailable) {
      res.status(400);
      throw new Error(availabilityCheck.error || 'Doctor is not available at the specified time');
    }

    
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

 
  res.json({
    success: true,
    message: 'Appointment updated successfully',
    appointment: updatedAppointment
  });

  } catch (error) {
    
    res.status(error.status || 500);
    throw new Error(error.message || 'Failed to update appointment');
  }
});

export const cancelAppointment = asyncHandler(async (req, res) => {
 

  const appointment = await Appointment.findById(req.params.id)
    .populate('patient')
    .populate('doctor');

  if (!appointment) {
    res.status(404);
    throw new Error('Appointment not found');
  }

  
  let hasAccess = false;

  if (req.user.role === 'admin') {
    hasAccess = true;
  } else if (req.user.role === 'patient') {
    hasAccess = appointment.patient.user?.toString() === req.user._id.toString();
  } else if (req.user.role === 'doctor') {
    hasAccess = appointment.doctor.user?.toString() === req.user._id.toString();
  }

  if (!hasAccess) {
   
    res.status(403);
    throw new Error('Unauthorized');
  }

  appointment.status = 'cancelled';
  const updatedAppointment = await appointment.save();

  
  res.json({ message: 'Appointment cancelled', appointment: updatedAppointment });
});

export const getDoctorAppointments = asyncHandler(async (req, res) => {

  const user = req.user;

  if (!user || !user._id) {
    
    res.status(401);
    throw new Error('User not authenticated');
  }

  if (user.role !== 'doctor') {
   
    res.status(403);
    throw new Error('Unauthorized: Doctor role required');
  }

  const doctor = await Doctor.findOne({ user: user._id }).select('_id name department');
  if (!doctor) {
   
    res.status(404);
    throw new Error('Doctor profile not found');
  }



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

  
  const validAppointments = appointments.filter(appointment => {
    const isValid = appointment.patient && appointment.patient.user && appointment.doctor;
    if (!isValid) {
      
    }
    return isValid;
  });

 
  res.json({
    success: true,
    count: validAppointments.length,
    appointments: validAppointments
  });
});

