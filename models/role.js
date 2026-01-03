const mongoose = require('mongoose')

const RoleSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  slug: { type: String, required: true, unique: true },
  description: { type: String },
  // legacy: simple list of permission ids
  permissions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Permission' }],
  // permissionActions stores per-permission action grants for this role
  // shape: { '<permissionId>': ['view','edit'] }
  permissionActions: { type: mongoose.Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: Date.now }
})

module.exports = mongoose.model('Role', RoleSchema)
