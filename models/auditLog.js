const mongoose = require('mongoose')

const AuditLogSchema = new mongoose.Schema({
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  actorName: String,
  action: { type: String }, // create_role, update_role, delete_role, assign_permission, etc.
  targetType: String, // Role, Permission, User
  targetId: mongoose.Schema.Types.Mixed,
  details: mongoose.Schema.Types.Mixed,
  ip: String,
  createdAt: { type: Date, default: Date.now }
})

module.exports = mongoose.model('AuditLog', AuditLogSchema)
