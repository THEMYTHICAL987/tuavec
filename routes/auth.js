const express = require('express');
const router = express.Router();
const { User } = require('../models');
const { 
    generateToken, 
    hashPassword, 
    comparePassword,
    saveOTP,
    verifyOTP,
    sendOTPSMS,
    isValidPhone,
    isValidEmail,
    sanitizePhone
} = require('../utils/helpers');
const { authenticate, loginRateLimit, otpRateLimit } = require('../middleware/auth');

// ========== SEND OTP ==========
router.post('/send-otp', otpRateLimit, async (req, res) => {
    try {
        const { phone, purpose } = req.body; // purpose: 'signup', 'login', 'reset'
        
        if (!phone || !purpose) {
            return res.status(400).json({
                success: false,
                error: 'Phone number and purpose are required'
            });
        }
        
        const sanitized = sanitizePhone(phone);
        
        if (!isValidPhone(sanitized)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid phone number format'
            });
        }
        
        // Check if phone exists for signup
        if (purpose === 'signup') {
            const existingUser = await User.findOne({ phone: sanitized });
            if (existingUser) {
                return res.status(400).json({
                    success: false,
                    error: 'Phone number already registered. Please login instead.'
                });
            }
        }
        
        // Check if phone exists for login/reset
        if (purpose === 'login' || purpose === 'reset') {
            const existingUser = await User.findOne({ phone: sanitized });
            if (!existingUser) {
                return res.status(404).json({
                    success: false,
                    error: 'Phone number not registered. Please signup first.'
                });
            }
        }
        
        // Generate and save OTP
        const otp = await saveOTP(sanitized, purpose);
        
        // Send OTP via SMS
        await sendOTPSMS(sanitized, otp);
        
        res.json({
            success: true,
            message: 'OTP sent successfully',
            phone: sanitized,
            // In development, return OTP (remove in production!)
            ...(process.env.NODE_ENV === 'development' && { otp })
        });
        
    } catch (error) {
        console.error('Send OTP error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to send OTP'
        });
    }
});

// ========== VERIFY OTP ==========
router.post('/verify-otp', async (req, res) => {
    try {
        const { phone, otp, purpose } = req.body;
        
        if (!phone || !otp || !purpose) {
            return res.status(400).json({
                success: false,
                error: 'Phone, OTP, and purpose are required'
            });
        }
        
        const sanitized = sanitizePhone(phone);
        const result = await verifyOTP(sanitized, otp, purpose);
        
        if (!result.success) {
            return res.status(400).json(result);
        }
        
        res.json({
            success: true,
            message: 'OTP verified successfully'
        });
        
    } catch (error) {
        console.error('Verify OTP error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to verify OTP'
        });
    }
});

// ========== SIGNUP ==========
router.post('/signup', async (req, res) => {
    try {
        const { name, email, phone, password, otp } = req.body;
        
        // Validation
        if (!name || !email || !phone || !password) {
            return res.status(400).json({
                success: false,
                error: 'All fields are required'
            });
        }
        
        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                error: 'Password must be at least 6 characters'
            });
        }
        
        const sanitized = sanitizePhone(phone);
        
        if (!isValidEmail(email)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid email format'
            });
        }
        
        if (!isValidPhone(sanitized)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid phone number format'
            });
        }
        
        // Verify OTP
        const otpResult = await verifyOTP(sanitized, otp, 'signup');
        if (!otpResult.success) {
            return res.status(400).json(otpResult);
        }
        
        // Check if user exists
        const existingUser = await User.findOne({
            $or: [{ email }, { phone: sanitized }]
        });
        
        if (existingUser) {
            return res.status(400).json({
                success: false,
                error: 'Email or phone already registered'
            });
        }
        
        // Hash password
        const hashedPassword = await hashPassword(password);
        
        // Create user
        const user = await User.create({
            name,
            email,
            phone: sanitized,
            password: hashedPassword,
            phoneVerified: true // OTP verified
        });
        
        // Generate token
        const token = generateToken(user._id);
        
        res.status(201).json({
            success: true,
            message: 'Account created successfully',
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                role: user.role
            }
        });
        
    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({
            success: false,
            error: 'Registration failed'
        });
    }
});

// ========== LOGIN ==========
router.post('/login', loginRateLimit, async (req, res) => {
    try {
        const { emailOrPhone, password } = req.body;
        
        if (!emailOrPhone || !password) {
            return res.status(400).json({
                success: false,
                error: 'Email/phone and password are required'
            });
        }
        
        // Find user by email or phone
        const user = await User.findOne({
            $or: [
                { email: emailOrPhone },
                { phone: sanitizePhone(emailOrPhone) }
            ]
        });
        
        if (!user) {
            return res.status(401).json({
                success: false,
                error: 'Invalid credentials'
            });
        }
        
        // Check password
        const isValidPassword = await comparePassword(password, user.password);
        
        if (!isValidPassword) {
            return res.status(401).json({
                success: false,
                error: 'Invalid credentials'
            });
        }
        
        // Update last login
        user.lastLogin = new Date();
        await user.save();
        
        // Generate token
        const token = generateToken(user._id);
        
        res.json({
            success: true,
            message: 'Login successful',
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                role: user.role
            }
        });
        
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            error: 'Login failed'
        });
    }
});

