const express = require('express')
const router = express.Router()
const User = require('../models/user')
const bcrypt = require('bcrypt')

router.post('/login', async (req, res) => {
  try {
    console.log('🔐 Login attempt received')
    console.log('   Origin:', req.headers.origin)
    console.log('   Body:', { email: req.body?.email, hasPassword: !!req.body?.password })
    
    const { email, password } = req.body
    
    if (!email || !password) {
      console.log('❌ Missing email or password')
      return res.status(400).json({ success: false, message: 'Email and password required' })
    }
    
    console.log(`🔍 Looking for user: ${email}`)
    const user = await User.findOne({ email }).lean()
    
    if (!user) {
      console.log('❌ User not found:', email)
      return res.status(401).json({ success: false, message: 'Invalid credentials' })
    }
    
    console.log('✅ User found:', user.email)
    console.log('   Name:', user.name)
    console.log('   Role:', user.role)
    
    // Support both 'password' and 'passwordHash' fields for compatibility
    const userPassword = user.password || user.passwordHash
    console.log('   Has password field:', !!userPassword)
    console.log('   Using field:', user.password ? 'password' : 'passwordHash')
    
    if (!userPassword) {
      console.log('❌ User has no password field')
      return res.status(401).json({ success: false, message: 'User has no password set' })
    }
    
    console.log('🔐 Comparing password...')
    const ok = await bcrypt.compare(password, userPassword)
    
    if (!ok) {
      console.log('❌ Password mismatch')
      return res.status(401).json({ success: false, message: 'Invalid credentials' })
    }
    
    console.log('✅ Password matches! Creating session...')
    req.session.userId = user._id
    console.log('✅ Login successful for:', user.email)
    console.log('   Session ID:', req.sessionID)
    
    res.json({ success: true, data: { id: user._id, email: user.email, name: user.name, role: user.role } })
  } catch (error) {
    console.error('❌ Login error:', error)
    console.error('   Stack:', error.stack)
    res.status(500).json({ success: false, message: 'Internal server error', error: error.message })
  }
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
