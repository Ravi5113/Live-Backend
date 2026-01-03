#!/usr/bin/env node

/**
 * Seed script to generate sample completed rides for December 2025
 * Usage: node seed-rides.js
 */

const mongoose = require('mongoose')
const path = require('path')

// Import models
const modelsPath = path.join(__dirname, 'models')
const Ride = require(path.join(modelsPath, 'ride'))
const User = require(path.join(modelsPath, 'user'))

// Connection string
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/taxi_app'

// Sample ride data
const locations = [
  { name: 'Airport Terminal 1', address: 'IGI Airport, Delhi' },
  { name: 'South Delhi Market', address: 'South Delhi, Delhi' },
  { name: 'Connaught Place', address: 'Connaught Place, Delhi' },
  { name: 'Gurugram Cyber Hub', address: 'Cyber Hub, Gurugram' },
  { name: 'Noida City Center', address: 'City Center, Noida' },
  { name: 'Greater Noida', address: 'Greater Noida, Noida' },
  { name: 'Delhi Metro Station', address: 'Kasturba Nagar, Delhi' },
  { name: 'Sector 62 Mall', address: 'Sector 62, Noida' },
  { name: 'DLF Mall of India', address: 'Sector 18, Noida' },
  { name: 'Khan Market', address: 'Khan Market, Delhi' },
  { name: 'Lajpat Nagar', address: 'Lajpat Nagar, Delhi' },
  { name: 'Rajouri Garden', address: 'Rajouri Garden, Delhi' },
  { name: 'Dwarka', address: 'Dwarka, Delhi' },
  { name: 'Rohini', address: 'Rohini, Delhi' },
  { name: 'Aerocity', address: 'Aerocity, Delhi' }
]

const driverNames = [
  'Ramesh Kumar', 'Suresh Singh', 'Akshay Sharma', 'Vinod Patel', 'Mahesh Verma',
  'Rajesh Kumar', 'Kiran Desai', 'Arjun Nair', 'Pradeep Gupta', 'Sanjay Reddy',
  'Anil Kumar', 'Vishal Sharma', 'Rohan Singh', 'Harish Kumar', 'Deepak Sharma'
]

const passengerNames = [
  'Anjali Sharma', 'Priya Singh', 'Neha Patel', 'Kavya Gupta', 'Sneha Verma',
  'Isha Desai', 'Ritika Kumar', 'Pooja Nair', 'Divya Reddy', 'Geeta Sharma',
  'Aditi Singh', 'Bhavna Patel', 'Chaya Gupta', 'Dimple Kumar', 'Ekta Sharma',
  'Fiona Singh', 'Gita Verma', 'Harsh Patel', 'Ishan Kumar', 'Jaya Sharma'
]

const fareRanges = [
  { min: 150, max: 350 },    // Short distance
  { min: 350, max: 800 },    // Medium distance
  { min: 800, max: 1500 },   // Long distance
  { min: 1500, max: 3000 }   // Very long distance
]

/**
 * Generate random number within range
 */
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

/**
 * Generate random element from array
 */
function randomElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

/**
 * Generate random date in December 2025
 */
function randomDateInDecember2025() {
  const day = randomInt(1, 16) // Dec 1-16 (current month so far)
  const hour = randomInt(7, 23) // 7 AM to 11 PM
  const minute = randomInt(0, 59)
  const second = randomInt(0, 59)
  
  const date = new Date(2025, 11, day, hour, minute, second)
  return date
}

/**
 * Connect to MongoDB
 */
async function connectDB() {
  try {
    await mongoose.connect(MONGO_URI)
    console.log('✓ Connected to MongoDB')
  } catch (error) {
    console.error('✗ MongoDB connection failed:', error.message)
    process.exit(1)
  }
}

/**
 * Disconnect from MongoDB
 */
async function disconnectDB() {
  try {
    await mongoose.disconnect()
    console.log('✓ Disconnected from MongoDB')
  } catch (error) {
    console.error('✗ Disconnect failed:', error.message)
  }
}

/**
 * Get or create sample users (drivers and passengers)
 */
