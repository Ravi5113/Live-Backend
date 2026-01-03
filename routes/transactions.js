const express = require('express')
const router = express.Router()
const Transaction = require('../models/transaction')
const Wallet = require('../models/wallet')

router.get('/', async (req, res) => {
  const list = await Transaction.find().sort({ createdAt: -1 }).limit(100).lean()
  res.json({ success: true, data: list })
})

const auth = require('../middleware/auth')
const admin = require('../middleware/admin')

router.post('/', auth, admin, async (req, res) => {
  const { userId, amount, type, description } = req.body
  if (!userId || typeof amount !== 'number' || !type) return res.status(400).json({ success: false, message: 'Invalid payload' })

  const tx = await Transaction.create({ userId, amount, type, description })
  // update wallet
  const wallet = await Wallet.findOneAndUpdate({ userId }, { $inc: { balance: type === 'credit' ? amount : -amount }, $set: { updatedAt: new Date() } }, { upsert: true, new: true })
  res.json({ success: true, data: { tx, wallet } })
})

module.exports = router
