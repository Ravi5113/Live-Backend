const mongoose = require('mongoose')

const PayoutMethodSchema = new mongoose.Schema({
  driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  type: { type: String, enum: ['bank','upi','paypal'], required: true },
  label: String,
  details: mongoose.Schema.Types.Mixed, // store account/upi/paypal info (consider encrypting)
  verified: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
})

module.exports = mongoose.model('PayoutMethod', PayoutMethodSchema)
