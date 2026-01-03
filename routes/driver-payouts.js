const express = require('express')
const router = express.Router()
const DriverPayout = require('../models/driverPayout')

const auth = require('../middleware/auth')
const admin = require('../middleware/admin')

router.post('/', auth, admin, async (req, res) => {
  const { driverId, amount, method } = req.body
  if (!driverId || typeof amount !== 'number') return res.status(400).json({ success: false, message: 'Invalid payload' })
  const p = await DriverPayout.create({ driverId, amount, method })
  res.json({ success: true, data: p })
})

router.get('/', async (req, res) => {
  try {
    const { startDate, endDate } = req.query
    const filter = {}
    if (startDate && endDate) {
      filter.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) }
    }

    const list = await DriverPayout.find(filter)
      .sort({ createdAt: -1 })
      .populate('driverId', 'name email')
      .lean()

    res.json({ success: true, data: list })
  } catch (err) {
    console.error('driver-payouts fetch error', err)
    res.status(500).json({ success: false, message: 'Failed to fetch payouts' })
  }
})

router.patch('/:id', async (req, res) => {
  const { status, notes } = req.body
  const p = await DriverPayout.findByIdAndUpdate(req.params.id, { status, notes }, { new: true })
  res.json({ success: true, data: p })
})

module.exports = router
