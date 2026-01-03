const mongoose = require('mongoose')

const DriverPayoutSchema = new mongoose.Schema({
  driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  amount: Number,
  period: String,
  status: { type: String, enum: ['pending','approved','processed','failed'], default: 'pending' },
  bankAccount: {
    accountNumber: String,
    ifscCode: String,
    accountHolder: String
  },
  notes: String,
  createdAt: { type: Date, default: Date.now }
})

module.exports = mongoose.model('DriverPayout', DriverPayoutSchema)
