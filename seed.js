/**
 * Database seeder for Taxi App
 * Populates MongoDB with Indian sample data for all tables
 * Run with: node seed.js
 */

const mongoose = require('mongoose')
const bcrypt = require('bcrypt')

// Models
const User = require('./models/user')
const Ride = require('./models/ride')
const Fare = require('./models/fare')
const Transaction = require('./models/transaction')
const Wallet = require('./models/wallet')
const DriverDocument = require('./models/driverDocument')
const DriverPayout = require('./models/driverPayout')
const SupportTicket = require('./models/supportTicket')
const SupportMessage = require('./models/supportMessage')
const Role = require('./models/role')
const Permission = require('./models/permission')

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/taxi_app'

// Indian names
const passengerFirstNames = [
  'Rajesh', 'Priya', 'Amit', 'Neha', 'Arun', 'Sneha', 'Vikas', 'Pooja',
  'Sanjay', 'Deepika', 'Arjun', 'Ananya', 'Rohit', 'Divya', 'Akshay', 'Shreya'
]

const passengerLastNames = [
  'Kumar', 'Singh', 'Patel', 'Sharma', 'Gupta', 'Verma', 'Reddy', 'Nair',
  'Desai', 'Rao', 'Bhat', 'Joshi', 'Iyer', 'Menon', 'Das', 'Chatterjee'
]

const driverFirstNames = [
  'Suresh', 'Ramesh', 'Ganesh', 'Harish', 'Mahesh', 'Naresh', 'Rajesh', 'Yogesh',
  'Vikram', 'Sachin', 'Manish', 'Ashok', 'Ravi', 'Mohan', 'Prakash', 'Sandeep'
]

const driverLastNames = [
  'Kumar', 'Singh', 'Reddy', 'Sharma', 'Patel', 'Rao', 'Nair', 'Verma',
  'Bhat', 'Gupta', 'Desai', 'Joshi', 'Menon', 'Das', 'Iyer', 'Chatterjee'
]

// Indian cities and locations
const cities = [
  { name: 'Delhi', code: 'DL' },
  { name: 'Mumbai', code: 'MH' },
  { name: 'Bangalore', code: 'KA' },
  { name: 'Pune', code: 'MH' },
  { name: 'Hyderabad', code: 'TG' }
]

const locations = {
  'Delhi': [
    { name: 'Ashram Road', lat: 28.5673, lng: 77.2441 },
    { name: 'Connaught Place', lat: 28.6309, lng: 77.1856 },
    { name: 'Saket', lat: 28.5244, lng: 77.1960 },
    { name: 'Karol Bagh', lat: 28.6462, lng: 77.1833 },
    { name: 'Noida City Centre', lat: 28.5861, lng: 77.3514 }
  ],
  'Mumbai': [
    { name: 'Bandra', lat: 19.0596, lng: 72.8295 },
    { name: 'Worli', lat: 19.0176, lng: 72.8194 },
    { name: 'Andheri', lat: 19.1136, lng: 72.8697 },
    { name: 'Colaba', lat: 18.9676, lng: 72.8194 },
    { name: 'Dadar', lat: 19.0176, lng: 72.8442 }
  ],
  'Bangalore': [
    { name: 'Koramangala', lat: 12.9352, lng: 77.6245 },
    { name: 'Indiranagar', lat: 12.9716, lng: 77.6412 },
    { name: 'Whitefield', lat: 12.9698, lng: 77.7499 },
    { name: 'MG Road', lat: 12.9352, lng: 77.6009 },
    { name: 'Electronic City', lat: 12.8395, lng: 77.6770 }
  ],
  'Pune': [
    { name: 'Kalyani Nagar', lat: 18.5601, lng: 73.8997 },
    { name: 'Baner', lat: 18.5596, lng: 73.8007 },
    { name: 'Hinjewadi', lat: 18.5912, lng: 73.7618 },
    { name: 'Kondhwa', lat: 18.4789, lng: 73.8197 },
    { name: 'Camp', lat: 18.5204, lng: 73.8567 }
  ],
  'Hyderabad': [
    { name: 'HITEC City', lat: 17.3850, lng: 78.4867 },
    { name: 'Banjara Hills', lat: 17.3850, lng: 78.4409 },
    { name: 'Gachibowli', lat: 17.4400, lng: 78.4463 },
    { name: 'Madhapur', lat: 17.3631, lng: 78.3796 },
    { name: 'Jubilee Hills', lat: 17.3719, lng: 78.4031 }
  ]
}

const vehicleTypes = ['Sedan', 'SUV', 'Auto', 'Premium']
const vehiclePlates = []