// ========== GET CURRENT USER ==========
router.get('/me', authenticate, async (req, res) => {
    try {
        const user = await User.findById(req.userId)
            .select('-password')
            .populate('wishlist', 'title price images');
        
        res.json({
            success: true,
            user
        });
        
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch user data'
        });
    }
});

// ========== UPDATE PROFILE ==========
router.put('/profile', authenticate, async (req, res) => {
    try {
        const { name, email } = req.body;
        const updates = {};
        
        if (name) updates.name = name;
        if (email && isValidEmail(email)) updates.email = email;
        
        const user = await User.findByIdAndUpdate(
            req.userId,
            updates,
            { new: true }
        ).select('-password');
        
        res.json({
            success: true,
            message: 'Profile updated successfully',
            user
        });
        
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update profile'
        });
    }
});

// ========== CHANGE PASSWORD ==========
router.put('/change-password', authenticate, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        
        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                error: 'Current and new password are required'
            });
        }
        
        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                error: 'New password must be at least 6 characters'
            });
        }
        
        const user = await User.findById(req.userId);
        
        // Verify current password
        const isValid = await comparePassword(currentPassword, user.password);
        if (!isValid) {
            return res.status(401).json({
                success: false,
                error: 'Current password is incorrect'
            });
        }
        
        // Update password
        user.password = await hashPassword(newPassword);
        await user.save();
        
        res.json({
            success: true,
            message: 'Password changed successfully'
        });
        
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to change password'
        });
    }
});

// ========== MANAGE ADDRESSES ==========

// Add address
router.post('/addresses', authenticate, async (req, res) => {
    try {
        const address = req.body;
        
        const user = await User.findById(req.userId);
        
        // If this is the first address or marked as default, make it default
        if (user.addresses.length === 0 || address.isDefault) {
            user.addresses.forEach(addr => addr.isDefault = false);
            address.isDefault = true;
        }
        
        user.addresses.push(address);
        await user.save();
        
        res.json({
            success: true,
            message: 'Address added successfully',
            addresses: user.addresses
        });
        
    } catch (error) {
        console.error('Add address error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to add address'
        });
    }
});

// Update address
router.put('/addresses/:addressId', authenticate, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        const address = user.addresses.id(req.params.addressId);
        
        if (!address) {
            return res.status(404).json({
                success: false,
                error: 'Address not found'
            });
        }
        
        Object.assign(address, req.body);
        
        if (req.body.isDefault) {
            user.addresses.forEach(addr => {
                if (addr._id.toString() !== req.params.addressId) {
                    addr.isDefault = false;
                }
            });
        }
        
        await user.save();
        
        res.json({
            success: true,
            message: 'Address updated successfully',
            addresses: user.addresses
        });
        
    } catch (error) {
        console.error('Update address error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update address'
        });
    }
});

// Delete address
router.delete('/addresses/:addressId', authenticate, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        user.addresses.pull(req.params.addressId);
        await user.save();
        
        res.json({
            success: true,
            message: 'Address deleted successfully',
            addresses: user.addresses
        });
        
    } catch (error) {
        console.error('Delete address error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete address'
        });
    }
});

// ========== MANAGE WISHLIST ==========

// Add to wishlist
router.post('/wishlist/:productId', authenticate, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        
        if (!user.wishlist.includes(req.params.productId)) {
            user.wishlist.push(req.params.productId);
            await user.save();
        }
        
        const updatedUser = await User.findById(req.userId)
            .populate('wishlist', 'title price images');
        
        res.json({
            success: true,
            message: 'Added to wishlist',
            wishlist: updatedUser.wishlist
        });
        
    } catch (error) {
        console.error('Add to wishlist error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to add to wishlist'
        });
    }
});

// Remove from wishlist
router.delete('/wishlist/:productId', authenticate, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        user.wishlist.pull(req.params.productId);
        await user.save();
        
        const updatedUser = await User.findById(req.userId)
            .populate('wishlist', 'title price images');
        
        res.json({
            success: true,
            message: 'Removed from wishlist',
            wishlist: updatedUser.wishlist
        });
        
    } catch (error) {
        console.error('Remove from wishlist error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to remove from wishlist'
        });
    }
});

module.exports = router;
