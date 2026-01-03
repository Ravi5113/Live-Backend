const mongoose = require('mongoose')

const WalletSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', unique: true },
  balance: { type: Number, default: 0 },
  currency: { type: String, default: 'INR' },
  updatedAt: { type: Date, default: Date.now }
})

module.exports = mongoose.model('Wallet', WalletSchema)
