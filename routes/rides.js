const express = require('express')
const router = express.Router()
const Ride = require('../models/ride')
const auth = require('../middleware/auth')
const admin = require('../middleware/admin')

router.get('/', async (req, res) => {
  const list = await Ride.find().lean()
  res.json({ success: true, data: list })
})

const validate = require('../middleware/validate')

router.post('/', auth, validate(['pickup','drop']), async (req, res) => {
  const { pickup, drop, fare } = req.body
  const ride = await Ride.create({ userId: req.user._id, pickup, drop, fare })
  res.json({ success: true, data: ride })
})

router.get('/active', async (req, res) => {
  const active = await Ride.find({ status: { $ne: 'completed' } }).lean()
  res.json({ success: true, data: active })
})

// Recent rides: latest N rides
router.get('/recent', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || '5', 10) || 5, 50)
  const list = await Ride.find().sort({ createdAt: -1 }).limit(limit).lean()
  res.json({ success: true, data: list })
})

router.get('/:id', async (req, res) => {
  const r = await Ride.findById(req.params.id).lean()
  res.json({ success: true, data: r })
})

// Admin: assign driver
router.post('/:id/assign', auth, admin, async (req, res) => {
  const { driverId } = req.body
  if (!driverId) return res.status(400).json({ success: false, message: 'driverId required' })
  const r = await Ride.findByIdAndUpdate(req.params.id, { driverId, status: 'assigned' }, { new: true }).lean()
  res.json({ success: true, data: r })
})

// Admin: update status
router.post('/:id/status', auth, admin, async (req, res) => {
  const { status } = req.body
  if (!status) return res.status(400).json({ success: false, message: 'status required' })
  const r = await Ride.findByIdAndUpdate(req.params.id, { status }, { new: true }).lean()
  res.json({ success: true, data: r })
})

// Auto-assign: find an available driver (role 'driver' and no active assigned rides) and assign
router.post('/:id/autoassign', async (req, res) => {
  const ride = await Ride.findById(req.params.id)
  if (!ride) return res.status(404).json({ success: false, message: 'Ride not found' })
  if (ride.driverId) return res.status(400).json({ success: false, message: 'Already assigned' })

  const mongoose = require('mongoose')
  const User = mongoose.model('User')

  // find first driver without active assigned rides
  const busyDrivers = await Ride.find({ driverId: { $exists: true }, status: { $in: ['assigned','ongoing'] } }).distinct('driverId')
  const driver = await User.findOne({ role: 'driver', _id: { $nin: busyDrivers } }).lean()
  if (!driver) return res.status(404).json({ success: false, message: 'No available drivers' })

  ride.driverId = driver._id
  ride.status = 'assigned'
  await ride.save()
  res.json({ success: true, data: { ride, driver } })
})

// Complete ride: mark completed, create transaction and driver payout
router.post('/:id/complete', auth, async (req, res) => {
  const ride = await Ride.findById(req.params.id)
  if (!ride) return res.status(404).json({ success: false, message: 'Ride not found' })
  if (ride.status === 'completed') return res.status(400).json({ success: false, message: 'Already completed' })

  // Only admin or ride owner or assigned driver can complete
  const isOwner = String(ride.userId) === String(req.user._id)
  const isDriver = ride.driverId && String(ride.driverId) === String(req.user._id)
  if (!isOwner && !isDriver && req.user.role !== 'admin') return res.status(403).json({ success: false })

  ride.status = 'completed'
  await ride.save()

  const Transaction = require('../models/transaction')
  const Wallet = require('../models/wallet')
  const DriverPayout = require('../models/driverPayout')

  const amount = ride.fare || 0

  // debit user
  const txUser = await Transaction.create({ userId: ride.userId, amount, type: 'debit', description: `Ride ${ride._id}` })
  await Wallet.findOneAndUpdate({ userId: ride.userId }, { $inc: { balance: -amount }, $set: { updatedAt: new Date() } }, { upsert: true })

  // credit driver: simple split (80% to driver)
  const driverShare = Math.round((amount * 0.8) * 100) / 100
  const platformShare = amount - driverShare

  const txDriver = await Transaction.create({ userId: ride.driverId, amount: driverShare, type: 'credit', description: `Ride ${ride._id} payout` })
  await Wallet.findOneAndUpdate({ userId: ride.driverId }, { $inc: { balance: driverShare }, $set: { updatedAt: new Date() } }, { upsert: true })

  // create driver payout record
  const payout = await DriverPayout.create({ driverId: ride.driverId, amount: driverShare, method: 'balance' })

  res.json({ success: true, data: { ride, txUser, txDriver, payout, platformShare } })
})

module.exports = router
