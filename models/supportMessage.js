const mongoose = require('mongoose')

const SupportMessageSchema = new mongoose.Schema({
  ticketId: { type: mongoose.Schema.Types.ObjectId, ref: 'SupportTicket' },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  senderRole: { type: String, enum: ['user','admin'], default: 'user' },
  message: String,
  createdAt: { type: Date, default: Date.now }
})

module.exports = mongoose.model('SupportMessage', SupportMessageSchema)
