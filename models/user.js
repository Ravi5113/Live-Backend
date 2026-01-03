const mongoose = require('mongoose')

const UserSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true, required: true },
  password: String, // Primary password field
  passwordHash: String, // Legacy field for backward compatibility
  // `roles` supports multiple role slugs (RBAC). Keep `role` for backwards compatibility.
  role: { type: String, default: 'user' }, // legacy single-role
  roles: { type: [String], default: ['user'] },
  phone: String,
  city: String,
  avatar: String,
  is_online: { type: Boolean, default: false },
  is_suspended: { type: Boolean, default: false },
  vehicle: mongoose.Schema.Types.Mixed, // { type, model, plate, color, registrationNumber, insurance_valid_till }
  addresses: [{ 
    label: String,
    address: String,
    city: String,
    state: String,
    postalCode: String,
    country: String,
    lat: Number,
    lng: Number,
    instructions: String
  }],
  paymentMethods: [{
    type: String,
    cardNumber: String,
    cardHolder: String,
    expiryMonth: String,
    expiryYear: String,
    upiId: String,
    walletType: String,
    walletPhone: String,
    isDefault: Boolean
  }],
    metadata: mongoose.Schema.Types.Mixed, // For registration tracking and other flexible data
  legacyId: mongoose.Schema.Types.Mixed,
  createdAt: { type: Date, default: Date.now }
})

module.exports = mongoose.model('User', UserSchema)
