const User = require('../models/user')

module.exports = async function auth(req, res, next) {
  try {
    if (!req.session || !req.session.userId) return res.status(401).json({ success: false, message: 'Not authenticated' })
    const user = await User.findById(req.session.userId).lean()
    if (!user) return res.status(401).json({ success: false, message: 'Invalid session user' })
    req.user = user
    next()
  } catch (err) {
    next(err)
  }
}
