const express = require('express')
const router = express.Router()
const PayoutMethod = require('../models/payoutMethod')
const DriverPayout = require('../models/driverPayout')
const Transaction = require('../models/transaction')
const User = require('../models/user')
const AuditLog = require('../models/auditLog')

// Driver: list own payout methods
router.get('/methods', async (req, res) => {
  const sessionUserId = req.session?.userId
  if (!sessionUserId) return res.status(401).json({ success: false, message: 'Not authenticated' })
  const methods = await PayoutMethod.find({ driverId: sessionUserId }).lean()
  res.json({ success: true, data: methods })
})

// Driver: add payout method
router.post('/methods', async (req, res) => {
  const sessionUserId = req.session?.userId
  if (!sessionUserId) return res.status(401).json({ success: false })
  const { type, label, details } = req.body
  if (!type) return res.status(400).json({ success: false, message: 'type is required' })
  const m = await PayoutMethod.create({ driverId: sessionUserId, type, label, details })
  res.json({ success: true, data: m })
})

// Driver: update/delete own method
router.put('/methods/:id', async (req, res) => {
  const sessionUserId = req.session?.userId
  if (!sessionUserId) return res.status(401).json({ success: false })
  const m = await PayoutMethod.findById(req.params.id)
  if (!m) return res.status(404).json({ success: false })
  if (m.driverId.toString() !== sessionUserId) return res.status(403).json({ success: false })
  const { label, details, verified } = req.body
  if (typeof label !== 'undefined') m.label = label
  if (typeof details !== 'undefined') m.details = details
  if (typeof verified !== 'undefined') m.verified = !!verified
  await m.save()
  res.json({ success: true, data: m })
})

router.delete('/methods/:id', async (req, res) => {
  const sessionUserId = req.session?.userId
  if (!sessionUserId) return res.status(401).json({ success: false })
  const m = await PayoutMethod.findById(req.params.id)
  if (!m) return res.status(404).json({ success: false })
  if (m.driverId.toString() !== sessionUserId) return res.status(403).json({ success: false })
  await m.deleteOne()
  res.json({ success: true })
})

// Driver: request payout (creates DriverPayout + Transaction)
router.post('/request', async (req, res) => {
  const sessionUserId = req.session?.userId
  if (!sessionUserId) return res.status(401).json({ success: false })
  const { amount, methodId, period, notes } = req.body
  if (!amount || !methodId) return res.status(400).json({ success: false, message: 'amount and methodId required' })
  const method = await PayoutMethod.findById(methodId)
  if (!method) return res.status(404).json({ success: false, message: 'Payout method not found' })
  // create payout request
  const payout = await DriverPayout.create({ driverId: sessionUserId, amount, period: period || '', status: 'pending', notes, bankAccount: method.details })
  await Transaction.create({ userId: sessionUserId, amount, type: 'payout', status: 'pending', description: `Payout request ${payout._id}`, meta: { payoutId: payout._id, methodId } })
  res.json({ success: true, data: payout })
})

// Driver: view transactions/ledger
router.get('/transactions', async (req, res) => {
  const sessionUserId = req.session?.userId
  if (!sessionUserId) return res.status(401).json({ success: false })
  const page = parseInt(req.query.page || '1')
  const limit = Math.min(parseInt(req.query.limit || '50'), 200)
  const q = { userId: sessionUserId }
  const items = await Transaction.find(q).sort({ createdAt: -1 }).skip((page-1)*limit).limit(limit).lean()
  res.json({ success: true, data: items })
})

// Admin: list payout requests
router.get('/admin/payouts', async (req, res) => {
  const sessionUserId = req.session?.userId
  if (!sessionUserId) return res.status(401).json({ success: false })
  const user = await User.findById(sessionUserId).lean()
  if (!user || user.role !== 'admin') return res.status(403).json({ success: false })
  const q = {}
  if (req.query.status) q.status = req.query.status
  if (req.query.driverId) q.driverId = req.query.driverId
  const list = await DriverPayout.find(q).sort({ createdAt: -1 }).limit(200).lean()
  res.json({ success: true, data: list })
})

// Admin: process payout (mark processed or failed)
router.post('/admin/payouts/:id/process', async (req, res) => {
  const sessionUserId = req.session?.userId
  if (!sessionUserId) return res.status(401).json({ success: false })
  const user = await User.findById(sessionUserId).lean()
  if (!user || user.role !== 'admin') return res.status(403).json({ success: false })
  const payout = await DriverPayout.findById(req.params.id)
  if (!payout) return res.status(404).json({ success: false })
  const { action, failureReason } = req.body // action: processed|failed
  if (action === 'processed') {
    payout.status = 'processed'
    payout.processedAt = new Date()
    await payout.save()
    await Transaction.updateMany({ 'meta.payoutId': payout._id }, { $set: { status: 'completed' } })
  } else if (action === 'failed') {
    payout.status = 'failed'
    payout.notes = (payout.notes || '') + '\nFailure: ' + (failureReason || 'unknown')
    await payout.save()
    await Transaction.updateMany({ 'meta.payoutId': payout._id }, { $set: { status: 'failed' } })
  }
  try{ await AuditLog.create({ actorId: sessionUserId, actorName: user.name || 'admin', action: 'process_payout', targetType: 'DriverPayout', targetId: payout._id, details: { action }, ip: req.ip }) }catch(e){console.error('audit error', e)}
  res.json({ success: true, data: payout })
})

module.exports = router
