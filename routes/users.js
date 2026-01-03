const express = require('express')
const router = express.Router()
const User = require('../models/user')
const auth = require('../middleware/auth')
const admin = require('../middleware/admin')

// register
const validate = require('../middleware/validate')

router.post('/', validate(['email','password']), async (req, res) => {
  const { name, email, password } = req.body
  if (!email || !password) return res.status(400).json({ success: false, message: 'email and password required' })
  const exists = await User.findOne({ email }).lean()
  if (exists) return res.status(400).json({ success: false, message: 'email exists' })
  const bcrypt = require('bcrypt')
  const passwordHash = await bcrypt.hash(password, 10)
  const u = await User.create({ name, email, passwordHash, role: 'user' })
  res.json({ success: true, data: { id: u._id, email: u.email, name: u.name } })
})

// get current user
router.get('/me', auth, async (req, res) => {
  res.json({ success: true, data: req.user })
})

// update profile (owner or admin)
router.patch('/:id', auth, async (req, res) => {
  const id = req.params.id
  if (String(req.user._id) !== String(id) && req.user.role !== 'admin') return res.status(403).json({ success: false })
  const { name } = req.body
  const u = await User.findByIdAndUpdate(id, { name }, { new: true }).lean()
  res.json({ success: true, data: u })
})

// list users (admin)
// Advanced filter: status, dateJoined, city, deviceType
router.get('/', auth, admin, async (req, res) => {
  const { status, dateJoined, city, deviceType, page = 1, per_page = 10 } = req.query
  const query = {}
  // Status filter
  if (status === 'active') query.is_suspended = false
  if (status === 'suspended') query.is_suspended = true
  // Date joined filter
  if (dateJoined === '30') {
    const d = new Date(); d.setDate(d.getDate() - 30)
    query.createdAt = { $gte: d }
  } else if (dateJoined === '90') {
    const d = new Date(); d.setDate(d.getDate() - 90)
    query.createdAt = { $gte: d }
  }
  // Role filter (support agents etc.)
  if (req.query.role) {
    const r = req.query.role
    query.$or = [{ role: r }, { roles: r }]
  }
  // City filter
  if (city) query.city = { $regex: city, $options: 'i' }
  // Device type filter (assume deviceType is stored in user.agent or similar, adjust as needed)
  if (deviceType) query['deviceType'] = deviceType

  const skip = (parseInt(page) - 1) * parseInt(per_page)
  const limit = parseInt(per_page)
  const [data, total] = await Promise.all([
    User.find(query).skip(skip).limit(limit).lean(),
    User.countDocuments(query)
  ])
  res.json({ success: true, data, total })
})

// Admin: set roles array for a user (replace)
router.put('/:id/roles', auth, admin, async (req, res) => {
  const id = req.params.id
  const { roles } = req.body
  if (!Array.isArray(roles)) return res.status(400).json({ success: false, message: 'roles array required' })
  // optionally validate roles exist by slug
  const UserModel = require('../models/user')
  const u = await UserModel.findById(id)
  if (!u) return res.status(404).json({ success: false, message: 'User not found' })
  u.roles = roles
  await u.save()
  // audit
  try{ const AuditLog = require('../models/auditLog'); await AuditLog.create({ actorId: req.user?._id, actorName: req.user?.name, action: 'update_user_roles', targetType: 'User', targetId: u._id, details: { roles }, ip: req.ip }) }catch(e){ console.error('audit log failed', e) }
  res.json({ success: true, data: { id: u._id, roles: u.roles } })
})

module.exports = router
