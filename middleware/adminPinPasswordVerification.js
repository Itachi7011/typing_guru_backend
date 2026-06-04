// middleware/adminSecurityVerification.js
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { validationResult, body } = require('express-validator');
const Admin = require('../models/Admin/Admins');

const adminSecurityVerification = async (req, res, next) => {
    try {
        // Check for authentication token first
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                status: 'error',
                message: 'Authentication token required'
            });
        }

        const token = authHeader.split(' ')[1];
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
        } catch (jwtError) {
            return res.status(401).json({
                status: 'error',
                message: 'Invalid or expired token'
            });
        }

        // Validate request body
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                status: 'error',
                message: 'Validation failed',
                errors: errors.array()
            });
        }

        const { securityPin, password, operation } = req.body;

        // Check if at least one verification method is provided
        if (!securityPin && !password) {
            return res.status(400).json({
                status: 'error',
                message: 'Either security PIN or password is required for verification'
            });
        }

        // Find admin
        const admin = await Admin.findById(decoded.userId).select('+securityPin.pinHash +password');

        if (!admin || !admin.isActive || admin.isSuspended) {
            return res.status(404).json({
                status: 'error',
                message: 'Admin not found or account inactive'
            });
        }

        let isVerified = false;
        let verificationMethod = '';

        // Check if security PIN is provided and enabled
        if (securityPin) {
            if (!admin.securityPin?.enabled) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Security PIN is not enabled for this account'
                });
            }

            // Check if PIN is locked
            if (admin.securityPin.lockedUntil && admin.securityPin.lockedUntil > new Date()) {
                const lockTimeRemaining = Math.ceil((admin.securityPin.lockedUntil - new Date()) / 1000 / 60);
                return res.status(423).json({
                    status: 'error',
                    message: `Security PIN is temporarily locked. Try again in ${lockTimeRemaining} minutes.`
                });
            }

            // Verify PIN
            const isPinValid = await admin.compareSecurityPin(securityPin);
            if (isPinValid) {
                await admin.resetPinAttempts();
                isVerified = true;
                verificationMethod = 'pin';
            } else {
                const attemptsRemaining = 3 - admin.securityPin.failedAttempts;
                await admin.incrementPinAttempts();

                if (attemptsRemaining <= 0) {
                    return res.status(423).json({
                        status: 'error',
                        message: 'Too many failed attempts. Security PIN has been locked for 30 minutes.'
                    });
                }

                return res.status(401).json({
                    status: 'error',
                    message: `Invalid security PIN. ${attemptsRemaining} attempt(s) remaining.`
                });
            }
        }

        // If PIN verification failed or wasn't provided, check password
        if (!isVerified && password) {
            const isPasswordValid = await admin.comparePassword(password);
            if (isPasswordValid) {
                isVerified = true;
                verificationMethod = 'password';

                // Reset any PIN lock if password is verified
                if (admin.securityPin?.failedAttempts > 0) {
                    await admin.resetPinAttempts();
                }
            } else {
                return res.status(401).json({
                    status: 'error',
                    message: 'Invalid password'
                });
            }
        }

        if (!isVerified) {
            return res.status(401).json({
                status: 'error',
                message: 'Verification failed'
            });
        }

        // Attach admin and verification info to request
        req.admin = admin;
        req.verificationMethod = verificationMethod;
        req.verifiedAt = new Date();
        req.operation = operation || 'general_verification';

        next();
    } catch (error) {
        console.error('Admin security verification error:', error);

        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                status: 'error',
                message: 'Token expired'
            });
        }

        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                status: 'error',
                message: 'Invalid token'
            });
        }

        res.status(500).json({
            status: 'error',
            message: 'Security verification failed',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

/**
 * Validation rules for admin security verification
 */
const adminSecurityVerificationValidation = [
    body('securityPin')
        .optional()
        .isLength({ min: 6, max: 6 })
        .withMessage('Security PIN must be exactly 6 digits')
        .isNumeric()
        .withMessage('Security PIN must contain only numbers'),

    body('password')
        .optional()
        .isLength({ min: 1 })
        .withMessage('Password is required when provided')
];

module.exports = {
    adminSecurityVerification,
    adminSecurityVerificationValidation
};