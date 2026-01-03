const express = require('express')
const router = express.Router()
const auth = require('../middleware/auth')
const admin = require('../middleware/admin')
const Ticket = require('../models/ticket')
const User = require('../models/user')

// Create ticket (public)
router.post('/', auth, async (req, res) => {
  try{
    const { title, description, category, priority, attachments } = req.body || {}
    const ticket = await Ticket.create({
      title,
      description,
      category,
      priority,
      reporterId: req.user ? req.user._id : undefined,
      attachments: Array.isArray(attachments) ? attachments : []
    })
    res.json({ success: true, data: ticket })
  }catch(e){
    console.error('create ticket', e)
    res.status(500).json({ success: false, message: 'Failed to create ticket' })
  }
})

// List tickets (admin/support) with filters
router.get('/', auth, async (req, res) => {
  try{
    const q = {}
    if(req.query.status) q.status = req.query.status
    if(req.query.category) q.category = req.query.category
    if(req.query.assigneeId) q.assigneeId = req.query.assigneeId
    if(req.query.reporterId) q.reporterId = req.query.reporterId
    const page = Math.max(parseInt(req.query.page||'1',10),1)
    const perPage = Math.min(parseInt(req.query.per_page||'20',10),100)
    const total = await Ticket.countDocuments(q)
    const items = await Ticket.find(q).sort({ updatedAt: -1 }).skip((page-1)*perPage).limit(perPage).lean()
    // enrich with reporter/assignee names
    const userIds = new Set()
    items.forEach(it=>{ if(it.reporterId) userIds.add(String(it.reporterId)); if(it.assigneeId) userIds.add(String(it.assigneeId)) })
    const users = userIds.size ? await User.find({ _id: { $in: Array.from(userIds) } }).select('name email').lean() : []
    const userMap = new Map(users.map(u=>[String(u._id), u.name || u.email]))
    const out = items.map(it=>{
      it.reporter = it.reporterId ? (userMap.get(String(it.reporterId)) || String(it.reporterId)) : null
      it.assignee = it.assigneeId ? (userMap.get(String(it.assigneeId)) || String(it.assigneeId)) : null
      it.timeToFirstResponse = it.firstResponseAt ? (new Date(it.firstResponseAt) - new Date(it.createdAt)) : null
      it.timeToResolution = it.resolvedAt ? (new Date(it.resolvedAt) - new Date(it.createdAt)) : null
      return it
    })
    res.json({ success: true, data: out, total, page, perPage })
  }catch(e){
    console.error('list tickets', e)
    res.status(500).json({ success: false, message: 'Failed to list tickets' })
  }
})

// Get ticket
router.get('/:id', auth, async (req, res) => {
  try{
    const t = await Ticket.findById(req.params.id).lean()
    if(!t) return res.status(404).json({ success:false, message:'Not found' })
    // enrich
    const reporter = t.reporterId ? await User.findById(t.reporterId).select('name email').lean() : null
    const assignee = t.assigneeId ? await User.findById(t.assigneeId).select('name email').lean() : null
    const out = Object.assign({}, t, {
      reporter: reporter ? (reporter.name || reporter.email) : null,
      assignee: assignee ? (assignee.name || assignee.email) : null,
      timeToFirstResponse: t.firstResponseAt ? (new Date(t.firstResponseAt) - new Date(t.createdAt)) : null,
      timeToResolution: t.resolvedAt ? (new Date(t.resolvedAt) - new Date(t.createdAt)) : null
    })
    res.json({ success: true, data: out })
  }catch(e){
    console.error('get ticket', e)
    res.status(500).json({ success:false, message: 'Failed to fetch ticket' })
  }
})

// Update ticket (status, assign, add attachments, add public reply)
router.put('/:id', auth, async (req, res) => {
  try{
    const t = await Ticket.findById(req.params.id)
    if(!t) return res.status(404).json({ success:false, message:'Not found' })
    const { status, assigneeId, priority, title, description, attachments } = req.body || {}
    if(status) {
      t.status = status
      if(status === 'resolved' && !t.resolvedAt) t.resolvedAt = new Date()
    }
    if(priority) t.priority = priority
    if(assigneeId){
      t.assigneeId = assigneeId
      // if assigning for first time, mark firstResponseAt if not set
      if(!t.firstResponseAt) t.firstResponseAt = new Date()
    }
    if(title) t.title = title
    if(description) t.description = description
    if(Array.isArray(attachments) && attachments.length) t.attachments = t.attachments.concat(attachments)
    await t.save()
    res.json({ success: true, data: t })
  }catch(e){
    console.error('update ticket', e)
    res.status(500).json({ success:false, message:'Failed to update ticket' })
  }
})

// Add internal note
router.post('/:id/notes', auth, async (req, res) => {
  try{
    const { body, internal } = req.body || {}
    if(!body) return res.status(400).json({ success:false, message:'body required' })
    const t = await Ticket.findById(req.params.id)
    if(!t) return res.status(404).json({ success:false, message:'Not found' })
    t.notes = t.notes || []
    t.notes.push({ authorId: req.user ? req.user._id : undefined, body, internal: !!internal })
    if(!t.firstResponseAt && !internal){
      t.firstResponseAt = new Date()
    }
    await t.save()
    res.json({ success:true, data: t })
  }catch(e){
    console.error('add note', e)
    res.status(500).json({ success:false, message:'Failed to add note' })
  }
})

module.exports = router
