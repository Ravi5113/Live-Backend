const express = require('express')
const router = express.Router()
const Wallet = require('../models/wallet')

router.get('/:userId', async (req, res) => {
  const w = await Wallet.findOne({ userId: req.params.userId }).lean()
  res.json({ success: true, data: w || { balance: 0 } })
})

module.exports = router
