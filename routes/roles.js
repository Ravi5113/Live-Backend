const express = require('express')
const router = express.Router()
const auth = require('../middleware/auth')
const admin = require('../middleware/admin')
const Role = require('../models/role')
const Permission = require('../models/permission')
const User = require('../models/user')
const AuditLog = require('../models/auditLog')

// List roles with optional pagination
router.get('/', auth, admin, async (req, res) => {
  const page = Math.max(parseInt(req.query.page || '1', 10), 1)
  const perPage = Math.min(parseInt(req.query.per_page || '15', 10), 100)
  const search = (req.query.q || '').trim()

  const filter = {}
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { slug: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } }
    ]
  }

  const total = await Role.countDocuments(filter)
  const roles = await Role.find(filter)
    .sort({ name: 1 })
    .skip((page - 1) * perPage)
    .limit(perPage)
    .populate('permissions', 'name slug description')
    .lean()

  res.json({ success: true, data: roles, total, page, perPage })
})

// Create role
router.post('/', auth, admin, async (req, res) => {
  const { name, slug, description, permission_ids } = req.body
  if (!name || !slug) {
    return res.status(400).json({ success: false, message: 'name and slug required' })
  }
  const exists = await Role.findOne({ $or: [{ name }, { slug }] })
  if (exists) return res.status(400).json({ success: false, message: 'role name or slug exists' })

  const { permission_actions } = req.body
  const role = await Role.create({ name, slug, description })
  if (Array.isArray(permission_ids) && permission_ids.length) {
    const validIds = await Permission.find({ _id: { $in: permission_ids } }).select('_id').lean()
    role.permissions = validIds.map(p => p._id)
  }
  if (permission_actions && typeof permission_actions === 'object') {
    role.permissionActions = permission_actions
  }
  await role.save()
  const populated = await Role.findById(role._id).populate('permissions', 'name slug description').lean()
  // audit
  try{ await AuditLog.create({ actorId: req.user?._id, actorName: req.user?.name, action: 'create_role', targetType: 'Role', targetId: role._id, details: { slug: role.slug, name: role.name }, ip: req.ip }) }catch(e){ console.error('audit log failed', e) }
  // include permissionActions in response
  populated.permissionActions = role.permissionActions || {}
  res.status(201).json({ success: true, data: populated })
})

// Get role
router.get('/:id', auth, admin, async (req, res) => {
  const role = await Role.findById(req.params.id).populate('permissions', 'name slug description').lean()
  if (!role) return res.status(404).json({ success: false, message: 'Role not found' })
  res.json({ success: true, data: role })
})

// Update role (and optionally sync permissions)
router.put('/:id', auth, admin, async (req, res) => {
  const { name, slug, description, permission_ids } = req.body
  const role = await Role.findById(req.params.id)
  if (!role) return res.status(404).json({ success: false, message: 'Role not found' })

  // unique checks if changed
  if (name && name !== role.name) {
    const existsName = await Role.countDocuments({ name, _id: { $ne: role._id } })
    if (existsName) return res.status(400).json({ success: false, message: 'name exists' })
    role.name = name
  }
  if (slug && slug !== role.slug) {
    const existsSlug = await Role.countDocuments({ slug, _id: { $ne: role._id } })
    if (existsSlug) return res.status(400).json({ success: false, message: 'slug exists' })
    role.slug = slug
  }
  if (typeof description !== 'undefined') role.description = description

  const { permission_actions } = req.body
  if (Array.isArray(permission_ids)) {
    const validIds = await Permission.find({ _id: { $in: permission_ids } }).select('_id').lean()
    role.permissions = validIds.map(p => p._id)
  }
  if (permission_actions && typeof permission_actions === 'object') {
    role.permissionActions = permission_actions
  }

  await role.save()
  const populated = await Role.findById(role._id).populate('permissions', 'name slug description').lean()
  // audit
  try{ await AuditLog.create({ actorId: req.user?._id, actorName: req.user?.name, action: 'update_role', targetType: 'Role', targetId: role._id, details: { slug: role.slug, name: role.name, fields: { name, slug, description } }, ip: req.ip }) }catch(e){ console.error('audit log failed', e) }
  res.json({ success: true, data: populated })
})

