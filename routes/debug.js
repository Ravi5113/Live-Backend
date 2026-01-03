const express = require('express')
const router = express.Router()
const mongoose = require('mongoose')

router.get('/users', async (req, res) => {
  const users = await mongoose.model('User').find().limit(10).lean()
  res.json({ success: true, data: users })
})

module.exports = router
