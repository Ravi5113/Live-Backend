const express = require('express')
const router = express.Router()
const bcrypt = require('bcrypt')
const User = require('../models/user')
const DriverDocument = require('../models/driverDocument')

// Step 1: Create driver account with personal info
router.post('/register/personal', async (req, res) => {
  try {
    const { fullName, email, dateOfBirth, homeAddress, password, phone } = req.body
    
    // Validation
    if (!fullName || !email || !dateOfBirth || !homeAddress || !password || !phone) {
      return res.status(400).json({ success: false, message: 'All fields are required' })
    }
    
    // Check age (must be 21+)
    const dob = new Date(dateOfBirth)
    const age = Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    if (age < 21) {
      return res.status(400).json({ success: false, message: 'You must be at least 21 years old to drive' })
    }
    
    // Check if email already exists
    const existing = await User.findOne({ email })
    if (existing) {
      return res.status(400).json({ success: false, message: 'Email already registered' })
    }
    
    // Hash password
    const passwordHash = await bcrypt.hash(password, 10)
    
    // Create driver user (pending verification)
    const driver = await User.create({
      name: fullName,
      email,
      passwordHash,
      phone,
      role: 'driver',
      is_suspended: true, // Suspended until verified
      addresses: [{
        label: 'Home',
        address: homeAddress,
        country: 'India'
      }],
      createdAt: new Date(),
      metadata: {
        dateOfBirth: dob,
        registrationStep: 1,
        registrationStatus: 'personal_info_completed'
      }
    })
    
    res.json({ 
      success: true, 
      message: 'Step 1 completed',
      data: { 
        driverId: driver._id,
        step: 1
      }
    })
  } catch (e) {
    console.error('Registration step 1 failed:', e)
    res.status(500).json({ success: false, message: e.message || 'Registration failed' })
  }
})

// Step 2: Update vehicle information
router.post('/register/vehicle', async (req, res) => {
  try {
    const { driverId, vehicleType, makeModel, licensePlate, yearOfManufacture, vehicleColor, vehiclePhotos } = req.body
    
    if (!driverId || !vehicleType || !makeModel || !licensePlate || !yearOfManufacture || !vehicleColor) {
      return res.status(400).json({ success: false, message: 'All vehicle fields are required' })
    }
    
    // Validate year (must be 2010 or newer)
    if (parseInt(yearOfManufacture) < 2010) {
      return res.status(400).json({ success: false, message: 'Vehicle must be 2010 or newer' })
    }
    
    const driver = await User.findById(driverId)
    if (!driver) {
      return res.status(404).json({ success: false, message: 'Driver not found' })
    }
    
    // Update vehicle info
    driver.vehicle = {
      type: vehicleType,
      model: makeModel,
      plate: licensePlate,
      registrationNumber: licensePlate,
      color: vehicleColor,
      year: parseInt(yearOfManufacture),
      photos: vehiclePhotos || []
    }
    
    driver.metadata = {
      ...driver.metadata,
      registrationStep: 2,
      registrationStatus: 'vehicle_info_completed'
    }
    
    await driver.save()
    
    res.json({ 
      success: true, 
      message: 'Step 2 completed',
      data: { 
        driverId: driver._id,
        step: 2
      }
    })
  } catch (e) {
    console.error('Registration step 2 failed:', e)
    res.status(500).json({ success: false, message: e.message || 'Vehicle registration failed' })
  }
})

// Step 3: Upload documents
router.post('/register/documents', async (req, res) => {
  try {
    const { driverId, documents } = req.body
    // documents should be an array: [{ type: 'license', url: '...', docNumber: '...' }, ...]
    
    if (!driverId || !documents || !Array.isArray(documents) || documents.length === 0) {
      return res.status(400).json({ success: false, message: 'Driver ID and documents are required' })
    }
    
    const driver = await User.findById(driverId)
    if (!driver) {
      return res.status(404).json({ success: false, message: 'Driver not found' })
    }
    
    // Required document types
    const requiredTypes = ['license', 'registration', 'insurance', 'kyc', 'puc', 'police_verification']
    const uploadedTypes = documents.map(d => d.type)
    const missingTypes = requiredTypes.filter(t => !uploadedTypes.includes(t))
    
    if (missingTypes.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: `Missing documents: ${missingTypes.join(', ')}` 
      })
    }
    
    // Save documents
    const savedDocs = []
    for (const doc of documents) {
      const driverDoc = await DriverDocument.create({
        driverId: driver._id,
        docType: doc.type,
        docNumber: doc.docNumber || '',
        url: doc.url,
        fileUrl: doc.url,
        status: 'pending',
        kyc_status: 'pending',
        expiryDate: doc.expiryDate ? new Date(doc.expiryDate) : null
      })
      savedDocs.push(driverDoc)
    }
    
    // Update registration status
    driver.metadata = {
      ...driver.metadata,
      registrationStep: 3,
      registrationStatus: 'documents_submitted',
      submittedAt: new Date()
    }
    await driver.save()
    
    res.json({ 
      success: true, 
      message: 'Documents submitted successfully',
      data: { 
        driverId: driver._id,
        applicationId: `DRV-${new Date().getFullYear()}-${String(driver._id).slice(-6).toUpperCase()}`,
        step: 3,
        documents: savedDocs
      }
    })
  } catch (e) {
    console.error('Document upload failed:', e)
    res.status(500).json({ success: false, message: e.message || 'Document upload failed' })
  }
})

// Get application status
router.get('/application/:driverId', async (req, res) => {
  try {
    const { driverId } = req.params
    
    const driver = await User.findById(driverId).lean()
    if (!driver) {
      return res.status(404).json({ success: false, message: 'Application not found' })
    }
    
    const documents = await DriverDocument.find({ driverId }).lean()
    
    // Determine review progress
    const documentsSubmitted = documents.length >= 6
    const allDocsApproved = documents.every(d => d.status === 'approved')
    const someDocsRejected = documents.some(d => d.status === 'rejected')
    
    let reviewStage = 'documents_submitted'
    let estimatedCompletion = '48-72h'
    
    if (documentsSubmitted && !allDocsApproved && !someDocsRejected) {
      reviewStage = 'background_verification'
      estimatedCompletion = '24-48h'
    }
    
    if (allDocsApproved && !driver.is_suspended) {
      reviewStage = 'approved'
      estimatedCompletion = 'Completed'
    }
    
    if (someDocsRejected) {
      reviewStage = 'documents_rejected'
      estimatedCompletion = 'Action required'
    }
    
    const applicationId = `DRV-${new Date().getFullYear()}-${String(driver._id).slice(-6).toUpperCase()}`
    
    res.json({
      success: true,
      data: {
        applicationId,
        driverId: driver._id,
        name: driver.name,
        email: driver.email,
        status: reviewStage,
        estimatedCompletion,
        submittedAt: driver.metadata?.submittedAt || driver.createdAt,
        documents: documents.map(d => ({
          type: d.docType,
          status: d.status,
          uploadedAt: d.createdAt
        })),
        progress: {
          documentsSubmitted: documentsSubmitted,
          backgroundVerification: documentsSubmitted && !someDocsRejected,
          finalApproval: allDocsApproved && !driver.is_suspended
        }
      }
    })
  } catch (e) {
    console.error('Get application status failed:', e)
    res.status(500).json({ success: false, message: e.message || 'Failed to get application status' })
  }
})

module.exports = router
