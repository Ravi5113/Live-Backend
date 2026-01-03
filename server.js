const express = require('express')
const mongoose = require('mongoose')
const session = require('express-session')
const MongoStore = require('connect-mongo')
const bodyParser = require('body-parser')
const cookieParser = require('cookie-parser')
const cors = require('cors')
const bcrypt = require('bcrypt')
const path = require('path')
const User = require('./models/user')
const fareRoutes = require('./routes/fares')
const rideRoutes = require('./routes/rides')
const authRoutes = require('./routes/auth')
const usersRoutes = require('./routes/users')
const healthRoutes = require('./routes/health')

const PORT = process.env.PORT || 3004
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/taxi_app'
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:3000'
const NODE_ENV = process.env.NODE_ENV || 'development'

async function start() {
  await mongoose.connect(MONGO_URI, { autoIndex: true })
  console.log('Connected to MongoDB')

  const app = express()

  // If running behind a reverse proxy (nginx, cloud), enable this via env
  if (process.env.TRUST_PROXY === '1') {
    app.set('trust proxy', 1)
    console.log('Trust proxy enabled')
  }

  app.use(bodyParser.json())
  app.use(bodyParser.urlencoded({ extended: true }))

  // Graceful JSON parse error handler — prevents server crash on malformed JSON
  app.use((err, req, res, next) => {
    if (!err) return next()
    // body-parser sets err.type === 'entity.parse.failed' for invalid JSON
    if (err instanceof SyntaxError || err.type === 'entity.parse.failed' || err.status === 400) {
      return res.status(400).json({ success: false, message: 'Invalid JSON body' })
    }
    next(err)
  })
  app.use(cookieParser())

  // Serve uploaded documents
  app.use('/uploads', express.static(path.join(__dirname, 'uploads')))

  // attach user if session exists (lightweight)
  app.use(async (req, res, next) => {
    if (req.session?.userId) {
      try {
        req.user = await require('./models/user').findById(req.session.userId).lean()
      } catch (e) {
        // ignore
      }
    }
    next()
  })

  // Allow multiple local dev origins (Nuxt can run on various ports)
  const allowedOrigins = new Set([
    FRONTEND_ORIGIN,
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3001',
    'http://localhost:5173',
    'http://127.0.0.1:5173'
  ])
  app.use(cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true) // SSR, same-origin, or curl
      if (allowedOrigins.has(origin)) return callback(null, true)
      return callback(new Error(`CORS blocked for origin ${origin}`))
    },
    credentials: true
  }))

  app.use(
    session({
      name: 'taxi_session',
      secret: process.env.SESSION_SECRET || 'dev_secret',
      resave: false,
      saveUninitialized: false,
      store: MongoStore.create({
        mongoUrl: MONGO_URI,
        ttl: 60 * 60 * 24, // 1 day
        // use unifiedTopology options via mongoOptions for older drivers if needed
      }),
      cookie: {
        httpOnly: true,
        secure: NODE_ENV === 'production',
        sameSite: NODE_ENV === 'production' ? 'lax' : 'lax',
        // set domain only if provided to avoid mismatches in dev
        domain: process.env.COOKIE_DOMAIN || undefined,
        maxAge: 1000 * 60 * 60 * 24
      }
    })
  )

  // Seed admin user if none exist
  const count = await User.countDocuments().catch(() => 0)
  if (!count) {
    const pass = await bcrypt.hash('password', 10)
    await User.create({ name: 'Admin', email: 'admin@example.com', passwordHash: pass, role: 'admin' })
    console.log('Seeded admin user: admin@example.com / password')
  }

  app.use('/api/health', healthRoutes)
  app.use('/api/auth', authRoutes)
  app.use('/api/users', usersRoutes)
  app.use('/api/fares', fareRoutes)
  app.use('/api/rides', rideRoutes)
  app.use('/api/roles', require('./routes/roles'))
  app.use('/api/permissions', require('./routes/permissions'))
  app.use('/api/audit-logs', require('./routes/audit-logs'))
  app.use('/api/tickets', require('./routes/tickets'))
    app.use('/api/transactions', require('./routes/transactions'))
    app.use('/api/wallet', require('./routes/wallet'))
    app.use('/api/support', require('./routes/support'))
    app.use('/api/driver-documents', require('./routes/driver-documents'))
    app.use('/api/driver-payouts', require('./routes/driver-payouts'))
    app.use('/api/payouts', require('./routes/payouts'))
    app.use('/api/uploads', require('./routes/uploads'))
      app.use('/api/driver-registration', require('./routes/driver-registration'))
    // debug routes (temporary)
    app.use('/api/debug', require('./routes/debug'))
    app.use('/api/admin', require('./routes/admin'))

  // Earnings API - real DB aggregation
  const earningsHandler = async (req, res) => {
    const period = req.query.period || 'weekly'
    try {
      const Ride = require('./models/ride')

      // Date range for period
      let startDate, endDate, prevStartDate, prevEndDate
      const today = new Date()
      
      if (period === 'monthly' || period === 'this-month') {
        startDate = new Date(today.getFullYear(), today.getMonth(), 1)
        endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0)
        prevStartDate = new Date(today.getFullYear(), today.getMonth() - 1, 1)
        prevEndDate = new Date(today.getFullYear(), today.getMonth(), 0)
      } else if (period === 'monthly-prev' || period === 'last-month') {
        prevStartDate = new Date(today.getFullYear(), today.getMonth() - 2, 1)
        prevEndDate = new Date(today.getFullYear(), today.getMonth() - 1, 0)
        startDate = prevStartDate
        endDate = prevEndDate
      } else if (period === 'quarterly') {
        const q = Math.floor(today.getMonth() / 3)
        startDate = new Date(today.getFullYear(), q * 3, 1)
        endDate = new Date(today.getFullYear(), q * 3 + 3, 0)
        prevStartDate = new Date(today.getFullYear() - 1, q * 3, 1)
        prevEndDate = new Date(today.getFullYear() - 1, q * 3 + 3, 0)
      } else {
        // weekly (default) - last 4 weeks
        endDate = new Date(today)
        startDate = new Date(today)
        startDate.setDate(today.getDate() - 28)
        prevEndDate = new Date(startDate)
        prevStartDate = new Date(startDate)
        prevStartDate.setDate(startDate.getDate() - 28)
      }

      // Fetch rides in current period (completed only)
      const rides = await Ride.find({
        createdAt: { $gte: startDate, $lte: endDate },
        status: 'completed'
      }).lean()

      // Fetch rides in previous period for comparison
      const prevRides = await Ride.find({
        createdAt: { $gte: prevStartDate, $lte: prevEndDate },
        status: 'completed'
      }).lean()

      // Compute KPIs for current period
      const gbv = rides.reduce((sum, r) => sum + (r.fare || 0), 0)
      const commissionRate = 0.20
      const netCommission = Math.round(gbv * commissionRate)
      const taxes = Math.round(gbv * 0.05)
      const payouts = Math.round(gbv * 0.75)

      // Compute KPIs for previous period
      const prevGbv = prevRides.reduce((sum, r) => sum + (r.fare || 0), 0)
      const prevNetCommission = Math.round(prevGbv * commissionRate)
      const prevPayouts = Math.round(prevGbv * 0.75)
      const prevTaxes = Math.round(prevGbv * 0.05)

      // Calculate percentage changes
      const changeGbv = prevGbv > 0 ? (((gbv - prevGbv) / prevGbv) * 100).toFixed(1) : 0
      const changeCommission = prevNetCommission > 0 ? (((netCommission - prevNetCommission) / prevNetCommission) * 100).toFixed(1) : 0
      const changePayouts = prevPayouts > 0 ? (((payouts - prevPayouts) / prevPayouts) * 100).toFixed(1) : 0
      const changeTaxes = prevTaxes > 0 ? (((taxes - prevTaxes) / prevTaxes) * 100).toFixed(1) : 0

      // Group rides by week for breakdown
      const weekMap = new Map()
      rides.forEach(ride => {
        const rideDate = new Date(ride.createdAt)
        const dayOfWeek = rideDate.getDay()
        const weekStart = new Date(rideDate)
        weekStart.setDate(rideDate.getDate() - dayOfWeek)
        const weekKey = weekStart.toISOString().split('T')[0]

        if (!weekMap.has(weekKey)) {
          weekMap.set(weekKey, { weekStart, gbv: 0, trips: 0 })
        }
        const week = weekMap.get(weekKey)
        week.gbv += ride.fare || 0
        week.trips += 1
      })

      // Convert map to sorted array for breakdown
      const breakdown = Array.from(weekMap.entries())
        .sort((a, b) => b[1].weekStart - a[1].weekStart)
        .map(([key, week]) => {
          const weekEnd = new Date(week.weekStart)
          weekEnd.setDate(week.weekStart.getDate() + 6)
          const startStr = week.weekStart.toLocaleDateString('en-GB', { month: 'short', day: 'numeric', year: 'numeric' })
          const endStr = weekEnd.toLocaleDateString('en-GB', { month: 'short', day: 'numeric', year: 'numeric' })
          const comm = Math.round(week.gbv * commissionRate)
          return {
            date: `Week of ${startStr}`,
            dateRange: `${startStr} - ${endStr}`,
            gbv: week.gbv,
            trips: week.trips,
            netCommission: comm,
            rate: commissionRate * 100,
            payouts: Math.round(week.gbv * 0.75)
          }
        })

      // Generate trend data
      const trend = breakdown.map(b => ({
        label: b.date.replace('Week of ', ''),
        value: b.netCommission
      }))

      res.json({
        kpis: {
          gbv, netCommission, payouts, taxes,
          changeGbv: `${changeGbv >= 0 ? '+' : ''}${changeGbv}%`,
          changeCommission: `${changeCommission >= 0 ? '+' : ''}${changeCommission}%`,
          changePayouts: `${changePayouts >= 0 ? '+' : ''}${changePayouts}%`,
          changeTaxes: `${changeTaxes >= 0 ? '+' : ''}${changeTaxes}%`
        },
        breakdown,
        trend
      })
    } catch (err) {
      console.error('earnings aggregation error:', err)
      res.status(500).json({ success: false, message: 'Failed to compute earnings' })
    }
  }
  app.get('/admin/earnings', earningsHandler)
  app.get('/api/admin/earnings', earningsHandler)

  // Drill-down endpoint: get rides for a specific date range
  app.get('/api/admin/earnings/rides', async (req, res) => {
    try {
      const Ride = require('./models/ride')
      
      const { startDate, endDate } = req.query
      if (!startDate || !endDate) {
        return res.status(400).json({ success: false, message: 'startDate and endDate required' })
      }

      console.log('📋 Drill-down query params:', { startDate, endDate })

      const start = new Date(startDate)
      const end = new Date(endDate)

      console.log('📅 Parsed dates:', {
        startISO: start.toISOString(),
        endISO: end.toISOString(),
        startTime: start.getTime(),
        endTime: end.getTime()
      })

      // Fetch all rides to see what we have
      const allRides = await Ride.find({})
      console.log(`📊 Total rides in DB: ${allRides.length}`)
      
      if (allRides.length > 0) {
        const sampleDates = allRides.slice(0, 3).map(r => ({
          id: r._id.toString().slice(-6),
          createdAt: r.createdAt.toISOString()
        }))
        console.log('📝 Sample ride dates:', sampleDates)
      }

      // Fetch rides in date range with completed status
      const rides = await Ride.find({
        createdAt: { $gte: start, $lte: end },
        status: 'completed'
      })
        .populate('driverId', 'name')
        .populate('userId', 'name')

      console.log(`✅ Rides matching date range [${start.toISOString()} to ${end.toISOString()}]: ${rides.length}`)

      // Map to response shape
      const result = rides.map(r => ({
        _id: r._id,
        fare: r.fare || 0,
        driverName: r.driverId?.name || 'Unknown',
        passengerName: r.userId?.name || 'Unknown',
        pickup: r.pickup,
        drop: r.drop,
        status: r.status,
        createdAt: r.createdAt
      }))

      console.log(`✔️ Returning ${result.length} rides to client`)
      res.json({ rides: result })
    } catch (err) {
      console.error('❌ drill-down fetch error:', err.message)
      res.status(500).json({ success: false, message: 'Failed to fetch ride details', error: err.message })
    }
  })

  // express-level error handler (last middleware)
  app.use((err, req, res, next) => {
    console.error('Express error:', err && err.stack ? err.stack : err)
    if (res.headersSent) return next(err)
    const payload = { success: false }
    // surface useful messages in development
    if (NODE_ENV !== 'production') payload.message = err && err.message ? err.message : 'Internal server error'
    else payload.message = 'Internal server error'
    res.status(err && err.status ? err.status : 500).json(payload)
  })

  let server = app.listen(PORT, '0.0.0.0', () => {
    const addr = server.address()
    console.log('Backend JS listening on', addr)
  })

  // Graceful shutdown helper
  const shutdown = async (reason) => {
    console.warn('Shutting down server:', reason)
    try {
      await mongoose.disconnect()
    } catch (e) {
      console.error('Error during mongoose.disconnect()', e)
    }
    try {
      server.close(() => {
        console.log('HTTP server closed')
        process.exit(0)
      })
    } catch (e) {
      console.error('Error closing server', e)
      process.exit(1)
    }
  }

  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))
}

// Global error handlers to avoid silent crashes
process.on('uncaughtException', (err) => {
  console.error('uncaughtException:', err)
  // try to exit gracefully
  setTimeout(() => process.exit(1), 1000)
})

process.on('unhandledRejection', (reason) => {
  console.error('unhandledRejection:', reason)
  setTimeout(() => process.exit(1), 1000)
})

start().catch(err => {
  console.error('Failed to start backend-js:', err)
  process.exit(1)
})