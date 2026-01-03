const express = require('express')
const router = express.Router()

router.get('/', (req, res) => {
  res.json({ success: true, data: { uptime: process.uptime() } })
})

router.get('/performance', (req, res) => {
  res.json({ success: true, data: { memory: process.memoryUsage() } })
})

module.exports = router