async function ensureUsersExist() {
  console.log('\n→ Ensuring sample users exist...')
  
  try {
    // Create driver users
    for (const name of driverNames.slice(0, 8)) {
      const email = `driver_${name.toLowerCase().replace(/\s+/g, '_')}@taxi.com`
      const existing = await User.findOne({ email })
      
      if (!existing) {
        const user = new User({
          name,
          email,
          phone: `+91${randomInt(9000000000, 9999999999)}`,
          role: 'driver',
          isActive: true
        })
        await user.save()
        console.log(`  ✓ Created driver user: ${name}`)
      }
    }
    
    // Create passenger users
    for (const name of passengerNames.slice(0, 12)) {
      const email = `passenger_${name.toLowerCase().replace(/\s+/g, '_')}@taxi.com`
      const existing = await User.findOne({ email })
      
      if (!existing) {
        const user = new User({
          name,
          email,
          phone: `+91${randomInt(9000000000, 9999999999)}`,
          role: 'user',
          isActive: true
        })
        await user.save()
        console.log(`  ✓ Created passenger user: ${name}`)
      }
    }
    
    console.log('✓ All sample users ready')
  } catch (error) {
    console.error('✗ User creation failed:', error.message)
    throw error
  }
}

/**
 * Get all existing users for ride creation
 */
async function getUserIds() {
  try {
    const drivers = await User.find({ role: 'driver' }).limit(8)
    const passengers = await User.find({ role: 'user' }).limit(12)
    
    if (drivers.length === 0 || passengers.length === 0) {
      throw new Error('Insufficient users found in database')
    }
    
    return {
      driverIds: drivers.map(d => d._id),
      passengerIds: passengers.map(p => p._id)
    }
  } catch (error) {
    console.error('✗ Failed to fetch user IDs:', error.message)
    throw error
  }
}

/**
 * Generate sample rides
 */
async function generateSampleRides() {
  console.log('\n→ Generating sample rides for December 2025...')
  
  try {
    const { driverIds, passengerIds } = await getUserIds()
    
    const ridesCount = 80 // Generate 80 sample rides
    const rides = []
    
    for (let i = 0; i < ridesCount; i++) {
      const pickup = randomElement(locations)
      const drop = randomElement(locations.filter(l => l !== pickup))
      const fareRange = randomElement(fareRanges)
      const fare = randomInt(fareRange.min, fareRange.max)
      
      const ride = new Ride({
        driverId: randomElement(driverIds),
        userId: randomElement(passengerIds),
        pickup: {
          address: pickup.address,
          lat: randomInt(28000, 29000) / 1000,
          lng: randomInt(76000, 78000) / 1000
        },
        drop: {
          address: drop.address,
          lat: randomInt(28000, 29000) / 1000,
          lng: randomInt(76000, 78000) / 1000
        },
        fare: fare,
        distance: randomInt(2, 50),
        duration: randomInt(10, 120),
        status: 'completed',
        rating: randomInt(4, 5),
        createdAt: randomDateInDecember2025(),
        updatedAt: new Date()
      })
      
      rides.push(ride)
    }
    
    // Insert all rides at once
    const insertedRides = await Ride.insertMany(rides)
    console.log(`✓ Generated and inserted ${insertedRides.length} sample rides`)
    
    // Print summary
    console.log('\n📊 Ride Summary:')
    const totalFare = insertedRides.reduce((sum, r) => sum + r.fare, 0)
    const avgFare = Math.round(totalFare / insertedRides.length)
    const commission = Math.round(totalFare * 0.2)
    const payouts = Math.round(totalFare * 0.75)
    const taxes = Math.round(totalFare * 0.05)
    
    console.log(`  Total Rides: ${insertedRides.length}`)
    console.log(`  Total GBV: ₹${totalFare.toLocaleString('en-IN')}`)
    console.log(`  Average Fare: ₹${avgFare.toLocaleString('en-IN')}`)
    console.log(`  Platform Commission (20%): ₹${commission.toLocaleString('en-IN')}`)
    console.log(`  Driver Payouts (75%): ₹${payouts.toLocaleString('en-IN')}`)
    console.log(`  Taxes & Fees (5%): ₹${taxes.toLocaleString('en-IN')}`)
    
  } catch (error) {
    console.error('✗ Ride generation failed:', error.message)
    throw error
  }
}

/**
 * Main seed function
 */
async function main() {
  console.log('\n🌱 Starting ride seed process...\n')
  console.log(`MongoDB URI: ${MONGO_URI}\n`)
  
  try {
    await connectDB()
    await ensureUsersExist()
    await generateSampleRides()
    
    console.log('\n✅ Seed completed successfully!\n')
  } catch (error) {
    console.error('\n❌ Seed failed:', error.message)
    console.error(error)
    process.exit(1)
  } finally {
    await disconnectDB()
  }
}

// Run seed
main()
