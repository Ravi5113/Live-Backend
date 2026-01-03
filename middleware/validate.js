module.exports = function validate(requiredFields = []) {
  return (req, res, next) => {
    const missing = []
    for (const f of requiredFields) {
      const parts = f.split('.')
      let cur = req.body
      for (const p of parts) {
        if (cur && Object.prototype.hasOwnProperty.call(cur, p)) cur = cur[p]
        else { cur = undefined; break }
      }
      if (cur === undefined) missing.push(f)
    }
    if (missing.length) return res.status(400).json({ success: false, message: 'Missing fields', missing })
    next()
  }
}
