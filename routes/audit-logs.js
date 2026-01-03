const express = require('express')
const router = express.Router()
const auth = require('../middleware/auth')
const admin = require('../middleware/admin')
const AuditLog = require('../models/auditLog')

// List audit logs (admin) with enrichment (resolve role/permission/user names)
router.get('/', auth, admin, async (req, res) => {
  const page = Math.max(parseInt(req.query.page || '1', 10), 1)
  const perPage = Math.min(parseInt(req.query.per_page || '20', 10), 100)
  const filter = {}
  if (req.query.actorId) filter.actorId = req.query.actorId
  if (req.query.action) filter.action = req.query.action
  if (req.query.targetType) filter.targetType = req.query.targetType

  const total = await AuditLog.countDocuments(filter)
  const items = await AuditLog.find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * perPage)
    .limit(perPage)
    .lean()

  // Collect ids to resolve
  const permIds = new Set()
  const roleIds = new Set()
  const userIds = new Set()

  items.forEach(it => {
    if (it.actorId) userIds.add(String(it.actorId))
    if (it.targetType === 'Role' && it.targetId) roleIds.add(String(it.targetId))
    const d = it.details || {}
    ;['added_permission_ids','revoked_permission_ids','permission_ids','added_permissions','removed_permissions'].forEach(k=>{
      if (Array.isArray(d[k])) d[k].forEach(id => permIds.add(String(id)))
    })
    if (Array.isArray(d.roles)) d.roles.forEach(r => { if(typeof r === 'string' && r.match(/^[0-9a-fA-F]{24}$/)) roleIds.add(String(r)) })
    if (d.userId) userIds.add(String(d.userId))
  })

  const [permissions, roles, users] = await Promise.all([
    permIds.size ? require('../models/permission').find({ _id: { $in: Array.from(permIds) } }).select('name').lean() : Promise.resolve([]),
    roleIds.size ? require('../models/role').find({ _id: { $in: Array.from(roleIds) } }).select('name slug').lean() : Promise.resolve([]),
    userIds.size ? require('../models/user').find({ _id: { $in: Array.from(userIds) } }).select('name email').lean() : Promise.resolve([])
  ])

  const permMap = new Map(permissions.map(p => [String(p._id), p.name]))
  const roleMapById = new Map(roles.map(r => [String(r._id), { name: r.name, slug: r.slug }]))
  const roleMapBySlug = new Map(roles.filter(r=>r.slug).map(r=>[String(r.slug), r.name]))
  const userMap = new Map(users.map(u => [String(u._id), u.name || u.email || String(u._id)]))

  const enriched = items.map(it => {
    const e = Object.assign({}, it)
    e.actorDisplay = it.actorName || (it.actorId ? (userMap.get(String(it.actorId)) || String(it.actorId)) : 'system')
    if (it.targetType === 'Role' && it.targetId) {
      const r = roleMapById.get(String(it.targetId))
      e.targetDisplay = r ? `${r.name}${r.slug ? ' ('+r.slug+')' : ''}` : String(it.targetId)
    } else if (it.targetType) {
      e.targetDisplay = it.targetType + (it.targetId ? ' ' + String(it.targetId) : '')
    } else e.targetDisplay = ''

    const d = it.details || {}
    const enrichedDetails = {}
    if (Array.isArray(d.added_permission_ids) && d.added_permission_ids.length) {
      enrichedDetails.added_permissions = d.added_permission_ids.map(id => ({ id, name: permMap.get(String(id)) || id }))
    }
    if (Array.isArray(d.revoked_permission_ids) && d.revoked_permission_ids.length) {
      enrichedDetails.revoked_permissions = d.revoked_permission_ids.map(id => ({ id, name: permMap.get(String(id)) || id }))
    }
    if (Array.isArray(d.permission_ids) && d.permission_ids.length) {
      enrichedDetails.permissions = d.permission_ids.map(id => ({ id, name: permMap.get(String(id)) || id }))
    }
    if (Array.isArray(d.roles) && d.roles.length) {
      enrichedDetails.roles = d.roles.map(r => ({ raw: r, name: roleMapById.get(String(r))?.name || roleMapBySlug.get(String(r)) || r }))
    }
    if (d.roles_assigned) {
      enrichedDetails.roles_assigned = d.roles_assigned
    }
    if (d.roles_removed) {
      enrichedDetails.roles_removed = d.roles_removed
    }
    if (d.userId) {
      enrichedDetails.user = { id: d.userId, name: userMap.get(String(d.userId)) || d.userId }
    }
    if (Object.keys(enrichedDetails).length === 0) {
      enrichedDetails.raw = d
    }
    e.details_enriched = enrichedDetails
    return e
  })

  res.json({ success: true, data: enriched, total, page, perPage })
})

module.exports = router