// Generate random phone number (Indian format)
function generatePhone() {
  return '9' + Math.floor(Math.random() * 900000000 + 100000000)
}

// Generate vehicle plate
function generatePlate() {
  const states = ['DL', 'MH', 'KA', 'TG', 'AP', 'GJ', 'RJ', 'UP']
  const state = states[Math.floor(Math.random() * states.length)]
  const numbers = Math.floor(Math.random() * 9000) + 1000
  const letters = String.fromCharCode(65 + Math.random() * 26) + String.fromCharCode(65 + Math.random() * 26)
  return `${state}-${numbers}-${letters}`
}

// Hash password
async function hashPassword(pwd) {
  return bcrypt.hash(pwd, 10)
}

// Get random item from array
function getRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

// Seed function
async function seed() {
  try {
    await mongoose.connect(MONGO_URI, { autoIndex: true })
    console.log('✓ Connected to MongoDB')

    // Clear existing data
    await Promise.all([
      User.deleteMany({}),
      Ride.deleteMany({}),
      Fare.deleteMany({}),
      Transaction.deleteMany({}),
      Wallet.deleteMany({}),
      DriverDocument.deleteMany({}),
      DriverPayout.deleteMany({}),
      SupportTicket.deleteMany({}),
      SupportMessage.deleteMany({}),
      Role.deleteMany({}),
      Permission.deleteMany({})
    ])
    console.log('✓ Cleared existing data')

    // Create admin user
    const adminHash = await hashPassword('admin123')
    const admin = await User.create({
      name: 'Admin User',
      email: 'admin@taxiapp.com',
      passwordHash: adminHash,
      role: 'admin',
      phone: '9876543210',
      createdAt: new Date()
    })
    console.log('✓ Created admin user')

    // Create 15 passenger users
    const passengers = []
    for (let i = 0; i < 15; i++) {
      const firstName = getRandom(passengerFirstNames)
      const lastName = getRandom(passengerLastNames)
      const name = `${firstName} ${lastName}`
      const email = `passenger${i + 1}@taxiapp.com`
      const hash = await hashPassword('password123')
      const user = await User.create({
        name,
        email,
        passwordHash: hash,
        role: 'passenger',
        phone: generatePhone(),
        city: getRandom(cities).name,
        createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000)
      })
      passengers.push(user)
    }
    console.log(`✓ Created ${passengers.length} passenger users`)

    // Create 20 driver users
    const drivers = []
    const driverWallets = []
    for (let i = 0; i < 20; i++) {
      const firstName = getRandom(driverFirstNames)
      const lastName = getRandom(driverLastNames)
      const name = `${firstName} ${lastName}`
      const email = `driver${i + 1}@taxiapp.com`
      const hash = await hashPassword('password123')
      const city = getRandom(cities)
      const driver = await User.create({
        name,
        email,
        passwordHash: hash,
        role: 'driver',
        phone: generatePhone(),
        city: city.name,
        is_online: Math.random() > 0.3,
        is_suspended: Math.random() > 0.9,
        createdAt: new Date(Date.now() - Math.random() * 60 * 24 * 60 * 60 * 1000)
      })
      drivers.push(driver)

      // Create wallet for driver
      const wallet = await Wallet.create({
        userId: driver._id,
        balance: Math.floor(Math.random() * 50000) + 5000,
        createdAt: new Date()
      })
      driverWallets.push(wallet)
    }
    console.log(`✓ Created ${drivers.length} driver users and wallets`)

    // Create driver documents
    const kycStatuses = ['pending', 'approved', 'rejected', 'expiring_soon']
    for (const driver of drivers) {
      const docCount = Math.floor(Math.random() * 3) + 1
      for (let i = 0; i < docCount; i++) {
        const docTypes = ['aadhar', 'license', 'insurance', 'registration', 'pollution']
        await DriverDocument.create({
          driverId: driver._id,
          docType: getRandom(docTypes),
          docNumber: `DOC${Math.floor(Math.random() * 1000000)}`,
          kyc_status: getRandom(kycStatuses),
          expiryDate: new Date(Date.now() + Math.random() * 365 * 24 * 60 * 60 * 1000),
          fileUrl: `https://via.placeholder.com/400?text=${docTypes[i]}`,
          createdAt: new Date()
        })
      }
    }
    console.log('✓ Created driver documents')

    // Create vehicles (for drivers)
    const vehicleModels = ['Maruti Swift', 'Toyota Innova', 'Honda City', 'Hyundai i20', 'Tata Nexon', 'Mahindra XUV500']
    for (const driver of drivers) {
      const user = await User.findById(driver._id)
      if (!user.vehicle) {
        const plate = generatePlate()
        user.vehicle = {
          type: getRandom(vehicleTypes),
          model: getRandom(vehicleModels),
          plate: plate,
          color: getRandom(['White', 'Black', 'Silver', 'Gray', 'Red', 'Blue']),
          registrationNumber: plate,
          insurance_valid_till: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
        }
        await user.save()
      }
    }
    console.log('✓ Created vehicles for drivers')

    // Create rides
    const rides = []
    const statuses = ['completed', 'cancelled', 'in_progress', 'requested']
    for (let i = 0; i < 50; i++) {
      const passenger = getRandom(passengers)
      const driver = getRandom(drivers)
      const cityName = passenger.city
      const cityLocs = locations[cityName] || locations['Delhi']
      const pickupLoc = getRandom(cityLocs)
      const dropLoc = getRandom(cityLocs)
      const fare = Math.floor(Math.random() * 600) + 100

      const ride = await Ride.create({
        userId: passenger._id,
        driverId: driver._id,
        status: getRandom(statuses),
        pickup: {
          location: pickupLoc.name,
          lat: pickupLoc.lat,
          lng: pickupLoc.lng,
          address: `${pickupLoc.name}, ${cityName}`
        },
        drop: {
          location: dropLoc.name,
          lat: dropLoc.lat,
          lng: dropLoc.lng,
          address: `${dropLoc.name}, ${cityName}`
        },
        fare: fare,
        distance: Math.floor(Math.random() * 30) + 2,
        duration: Math.floor(Math.random() * 60) + 5,
        rating: Math.random() > 0.2 ? Math.floor(Math.random() * 5) + 1 : null,
        createdAt: new Date(Date.now() - Math.random() * 15 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(Date.now() - Math.random() * 14 * 24 * 60 * 60 * 1000)
      })
      rides.push(ride)
    }
    console.log(`✓ Created ${rides.length} rides`)

    // Create fares
    const fares = []
    for (const ride of rides) {
      const fare = await Fare.create({
        rideId: ride._id,
        baseCharge: 50,
        perKmCharge: 8,
        perMinCharge: 2,
        distanceCharge: (ride.distance || 10) * 8,
        durationCharge: (ride.duration || 10) * 2,
        totalCharge: ride.fare,
        surgePrice: Math.random() > 0.8 ? 1.5 : 1,
        discount: Math.random() > 0.7 ? Math.floor(Math.random() * 100) + 10 : 0,
        finalAmount: ride.fare,
        createdAt: ride.createdAt
      })
      fares.push(fare)
    }
    console.log(`✓ Created ${fares.length} fares (ride-level)`)

    // Create transactions
    const transactions = []
    for (const ride of rides.slice(0, 30)) {
      const transactionTypes = ['payment', 'refund', 'payout', 'wallet_topup']
      const trans = await Transaction.create({
        userId: ride.userId,
        rideId: ride._id,
        type: getRandom(transactionTypes),
        amount: ride.fare,
        paymentMethod: getRandom(['card', 'wallet', 'upi', 'cash']),
        status: getRandom(['completed', 'pending', 'failed']),
        reference: `TXN${Math.floor(Math.random() * 1000000)}`,
        createdAt: ride.createdAt
      })
      transactions.push(trans)
    }
    console.log(`✓ Created ${transactions.length} transactions`)

    // Create driver payouts
    const payouts = []
    for (const driver of drivers.slice(0, 15)) {
      const payout = await DriverPayout.create({
        driverId: driver._id,
        amount: Math.floor(Math.random() * 5000) + 1000,
        period: `${new Date().getMonth() + 1}/${new Date().getFullYear()}`,
        status: getRandom(['pending', 'approved', 'processed', 'failed']),
        bankAccount: {
          accountNumber: `2${Math.floor(Math.random() * 9999999999999999)}`,
          ifscCode: getRandom(['HDFC0000123', 'ICIC0000124', 'SBIN0000125', 'AXIS0000126']),
          accountHolder: driver.name
        },
        createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000)
      })
      payouts.push(payout)
    }
    console.log(`✓ Created ${payouts.length} driver payouts`)

    // Seed permissions & roles for admin settings
    const basePermissions = [
      { name: 'manage_fares', slug: 'manage_fares', description: 'Create, update, delete fares' },
      { name: 'manage_rides', slug: 'manage_rides', description: 'View and manage rides' },
      { name: 'manage_users', slug: 'manage_users', description: 'Manage passengers and drivers' },
      { name: 'view_reports', slug: 'view_reports', description: 'View admin reports and analytics' },
      { name: 'manage_support', slug: 'manage_support', description: 'Handle support tickets' },
      { name: 'manage_payouts', slug: 'manage_payouts', description: 'Approve and process payouts' },
      { name: 'manage_documents', slug: 'manage_documents', description: 'Review driver documents/KYC' },
      { name: 'manage_roles', slug: 'manage_roles', description: 'Create, edit, delete roles' },
      { name: 'manage_permissions', slug: 'manage_permissions', description: 'Create and assign permissions' }
    ]
    const perms = await Permission.insertMany(basePermissions)
    const permIds = perms.map(p => p._id)
    console.log(`✓ Seeded ${perms.length} permissions`)

    // Create roles and assign permissions to admin
    const adminRole = await Role.create({ name: 'Admin', slug: 'admin', description: 'Full access', permissions: permIds })
    const driverRole = await Role.create({ name: 'Driver', slug: 'driver', description: 'Driver role', permissions: [] })
    const passengerRole = await Role.create({ name: 'Passenger', slug: 'passenger', description: 'Passenger role', permissions: [] })
    console.log('✓ Created roles: Admin, Driver, Passenger')

    // Seed configuration fares for admin management
    const configFares = [
      { name: 'bike', base: 20, perKm: 6, perMin: 1, isActive: true, effectiveFrom: new Date(Date.now() - 7*24*60*60*1000) },
      { name: 'auto', base: 30, perKm: 9, perMin: 1.5, isActive: true, effectiveFrom: new Date(Date.now() - 5*24*60*60*1000) },
      { name: 'car', base: 50, perKm: 12, perMin: 2, isActive: true, effectiveFrom: new Date(Date.now() - 3*24*60*60*1000) },
      { name: 'suv', base: 70, perKm: 15, perMin: 2.5, isActive: false, effectiveFrom: new Date(Date.now() - 2*24*60*60*1000) }
    ]
    const existingConfigs = await Fare.countDocuments({ name: { $exists: true } })
    if (existingConfigs === 0) {
      await Fare.insertMany(configFares)
      console.log(`✓ Seeded ${configFares.length} config fares`)
    } else {
      console.log(`• Config fares exist (${existingConfigs}), skip seeding`)
    }

    // Create support tickets
    const tickets = []
    const ticketCategories = ['ride_issue', 'payment_issue', 'driver_complaint', 'app_bug', 'other']
    const ticketStatuses = ['open', 'in_progress', 'resolved', 'closed']
    for (let i = 0; i < 12; i++) {
      const user = getRandom([...passengers, ...drivers])
      const ticket = await SupportTicket.create({
        userId: user._id,
        category: getRandom(ticketCategories),
        title: getRandom([
          'Driver was rude',
          'Wrong amount charged',
          'Driver went wrong route',
          'App crashed during ride',
          'Payment failed but charged',
          'Driver cancelled after accepting'
        ]),
        description: 'Please resolve this issue as soon as possible',
        status: getRandom(ticketStatuses),
        priority: getRandom(['low', 'medium', 'high']),
        createdAt: new Date(Date.now() - Math.random() * 10 * 24 * 60 * 60 * 1000)
      })
      tickets.push(ticket)
    }
    console.log(`✓ Created ${tickets.length} support tickets`)

    // Create support messages for each ticket
    for (const ticket of tickets) {
      const messageCount = Math.floor(Math.random() * 3) + 1
      for (let i = 0; i < messageCount; i++) {
        await SupportMessage.create({
          ticketId: ticket._id,
          userId: ticket.userId,
          senderRole: i % 2 === 0 ? 'user' : 'admin',
          message: i % 2 === 0 
            ? 'Please help me with this issue'
            : 'We are looking into this. Thank you for your patience.',
          createdAt: new Date(ticket.createdAt.getTime() + i * 24 * 60 * 60 * 1000)
        })
      }
    }
    console.log('✓ Created support messages')

    console.log('\n✅ Database seeding completed successfully!')
    console.log(`
  Summary:
  - 1 admin user
  - 15 passenger users
  - 20 driver users
  - 50 rides
  - 50 fares
  - 30 transactions
  - 15 payouts
  - 12 support tickets
  - 3 roles (admin, driver, passenger)
  - ${perms.length} permissions
  - Multiple driver documents, vehicles, and messages
    `)

    process.exit(0)
  } catch (error) {
    console.error('❌ Seeding error:', error)
    process.exit(1)
  }
}

seed()
