const express = require('express')
const router = express.Router()
const mongoose = require('mongoose')
const auth = require('../middleware/auth')
const admin = require('../middleware/admin')
const Ride = require('../models/ride')
const Transaction = require('../models/transaction')
const User = require('../models/user')
const DriverDocument = require('../models/driverDocument')
const Fare = require('../models/fare')

// daily report: rides count and revenue for a date (YYYY-MM-DD)
router.get('/report/daily', auth, admin, async (req, res) => {
  const date = req.query.date ? new Date(req.query.date) : new Date()
  const start = new Date(date); start.setHours(0,0,0,0)
  const end = new Date(date); end.setHours(23,59,59,999)

  const ridesCount = await Ride.countDocuments({ createdAt: { $gte: start, $lte: end } })
  const revenueAgg = await Transaction.aggregate([
    { $match: { createdAt: { $gte: start, $lte: end }, type: 'payment' } },
    { $group: { _id: null, total: { $sum: '$amount' } } }
  ])
  const revenue = (revenueAgg[0] && revenueAgg[0].total) || 0

  res.json({ success: true, data: { date: start.toISOString().slice(0,10), ridesCount, revenue } })
})

// summary: totals
router.get('/report/summary', auth, admin, async (req, res) => {
  const [totalRides, revenueAgg, driversCount, usersCount, activeDrivers] = await Promise.all([
    Ride.countDocuments(),
    Transaction.aggregate([{ $match: { type: 'payment' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
    User.countDocuments({ role: 'driver' }),
    User.countDocuments({ role: { $in: ['user','passenger'] } }),
    User.countDocuments({ role: 'driver', is_online: true })
  ])
  const totalRevenue = (revenueAgg[0] && revenueAgg[0].total) || 0
  res.json({ success: true, data: { totalRides, totalRevenue, drivers: driversCount, users: usersCount, drivers_active: activeDrivers } })
})

// Revenue timeseries: hourly revenue and rides for a given date (default today)
router.get('/report/timeseries', auth, admin, async (req, res) => {
  const date = req.query.date ? new Date(req.query.date) : new Date()
  const start = new Date(date); start.setHours(0,0,0,0)
  const end = new Date(date); end.setHours(23,59,59,999)

  // Build 24 buckets for hours 0-23
  const hours = Array.from({ length: 24 }, (_, h) => h)
  // Aggregate transactions by hour for type 'payment'
  const revenueAgg = await Transaction.aggregate([
    { $match: { createdAt: { $gte: start, $lte: end }, type: 'payment' } },
    { $project: { amount: 1, hour: { $hour: '$createdAt' } } },
    { $group: { _id: '$hour', total: { $sum: '$amount' }, count: { $sum: 1 } } }
  ])
  const rideAgg = await Ride.aggregate([
    { $match: { createdAt: { $gte: start, $lte: end } } },
    { $project: { hour: { $hour: '$createdAt' } } },
    { $group: { _id: '$hour', count: { $sum: 1 } } }
  ])

  // Map aggregates to arrays
  const revenueByHour = Object.fromEntries(revenueAgg.map(r => [r._id, r.total]))
  const ridesByHour = Object.fromEntries(rideAgg.map(r => [r._id, r.count]))
  const series = hours.map(h => ({
    hour: h,
    revenue: Math.round((revenueByHour[h] || 0) * 100) / 100,
    rides: ridesByHour[h] || 0
  }))

  res.json({ success: true, data: { date: start.toISOString().slice(0,10), series } })
})

// Driver detail: aggregate user, vehicle, ride stats, KYC status, documents
// MUST be before /drivers list route to match specific :id before generic list
router.get('/drivers/:id', auth, admin, async (req, res) => {
  try {
    const id = req.params.id
    if (!mongoose.isValidObjectId(id)) {
      // Handle special create route separately to avoid 500s
      if (id === 'create') {
        return res.json({ success: true, data: { user: {}, vehicle: {}, stats: { count: 0, ratingAvg: 0, cancelRate: 0 }, kycStatus: 'Pending', documents: [] } })
      }
      return res.status(400).json({ success: false, message: 'Invalid driver ID' })
    }
    const user = await User.findById(id).lean()
    if (!user) return res.status(404).json({ success: false, message: 'Driver not found' })
    const vehicle = user.vehicle || null
    const ridesAgg = await Ride.aggregate([
      { $match: { driverId: user._id } },
      { $group: { _id: null, count: { $sum: 1 }, ratingAvg: { $avg: '$rating' }, cancelRate: { $avg: { $cond: [{ $eq: ['$status','cancelled'] }, 1, 0] } } } }
    ])
    const stats = ridesAgg[0] || { count: 0, ratingAvg: 0, cancelRate: 0 }
    const documents = await DriverDocument.find({ driverId: user._id }).lean()
    const kycStatus = documents && documents.length
      ? (documents.every(d => d.status === 'approved') ? 'Approved' : (documents.some(d => d.status === 'pending') ? 'Pending' : 'Rejected'))
      : 'Pending'

    res.json({ success: true, data: { user, vehicle, stats, kycStatus, documents } })
  } catch (e) {
    res.status(500).json({ success: false, message: 'Error fetching driver details' })
  }
})

// Admin: drivers list with simple pagination
router.get('/drivers', auth, admin, async (req, res) => {
  const page = Math.max(parseInt(req.query.page || '1', 10), 1)
  const perPage = Math.min(parseInt(req.query.per_page || '10', 10), 50)
  const kyc = req.query.kyc
  const online = req.query.online
  const type = req.query.type

  const User = require('../models/user')
  const query = { role: 'driver' }
  if (typeof online !== 'undefined' && online !== '') {
    query.is_online = online === '1'
  }
  // Fetch drivers
  const total = await User.countDocuments(query)
  const items = await User.find(query).sort({ createdAt: -1 }).skip((page-1)*perPage).limit(perPage).lean()
  // Attach minimal derived fields for UI
  const data = items.map(d => ({
    id: d._id,
    user: { name: d.name, phone: d.phone, avatar: d.avatar },
    vehicle: d.vehicle || {},
    is_online: !!d.is_online,
    is_suspended: !!d.is_suspended,
    kyc_status: 'pending'
  }))
  res.json({ success: true, data, total, metrics: { activeDrivers: await User.countDocuments({ role: 'driver', is_online: true }), pending: 12 } })
})

// Admin: create a new driver
router.post('/drivers', auth, admin, async (req, res) => {
  try {
    const { name, email, phone, password, vehicle } = req.body
    if (!name || !email || !phone) {
      return res.status(400).json({ success: false, message: 'Name, email, and phone are required' })
    }
    const existing = await User.findOne({ email }).lean()
    if (existing) {
      return res.status(409).json({ success: false, message: 'Email already exists' })
    }

    let passwordHash = undefined
    if (password && password.length >= 6) {
      const bcrypt = require('bcrypt')
      passwordHash = await bcrypt.hash(password, 10)
    }

    const doc = { name, email, phone, role: 'driver', is_online: false, is_suspended: true }
    if (passwordHash) doc.passwordHash = passwordHash
    if (vehicle && typeof vehicle === 'object') doc.vehicle = vehicle

    const created = await User.create(doc)
    return res.json({ success: true, message: 'Driver created', data: { id: created._id } })
  } catch (e) {
    console.error('Driver create failed', e)
    return res.status(500).json({ success: false, message: 'Error creating driver' })
  }
})

// Trips list with filters and pagination
router.get('/trips', auth, admin, async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page || '1', 10), 1)
    const perPage = Math.min(parseInt(req.query.per_page || '10', 10), 50)
    const { status, user_id: userIdOrDriverId, driver_id: driverIdParam, start_date: startDate, end_date: endDate, fare_min: fareMin, fare_max: fareMax } = req.query

    const query = {}
    if (status) query.status = status

    if (userIdOrDriverId) {
      query.$or = [
        { userId: userIdOrDriverId },
        { driverId: userIdOrDriverId }
      ]
    }
    if (driverIdParam) query.driverId = driverIdParam

    const createdRange = {}
    if (startDate) createdRange.$gte = new Date(startDate)
    if (endDate) {
      const end = new Date(endDate)
      end.setHours(23, 59, 59, 999)
      createdRange.$lte = end
    }
    if (Object.keys(createdRange).length) query.createdAt = createdRange

    const fareRange = {}
    const minFare = fareMin ? parseFloat(fareMin) : null
    const maxFare = fareMax ? parseFloat(fareMax) : null
    if (!Number.isNaN(minFare) && minFare !== null) fareRange.$gte = minFare
    if (!Number.isNaN(maxFare) && maxFare !== null) fareRange.$lte = maxFare
    if (Object.keys(fareRange).length) query.fare = fareRange

    const total = await Ride.countDocuments(query)
    const rides = await Ride.find(query).sort({ createdAt: -1 }).skip((page-1)*perPage).limit(perPage).lean()

    const userIds = new Set()
    rides.forEach(r => {
      if (r.userId) userIds.add(r.userId.toString())
      if (r.driverId) userIds.add(r.driverId.toString())
    })

    const users = await User.find({ _id: { $in: Array.from(userIds) } }).lean()
    const userMap = new Map(users.map(u => [u._id.toString(), u]))

    const statusMeta = {
      completed: { label: 'Completed', tone: 'success' },
      cancelled: { label: 'Cancelled by Passenger', tone: 'warning' },
      in_progress: { label: 'In Progress', tone: 'info' },
      requested: { label: 'Requested', tone: 'muted' }
    }

    const data = rides.map(r => {
      const passenger = userMap.get(r.userId?.toString())
      const driver = userMap.get(r.driverId?.toString())
      const meta = statusMeta[r.status] || { label: r.status || 'N/A', tone: 'muted' }
      const pickup = r.pickup?.address || r.pickup?.location || 'N/A'
      const drop = r.drop?.address || r.drop?.location || 'N/A'

      return {
        id: r._id,
        tripCode: `T-${String(r._id).slice(-6).toUpperCase()}`,
        passenger: {
          name: passenger?.name || 'Unknown Passenger',
          vehicle: passenger?.vehicle?.type || ''
        },
        driver: {
          name: driver?.name || 'Unknown Driver',
          vehicle: driver?.vehicle?.type || ''
        },
        createdAt: r.createdAt,
        pickup,
        drop,
        fare: Math.round((r.fare || 0) * 100) / 100,
        status: r.status,
        statusLabel: meta.label,
        statusTone: meta.tone
      }
    })

    res.json({ success: true, data, total, page, perPage })
  } catch (e) {
    res.status(500).json({ success: false, message: 'Error fetching trips' })
  }
})

