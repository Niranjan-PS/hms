import express from 'express'
import cors from 'cors'
import authRoutes from './routes/authRoutes.js'
import patientRoutes from './routes/patientRoutes.js'
import doctorRoutes from './routes/doctorRoutes.js'
import appointmentRoutes from './routes/appointmentRoutes.js'
import errorHandler from './middlewares/error.js'


const app = express();


app.use(cors({ origin: 'hms-frontend-iota.vercel.app' }))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))


app.use('/api/auth', authRoutes)
app.use('/api/patients', patientRoutes)
app.use('/api/doctors', doctorRoutes)
app.use('/api/appointments', appointmentRoutes)


app.use(errorHandler)

export default app;