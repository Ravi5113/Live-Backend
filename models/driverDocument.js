const mongoose = require('mongoose')

const DriverDocumentSchema = new mongoose.Schema({
  driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  type: String,
  docType: String, // aadhar, license, insurance, registration, pollution
  docNumber: String,
  url: String,
  fileUrl: String,
  status: { type: String, enum: ['pending','approved','rejected'], default: 'pending' },
  kyc_status: { type: String, enum: ['pending', 'approved', 'rejected', 'expiring_soon'], default: 'pending' },
  expiryDate: Date,
  notes: String,
  createdAt: { type: Date, default: Date.now }
})

module.exports = mongoose.model('DriverDocument', DriverDocumentSchema)