// Trip detail
router.get('/trips/:id', auth, admin, async (req, res) => {
  try {
    const id = req.params.id
    const ride = await Ride.findById(id).lean()
    if (!ride) return res.status(404).json({ success: false, message: 'Trip not found' })

    const [fareDoc, paymentTxn, payoutTxn, passenger, driver] = await Promise.all([
      Fare.findOne({ rideId: ride._id }).lean(),
      Transaction.findOne({ rideId: ride._id, type: 'payment' }).sort({ createdAt: -1 }).lean(),
      Transaction.findOne({ rideId: ride._id, type: 'payout' }).sort({ createdAt: -1 }).lean(),
      User.findById(ride.userId).lean(),
      User.findById(ride.driverId).lean()
    ])

    const statusMeta = {
      completed: { label: 'Completed', tone: 'success', icon: 'check' },
      cancelled: { label: 'Cancelled by Passenger', tone: 'warning', icon: 'xmark' },
      in_progress: { label: 'In Progress', tone: 'info', icon: 'clock' },
      requested: { label: 'Requested', tone: 'muted', icon: 'clock' }
    }
    const meta = statusMeta[ride.status] || { label: ride.status || 'N/A', tone: 'muted', icon: 'question' }

    const baseFare = fareDoc?.baseCharge ?? fareDoc?.base ?? 0
    const distanceFare = fareDoc?.distanceCharge ?? 0
    const timeFare = fareDoc?.durationCharge ?? 0
    const surge = fareDoc?.surgePrice ?? 1
    const discount = fareDoc?.discount ?? 0
    const subtotal = fareDoc?.totalCharge ?? ride.fare ?? 0
    const totalFare = fareDoc?.finalAmount ?? ride.fare ?? 0
    const platformCommission = Math.round(totalFare * 0.2 * 100) / 100
    const netDriverPayout = Math.round((totalFare - platformCommission) * 100) / 100
    const fees = Math.max(0, subtotal - (baseFare + distanceFare + timeFare))

    // Simple synthetic timeline based on createdAt + ride duration
    const startAt = ride.createdAt ? new Date(ride.createdAt) : new Date()
    const addMinutes = (d, m) => new Date(d.getTime() + m * 60000)
    const timeline = [
      { key: 'requested', label: 'Trip Requested', time: startAt },
      { key: 'accepted', label: 'Driver Accepted', time: addMinutes(startAt, 2) },
      { key: 'arrived', label: 'Driver Arrived at Pickup', time: addMinutes(startAt, 5) },
      { key: 'picked', label: 'Passenger Picked Up (Trip Start)', time: addMinutes(startAt, 8) },
      { key: 'completed', label: 'Trip Completed (Drop-off)', time: addMinutes(startAt, Math.max(10, Math.min(60, ride.duration || 25))) }
    ]

    const pickup = ride.pickup?.address || ride.pickup?.location || 'N/A'
    const drop = ride.drop?.address || ride.drop?.location || 'N/A'

    res.json({
      success: true,
      data: {
        id: ride._id,
        tripCode: `T-${String(ride._id).slice(-6).toUpperCase()}`,
        status: ride.status,
        statusLabel: meta.label,
        statusTone: meta.tone,
        statusIcon: meta.icon,
        createdAt: ride.createdAt,
        duration: ride.duration,
        distance: ride.distance,
        pickup,
        drop,
        fare: totalFare,
        timeline,
        fareBreakdown: {
          baseFare,
          distanceFare,
          timeFare,
          surgeMultiplier: surge,
          fees,
          discount,
          subtotal,
          platformCommission,
          netDriverPayout,
          totalFare
        },
        payment: {
          method: paymentTxn?.paymentMethod || 'card',
          reference: paymentTxn?.reference || 'N/A',
          status: paymentTxn?.status || 'completed'
        },
        passenger: passenger ? {
          id: passenger._id,
          name: passenger.name,
          phone: passenger.phone,
          avatar: passenger.avatar
        } : null,
        driver: driver ? {
          id: driver._id,
          name: driver.name,
          phone: driver.phone,
          avatar: driver.avatar,
          vehicle: driver.vehicle || {}
        } : null,
        payout: payoutTxn ? { amount: payoutTxn.amount, status: payoutTxn.status } : { amount: netDriverPayout, status: 'calculated' },
        issues: { count: 0 }
      }
    })
  } catch (e) {
    res.status(500).json({ success: false, message: 'Error fetching trip detail' })
  }
})

