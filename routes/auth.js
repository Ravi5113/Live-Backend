const express = require('express')
const router = express.Router()
const User = require('../models/user')
const bcrypt = require('bcrypt')

router.post('/login', async (req, res) => {
  const { email, password } = req.body
  const user = await User.findOne({ email }).lean()
  if (!user) return res.status(401).json({ success: false, message: 'Invalid credentials' })
  const ok = await bcrypt.compare(password, user.passwordHash)
  if (!ok) return res.status(401).json({ success: false, message: 'Invalid credentials' })
  req.session.userId = user._id
  res.json({ success: true, data: { id: user._id, email: user.email, name: user.name, role: user.role } })
})

router.post('/logout', (req, res) => {
  req.session.destroy(err => {
    res.clearCookie('taxi_session')
    res.json({ success: true })
  })
})

router.get('/profile', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ success: false })
  const user = await User.findById(req.session.userId).lean()
  res.json({ success: true, data: user })
})

module.exports = router
