const mongoose = require('mongoose')

const TransactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  rideId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ride' },
  amount: Number,
  type: { type: String, enum: ['payment','refund','payout','wallet_topup'], required: true },
  paymentMethod: { type: String, enum: ['card','wallet','upi','cash'] },
  status: { type: String, enum: ['completed','pending','failed'], default: 'completed' },
  reference: String,
  description: String,
  meta: mongoose.Schema.Types.Mixed,
  createdAt: { type: Date, default: Date.now }
})

module.exports = mongoose.model('Transaction', TransactionSchema)