module.exports = router

// Passengers list with pagination and filters
router.get('/passengers', auth, admin, async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page || '1', 10), 1)
    const perPage = Math.min(parseInt(req.query.per_page || '10', 10), 50)
    const search = req.query.search || ''
    const status = req.query.status || ''

    let query = { role: { $in: ['user', 'passenger'] } }
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ]
    }
    
    if (status === 'active') query.is_suspended = false
    if (status === 'suspended') query.is_suspended = true

    const total = await User.countDocuments(query)
    const items = await User.find(query).sort({ createdAt: -1 }).skip((page-1)*perPage).limit(perPage).lean()

    // Enrich with ride stats
    const data = await Promise.all(items.map(async (p) => {
      const rideStats = await Ride.aggregate([
        { $match: { userId: p._id } },
        { $group: { _id: null, count: { $sum: 1 }, totalSpent: { $sum: '$fare' }, avgRating: { $avg: '$rating' } } }
      ])
      const stats = rideStats[0] || { count: 0, totalSpent: 0, avgRating: 0 }
      
      return {
        id: p._id,
        name: p.name,
        email: p.email,
        phone: p.phone,
        avatar: p.avatar,
        createdAt: p.createdAt,
        is_suspended: p.is_suspended,
        trips: stats.count,
        totalSpent: Math.round(stats.totalSpent * 100) / 100,
        avgRating: Math.round(stats.avgRating * 10) / 10
      }
    }))

    res.json({ success: true, data, total, page, perPage })
  } catch (e) {
    res.status(500).json({ success: false, message: 'Error fetching passengers' })
  }
})

