#!/usr/bin/env node
// Migration: populate `roles` array on users from legacy `role` string field
// Usage: node migrate_roles_array.js [--dry-run]

const mongoose = require('mongoose')
const User = require('../models/user')

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/taxi_app'
const dryRun = process.argv.includes('--dry-run')

async function run(){
  await mongoose.connect(MONGO_URI, { autoIndex: false })
  console.log('Connected to', MONGO_URI)
  const users = await User.find({}).select('role roles email name').lean()
  let changed = 0
  for(const u of users){
    const hasArray = Array.isArray(u.roles) && u.roles.length>0
    const legacy = u.role
    if(!hasArray && legacy){
      changed++
      console.log(`Will set roles for ${u.email || u.name || u._id}: ["${legacy}"]`)
      if(!dryRun){
        await User.updateOne({ _id: u._id }, { $set: { roles: [legacy] } })
      }
    }
  }
  console.log(`Total users processed: ${users.length}. To-change: ${changed}. dryRun=${dryRun}`)
  await mongoose.disconnect()
}

run().catch(err=>{ console.error(err); process.exit(1) })
