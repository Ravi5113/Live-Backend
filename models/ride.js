const mongoose = require('mongoose')

const RideSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  status: { type: String, default: 'requested' }, // requested, in_progress, completed, cancelled
  pickup: mongoose.Schema.Types.Mixed, // { location, lat, lng, address }
  drop: mongoose.Schema.Types.Mixed, // { location, lat, lng, address }
  fare: Number,
  distance: Number,
  duration: Number,
  rating: Number,
  destination: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
})

module.exports = mongoose.model('Ride', RideSchema)
