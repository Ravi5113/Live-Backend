const express = require('express')
const router = express.Router()
const auth = require('../middleware/auth')
const admin = require('../middleware/admin')
const Permission = require('../models/permission')

// Update a permission (including actions)
router.put('/:id', auth, admin, async (req, res) => {
  const { name, slug, description, actions } = req.body
  const p = await Permission.findById(req.params.id)
  if (!p) return res.status(404).json({ success: false, message: 'Permission not found' })
  if (name && name !== p.name) {
    const exists = await Permission.countDocuments({ name, _id: { $ne: p._id } })
    if (exists) return res.status(400).json({ success: false, message: 'name exists' })
    p.name = name
  }
  if (typeof slug !== 'undefined') p.slug = slug
  if (typeof description !== 'undefined') p.description = description
  if (Array.isArray(actions)) p.actions = actions
  await p.save()
  res.json({ success: true, data: p })
})

// List unused permissions (not referenced by any role)
router.get('/unused', auth, admin, async (req, res) => {
  const Role = require('../models/role')
  const roles = await Role.find({}).select('permissions').lean()
  const used = new Set()
  roles.forEach(r => {
    (r.permissions || []).forEach(pid => used.add(String(pid)))
  })
  const unused = await Permission.find({ _id: { $nin: Array.from(used) } }).lean()
  res.json({ success: true, data: unused })
})

// Delete permission
router.delete('/:id', auth, admin, async (req, res) => {
  const p = await Permission.findById(req.params.id)
  if (!p) return res.status(404).json({ success: false, message: 'Permission not found' })
  // ensure no roles reference this permission
  const Role = require('../models/role')
  const used = await Role.countDocuments({ permissions: p._id })
  if (used > 0) return res.status(400).json({ success: false, message: 'Permission referenced by roles; revoke first' })
  await Permission.deleteOne({ _id: p._id })
  try{ const AuditLog = require('../models/auditLog'); await AuditLog.create({ actorId: req.user?._id, actorName: req.user?.name, action: 'delete_permission', targetType: 'Permission', targetId: p._id, details: { slug: p.slug, name: p.name }, ip: req.ip }) }catch(e){ console.error('audit log failed', e) }
  res.json({ success: true })
})

// List all permissions
router.get('/', auth, admin, async (req, res) => {
  const list = await Permission.find({}).sort({ name: 1 }).lean()
  res.json({ success: true, data: list })
})

// Create a permission
router.post('/', auth, admin, async (req, res) => {
  const { name, slug, description } = req.body
  if (!name) return res.status(400).json({ success: false, message: 'name required' })
  const exists = await Permission.findOne({ $or: [{ name }, slug ? { slug } : null ].filter(Boolean) })
  if (exists) return res.status(400).json({ success: false, message: 'permission exists' })
  const p = await Permission.create({ name, slug, description })
  res.status(201).json({ success: true, data: p })
})

module.exports = router
