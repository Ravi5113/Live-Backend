const mongoose = require('mongoose')

const SupportTicketSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  category: String,
  title: String,
  description: String,
  status: { type: String, enum: ['open','in_progress','resolved','closed'], default: 'open' },
  assigneeId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  resolvedAt: { type: Date, default: null },
  priority: { type: String, enum: ['low','medium','high'], default: 'low' },
  createdAt: { type: Date, default: Date.now }
})

module.exports = mongoose.model('SupportTicket', SupportTicketSchema)