// Passenger details
router.get('/passengers/:id', auth, admin, async (req, res) => {
  try {
    const id = req.params.id
    const user = await User.findById(id).lean()
    if (!user || !['user', 'passenger'].includes(user.role)) {
      return res.status(404).json({ success: false, message: 'Passenger not found' })
    }

    // Ride stats
    const rideStats = await Ride.aggregate([
      { $match: { userId: user._id } },
      { $group: { _id: null, count: { $sum: 1 }, totalSpent: { $sum: '$fare' }, avgRating: { $avg: '$rating' } } }
    ])
    const stats = rideStats[0] || { count: 0, totalSpent: 0, avgRating: 0 }

    // Recent rides
    const recentRides = await Ride.find({ userId: user._id }).sort({ createdAt: -1 }).limit(10).lean()

    // Saved addresses (store in user.addresses if available, else return empty)
    const addresses = user.addresses || []

    res.json({
      success: true,
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        avatar: user.avatar,
        createdAt: user.createdAt,
        is_suspended: user.is_suspended,
        stats: {
          trips: stats.count,
          totalSpent: Math.round(stats.totalSpent * 100) / 100,
          avgRating: Math.round(stats.avgRating * 10) / 10
        },
        addresses,
        recentRides
      }
    })
  } catch (e) {
    res.status(500).json({ success: false, message: 'Error fetching passenger details' })
  }
})

