const express = require('express')
const router = express.Router()
const SupportTicket = require('../models/supportTicket')
const SupportMessage = require('../models/supportMessage')
const User = require('../models/user')
const AuditLog = require('../models/auditLog')

router.post('/tickets', async (req, res) => {
  let { userId, subject, message } = req.body
  userId = userId || req.session?.userId || null
  if (!userId || !subject) return res.status(400).json({ success: false })
  const ticket = await SupportTicket.create({ userId, subject })
  if (message) await SupportMessage.create({ ticketId: ticket._id, senderId: userId, message })
  res.json({ success: true, data: ticket })
})

router.get('/tickets/:id', async (req, res) => {
  // populate reporter and assignee contact fields for admin convenience
  const ticket = await SupportTicket.findById(req.params.id)
    .populate('userId', 'name email phone')
    .populate('assigneeId', 'name email phone')
    .lean()
  const messages = await SupportMessage.find({ ticketId: req.params.id }).sort({ createdAt: 1 }).lean()
  res.json({ success: true, data: { ticket, messages } })
})

// List tickets: admins see all, users see their own
router.get('/tickets', async (req, res) => {
  const sessionUserId = req.session?.userId
  if (!sessionUserId) return res.status(401).json({ success: false, message: 'Not authenticated' })
  const user = await User.findById(sessionUserId).lean()
  if (!user) return res.status(401).json({ success: false, message: 'Invalid session user' })
  let tickets
  if (user.role === 'admin') {
    tickets = await SupportTicket.find().sort({ createdAt: -1 }).lean()
  } else {
    tickets = await SupportTicket.find({ userId: sessionUserId }).sort({ createdAt: -1 }).lean()
  }
  res.json({ success: true, data: tickets })
})

router.post('/tickets/:id/messages', async (req, res) => {
  const sessionUserId = req.session?.userId || null
  const body = req.body || {}
  const message = body.message
  if (!message) return res.status(400).json({ success: false, message: 'Message is required' })

  // Determine userId and senderRole: prefer authenticated session
  let userId = sessionUserId || body.senderId || null
  let senderRole = 'user'
  if (sessionUserId) {
    const user = await User.findById(sessionUserId).lean()
    if (user && user.role === 'admin') senderRole = 'admin'
  } else if (body.senderRole) {
    senderRole = body.senderRole === 'admin' ? 'admin' : 'user'
  }

  const m = await SupportMessage.create({ ticketId: req.params.id, userId, senderRole, message })
  res.json({ success: true, data: m })
})

// Update ticket (status, assignee)
router.put('/tickets/:id', async (req, res) => {
  const sessionUserId = req.session?.userId
  if (!sessionUserId) return res.status(401).json({ success: false, message: 'Not authenticated' })
  const user = await User.findById(sessionUserId).lean()
  if (!user) return res.status(401).json({ success: false, message: 'Invalid session user' })
  // Only admin may modify ticket status/assignment
  if (user.role !== 'admin') return res.status(403).json({ success: false, message: 'Forbidden' })

  const { status, assigneeId } = req.body
  const ticket = await SupportTicket.findById(req.params.id)
  if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' })

  if (typeof status !== 'undefined') {
    ticket.status = status
    if (status === 'resolved' && !ticket.resolvedAt) ticket.resolvedAt = new Date()
  }
  if (typeof assigneeId !== 'undefined') {
    ticket.assigneeId = assigneeId || null
  }

  await ticket.save()
  // audit the change
  try{
    await AuditLog.create({
      actorId: req.user?._id || sessionUserId,
      actorName: req.user?.name || 'system',
      action: 'update_support_ticket',
      targetType: 'SupportTicket',
      targetId: ticket._id,
      details: { status: ticket.status, assigneeId: ticket.assigneeId, resolvedAt: ticket.resolvedAt },
      ip: req.ip
    })
  }catch(e){ console.error('audit log failed', e) }

  res.json({ success: true, data: ticket })
})

module.exports = router
