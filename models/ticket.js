const mongoose = require('mongoose')
const Schema = mongoose.Schema

const AttachmentSchema = new Schema({
  url: String,
  filename: String,
  mimetype: String,
  size: Number
}, { _id: false })

const NoteSchema = new Schema({
  authorId: { type: Schema.Types.ObjectId, ref: 'User' },
  body: String,
  internal: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
}, { _id: false })

const TicketSchema = new Schema({
  title: { type: String, required: true },
  description: { type: String },
  category: { type: String, enum: ['payment','ride','app','other'], default: 'other' },
  status: { type: String, enum: ['open','pending','resolved','closed'], default: 'open' },
  priority: { type: String, enum: ['low','medium','high','urgent'], default: 'medium' },
  reporterId: { type: Schema.Types.ObjectId, ref: 'User' },
  assigneeId: { type: Schema.Types.ObjectId, ref: 'User' },
  attachments: [AttachmentSchema],
  notes: [NoteSchema],
  firstResponseAt: Date,
  resolvedAt: Date
}, { timestamps: true })

TicketSchema.methods.toPublic = function(){
  const obj = this.toObject({ virtuals: false })
  // compute SLA fields
  obj.timeToFirstResponse = obj.firstResponseAt ? (new Date(obj.firstResponseAt) - new Date(obj.createdAt)) : null
  obj.timeToResolution = obj.resolvedAt ? (new Date(obj.resolvedAt) - new Date(obj.createdAt)) : null
  return obj
}

module.exports = mongoose.model('Ticket', TicketSchema)