// Suspend passenger
router.post('/passengers/:id/suspend', auth, admin, async (req, res) => {
  try {
    const id = req.params.id
    const { reason } = req.body
    const user = await User.findByIdAndUpdate(id, { is_suspended: true }, { new: true }).lean()
    if (!user) return res.status(404).json({ success: false, message: 'Passenger not found' })
    res.json({ success: true, message: 'Passenger suspended successfully', data: user })
  } catch (e) {
    res.status(500).json({ success: false, message: 'Error suspending passenger' })
  }
})

// Unsuspend passenger
router.post('/passengers/:id/unsuspend', auth, admin, async (req, res) => {
  try {
    const id = req.params.id
    const user = await User.findByIdAndUpdate(id, { is_suspended: false }, { new: true }).lean()
    if (!user) return res.status(404).json({ success: false, message: 'Passenger not found' })
    res.json({ success: true, message: 'Passenger activated successfully', data: user })
  } catch (e) {
    res.status(500).json({ success: false, message: 'Error activating passenger' })
  }
})

// Reset passenger password
router.post('/passengers/:id/reset-password', auth, admin, async (req, res) => {
  try {
    const id = req.params.id
    const bcrypt = require('bcrypt')
    const newPassword = 'password123' // Default password, should be emailed to user
    const passwordHash = await bcrypt.hash(newPassword, 10)
    const user = await User.findByIdAndUpdate(id, { passwordHash }, { new: true }).lean()
    if (!user) return res.status(404).json({ success: false, message: 'Passenger not found' })
    res.json({ success: true, message: 'Password reset to: password123', data: user })
  } catch (e) {
    res.status(500).json({ success: false, message: 'Error resetting password' })
  }
})

