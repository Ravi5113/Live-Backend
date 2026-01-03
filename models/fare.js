const mongoose = require('mongoose')

const FareSchema = new mongoose.Schema({
  rideId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ride' },
  name: String,
  base: Number,
  perKm: Number,
  perMin: Number,
  isActive: { type: Boolean, default: true },
  effectiveFrom: { type: Date, default: Date.now },
  baseCharge: Number,
  perKmCharge: Number,
  perMinCharge: Number,
  distanceCharge: Number,
  durationCharge: Number,
  totalCharge: Number,
  surgePrice: { type: Number, default: 1 },
  discount: { type: Number, default: 0 },
  finalAmount: Number,
  createdAt: { type: Date, default: Date.now }
})

module.exports = mongoose.model('Fare', FareSchema)
