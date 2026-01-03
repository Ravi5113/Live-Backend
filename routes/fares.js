const express = require('express')
const router = express.Router()
const Fare = require('../models/fare')

router.get('/', async (req, res) => {
  // Only return configuration fares (not per-ride fare breakdowns)
  const fares = await Fare.find({ name: { $exists: true } }).sort({ effectiveFrom: -1, name: 1 }).lean()
  res.json({ success: true, data: fares })
})

const auth = require('../middleware/auth')
const admin = require('../middleware/admin')

const validate = require('../middleware/validate')

router.post('/', auth, admin, validate(['name']), async (req, res) => {
  const { name, base, perKm, perMin, isActive, effectiveFrom } = req.body
  const payload = { name, base, perKm, perMin }
  if (isActive !== undefined) payload.isActive = !!isActive
  if (effectiveFrom) payload.effectiveFrom = new Date(effectiveFrom)
  const f = await Fare.create(payload)
  res.json({ success: true, data: f })
})

// Update a fare
router.put('/:id', auth, admin, async (req, res) => {
  const { id } = req.params
  const { name, base, perKm, perMin, isActive, effectiveFrom } = req.body
  const update = {}
  if (name !== undefined) update.name = name
  if (base !== undefined) update.base = base
  if (perKm !== undefined) update.perKm = perKm
  if (perMin !== undefined) update.perMin = perMin
  if (isActive !== undefined) update.isActive = !!isActive
  if (effectiveFrom) update.effectiveFrom = new Date(effectiveFrom)
  const f = await Fare.findByIdAndUpdate(id, update, { new: true })
  if (!f) return res.status(404).json({ success: false, message: 'Fare not found' })
  res.json({ success: true, data: f })
})

// Delete a fare
router.delete('/:id', auth, admin, async (req, res) => {
  const { id } = req.params
  const f = await Fare.findByIdAndDelete(id)
  if (!f) return res.status(404).json({ success: false, message: 'Fare not found' })
  res.json({ success: true, message: 'Deleted' })
})

router.get('/current', async (req, res) => {
  const f = await Fare.findOne().sort({ createdAt: -1 }).lean()
  res.json({ success: true, data: f })
})

// calculate fare estimate
router.post('/calc', async (req, res) => {
  const { distanceKm, durationMin } = req.body
  const f = await Fare.findOne().sort({ createdAt: -1 }).lean()
  if (!f) return res.status(400).json({ success: false, message: 'No fare configured' })
  const estimate = (f.base || 0) + (f.perKm || 0) * (distanceKm || 0) + (f.perMin || 0) * (durationMin || 0)
  res.json({ success: true, data: { estimate } })
})

module.exports = router