// Delete passenger
router.delete('/passengers/:id', auth, admin, async (req, res) => {
  try {
    const id = req.params.id
    const user = await User.findByIdAndDelete(id)
    if (!user) return res.status(404).json({ success: false, message: 'Passenger not found' })
    res.json({ success: true, message: 'Passenger deleted successfully' })
  } catch (e) {
    res.status(500).json({ success: false, message: 'Error deleting passenger' })
  }
})

// Update passenger addresses
router.put('/passengers/:id/addresses', auth, admin, async (req, res) => {
  try {
    const id = req.params.id
    const { addresses } = req.body
    const user = await User.findByIdAndUpdate(id, { addresses }, { new: true }).lean()
    if (!user) return res.status(404).json({ success: false, message: 'Passenger not found' })
    res.json({ success: true, message: 'Addresses updated successfully', data: user })
  } catch (e) {
    res.status(500).json({ success: false, message: 'Error updating addresses' })
  }
})

// Update passenger payment methods
router.put('/passengers/:id/payment-methods', auth, admin, async (req, res) => {
  try {
    const id = req.params.id
    const { paymentMethods } = req.body
    const user = await User.findByIdAndUpdate(id, { paymentMethods }, { new: true }).lean()
    if (!user) return res.status(404).json({ success: false, message: 'Passenger not found' })
    res.json({ success: true, message: 'Payment methods updated successfully', data: user })
  } catch (e) {
    res.status(500).json({ success: false, message: 'Error updating payment methods' })
  }
})

// Suspend driver
router.post('/drivers/:id/suspend', auth, admin, async (req, res) => {
  try {
    const id = req.params.id
    const { reason } = req.body
    const user = await User.findByIdAndUpdate(id, { is_suspended: true }, { new: true }).lean()
    if (!user) return res.status(404).json({ success: false, message: 'Driver not found' })
    res.json({ success: true, message: 'Driver suspended successfully', data: user })
  } catch (e) {
    res.status(500).json({ success: false, message: 'Error suspending driver' })
  }
})

// Unsuspend driver
router.post('/drivers/:id/unsuspend', auth, admin, async (req, res) => {
  try {
    const id = req.params.id
    const user = await User.findByIdAndUpdate(id, { is_suspended: false }, { new: true }).lean()
    if (!user) return res.status(404).json({ success: false, message: 'Driver not found' })
    res.json({ success: true, message: 'Driver activated successfully', data: user })
  } catch (e) {
    res.status(500).json({ success: false, message: 'Error activating driver' })
  }
})

// Manual payout for driver
router.post('/drivers/:id/payout', auth, admin, async (req, res) => {
  try {
    const id = req.params.id
    const { amount } = req.body
    const user = await User.findById(id).lean()
    if (!user || user.role !== 'driver') return res.status(404).json({ success: false, message: 'Driver not found' })
    
    // Create payout transaction
    const DriverPayout = require('../models/driverPayout')
    const payout = await DriverPayout.create({
      driverId: user._id,
      amount,
      status: 'completed',
      type: 'manual',
      processedAt: new Date()
    })
    
    res.json({ success: true, message: 'Payout processed successfully', data: payout })
  } catch (e) {
    res.status(500).json({ success: false, message: 'Error processing payout' })
  }
})

// Send message to driver
router.post('/drivers/:id/message', auth, admin, async (req, res) => {
  try {
    const id = req.params.id
    const { message } = req.body
    const user = await User.findById(id).lean()
    if (!user || user.role !== 'driver') return res.status(404).json({ success: false, message: 'Driver not found' })
    
    // In a real app, this would send a push notification or SMS
    // For now, just log it
    console.log(`Message to driver ${id}: ${message}`)
    
    res.json({ success: true, message: 'Message sent successfully' })
  } catch (e) {
    res.status(500).json({ success: false, message: 'Error sending message' })
  }
})