// Delete role (guard admin and assigned users)
router.delete('/:id', auth, admin, async (req, res) => {
  const role = await Role.findById(req.params.id)
  if (!role) return res.status(404).json({ success: false, message: 'Role not found' })
  if (role.slug === 'admin') return res.status(400).json({ success: false, message: 'Cannot delete admin role' })

  // Check users assigned to this role (support legacy `role` field and new `roles` array)
  const assignedUsers = await User.countDocuments({ $or: [{ role: role.slug }, { roles: role.slug }] })
  if (assignedUsers > 0) return res.status(400).json({ success: false, message: 'Role assigned to users; cannot delete' })

  await Role.deleteOne({ _id: role._id })
  // audit
  try{ await AuditLog.create({ actorId: req.user?._id, actorName: req.user?.name, action: 'delete_role', targetType: 'Role', targetId: role._id, details: { slug: role.slug, name: role.name }, ip: req.ip }) }catch(e){ console.error('audit log failed', e) }
  res.json({ success: true })
})

// List role permissions
router.get('/:id/permissions', auth, admin, async (req, res) => {
  const role = await Role.findById(req.params.id).populate('permissions', 'name slug description').lean()
  if (!role) return res.status(404).json({ success: false, message: 'Role not found' })
  // include permissionActions mapping for the role
  const out = (role.permissions || []).map(p => ({ id: p._id || p.id, name: p.name, description: p.description, actions: (role.permissionActions || {})[String(p._id) || String(p.id)] || [] }))
  res.json({ success: true, data: out })
})

// List users for a role
router.get('/:id/users', auth, admin, async (req, res) => {
  const role = await Role.findById(req.params.id).lean()
  if (!role) return res.status(404).json({ success: false, message: 'Role not found' })
  const users = await User.find({ $or: [{ role: role.slug }, { roles: role.slug }] }).select('name email phone roles role').lean()
  res.json({ success: true, data: users })
})

// Assign permissions to role (merge)
router.post('/:id/permissions', auth, admin, async (req, res) => {
  const { permission_ids } = req.body
  if (!Array.isArray(permission_ids) || !permission_ids.length) {
    return res.status(400).json({ success: false, message: 'permission_ids array required' })
  }
  const role = await Role.findById(req.params.id)
  if (!role) return res.status(404).json({ success: false, message: 'Role not found' })
  const validIds = await Permission.find({ _id: { $in: permission_ids } }).select('_id').lean()
  const idSet = new Set((role.permissions || []).map(id => String(id)))
  validIds.forEach(p => idSet.add(String(p._id)))
  role.permissions = Array.from(idSet)
  // merge actions map if provided
  if (req.body.permission_actions && typeof req.body.permission_actions === 'object') {
    role.permissionActions = Object.assign({}, role.permissionActions || {}, req.body.permission_actions)
  }
  await role.save()
  const populated = await Role.findById(role._id).populate('permissions', 'name slug description').lean()
  // audit: permissions added
  try{ await AuditLog.create({ actorId: req.user?._id, actorName: req.user?.name, action: 'assign_permissions', targetType: 'Role', targetId: role._id, details: { added_permission_ids: validIds.map(p=>String(p._id)) }, ip: req.ip }) }catch(e){ console.error('audit log failed', e) }
  res.json({ success: true, data: populated })
})

// Revoke permissions from role
router.delete('/:id/permissions', auth, admin, async (req, res) => {
  const { permission_ids } = req.body
  if (!Array.isArray(permission_ids) || !permission_ids.length) {
    return res.status(400).json({ success: false, message: 'permission_ids array required' })
  }
  const role = await Role.findById(req.params.id)
  if (!role) return res.status(404).json({ success: false, message: 'Role not found' })
  const revoke = new Set(permission_ids.map(id => String(id)))
  role.permissions = (role.permissions || []).filter(id => !revoke.has(String(id)))
  // remove any actions entries for revoked permissions
  if (role.permissionActions && typeof role.permissionActions === 'object') {
    for (const pid of permission_ids) {
      delete role.permissionActions[String(pid)]
    }
  }
  await role.save()
  const populated = await Role.findById(role._id).populate('permissions', 'name slug description').lean()
  // audit: permissions revoked
  try{ await AuditLog.create({ actorId: req.user?._id, actorName: req.user?.name, action: 'revoke_permissions', targetType: 'Role', targetId: role._id, details: { revoked_permission_ids: permission_ids }, ip: req.ip }) }catch(e){ console.error('audit log failed', e) }
  res.json({ success: true, data: populated })
})

module.exports = router
