const mongoose = require('mongoose')

const PermissionSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  slug: { type: String, unique: true },
  description: { type: String },
  // action granularity: view, edit, delete, export, etc.
  actions: { type: [String], default: ['view','edit','delete','export'] },
  createdAt: { type: Date, default: Date.now }
})

module.exports = mongoose.model('Permission', PermissionSchema)
