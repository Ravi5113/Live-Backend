module.exports = function admin(req, res, next) {
  if (!req.user) return res.status(401).json({ success: false, message: 'Not authenticated' })
  if (req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Admin required' })
  next()
}
