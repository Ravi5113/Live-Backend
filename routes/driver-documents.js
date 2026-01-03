const express = require('express')
const router = express.Router()
const DriverDocument = require('../models/driverDocument')

router.post('/', async (req, res) => {
  // expects driverId, type, url
  const { driverId, type, url } = req.body
  if (!driverId || !type || !url) return res.status(400).json({ success: false })
  const d = await DriverDocument.create({ driverId, type, url })
  res.json({ success: true, data: d })
})

router.get('/driver/:driverId', async (req, res) => {
  const docs = await DriverDocument.find({ driverId: req.params.driverId }).lean()
  res.json({ success: true, data: docs })
})

router.patch('/:id', async (req, res) => {
  const { status, notes } = req.body
  const d = await DriverDocument.findByIdAndUpdate(req.params.id, { status, notes }, { new: true })
  res.json({ success: true, data: d })
})

module.exports = router
