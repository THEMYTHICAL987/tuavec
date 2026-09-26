const express = require('express');
const router = express.Router();
const Vendor = require('../models/Vendor');
const { adminAuth } = require('../middleware/auth');

// GET /api/vendors - Get all approved vendors (public endpoint)
router.get('/', async (req, res) => {
  try {
    const vendors = await Vendor.find({ status: 'approved' }).select(
      'name country commissionRate category totalSales createdAt'
    );

    res.json({
      success: true,
      count: vendors.length,
      vendors
    });
  } catch (error) {
    console.error('Error fetching vendors:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching vendors',
      error: error.message
    });
  }
});

// POST /api/vendors - Create a new vendor application
router.post('/', async (req, res) => {
  try {
    const { name, country, email, category, commissionRate } = req.body;

    if (!name || !country || !email || !category) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: name, country, email, category'
      });
    }

    // Check if vendor email already exists
    const existingVendor = await Vendor.findOne({ email });
    if (existingVendor) {
      return res.status(409).json({
        success: false,
        message: 'Vendor with this email already exists'
      });
    }

    const vendor = new Vendor({
      name,
      country,
      email,
      category,
      commissionRate: commissionRate || 10,
      status: 'pending'
    });

    await vendor.save();

    res.status(201).json({
      success: true,
      message: 'Vendor application submitted successfully',
      vendor
    });
  } catch (error) {
    console.error('Error creating vendor:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating vendor application',
      error: error.message
    });
  }
});

// PATCH /api/vendors/:id/approve - Approve a vendor (admin only)
router.patch('/:id/approve', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const vendor = await Vendor.findById(id);
    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found'
      });
    }

    vendor.status = 'approved';
    vendor.approvedAt = new Date();
    await vendor.save();

    res.json({
      success: true,
      message: 'Vendor approved successfully',
      vendor
    });
  } catch (error) {
    console.error('Error approving vendor:', error);
    res.status(500).json({
      success: false,
      message: 'Error approving vendor',
      error: error.message
    });
  }
});

// PATCH /api/vendors/:id/reject - Reject a vendor (admin only)
router.patch('/:id/reject', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const vendor = await Vendor.findById(id);
    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found'
      });
    }

    vendor.status = 'rejected';
    vendor.rejectionReason = reason || 'No reason provided';
    await vendor.save();

    res.json({
      success: true,
      message: 'Vendor rejected successfully',
      vendor
    });
  } catch (error) {
    console.error('Error rejecting vendor:', error);
    res.status(500).json({
      success: false,
      message: 'Error rejecting vendor',
      error: error.message
    });
  }
});

// GET /api/vendors/:id - Get vendor details (admin only)
router.get('/:id', adminAuth, async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.params.id);
    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found'
      });
    }

    res.json({
      success: true,
      vendor
    });
  } catch (error) {
    console.error('Error fetching vendor:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching vendor',
      error: error.message
    });
  }
});

module.exports = router;
