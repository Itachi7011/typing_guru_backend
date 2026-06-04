// routes/subscriptionPlans.js
const express = require('express');
const router = express.Router();
const SubscriptionPlan = require('../models/Admin/SubscriptionPlans');
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin/Admins');

const PDFDocument = require('pdfkit');
const { Parser } = require('json2csv');

/* ================================================================
 * 💳 Subscription Plans Module
 * 
 * This file manages logic related to subscription plans and pricing.  
 * GET routes can be accessed by clients to view plans and features.  
 * 
 * All other routes (POST, PUT, DELETE) are restricted to admins only,  
 * for creating, updating, or deleting subscription data.
 * 
 * Access control is enforced to protect billing and plan details.  
 * Middleware checks must be in place to secure admin operations.
 * 
 * ================================================================ */


const authenticateAdmin = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // FIX: Remove all problematic field exclusions that cause path collisions
    const admin = await Admin.findById(decoded.userId);
    // Removed: .select('-password -tokens -security.passwordHistory -mfa.secret -mfa.backupCodes');

    if (!admin || !admin.isActive || admin.isSuspended) {
      return res.status(401).json({
        success: false,
        message: 'Token is not valid or account is inactive'
      });
    }

    // Check if token is still valid (not revoked)
    const tokenValid = admin.tokens && admin.tokens.some(t =>
      t.token === token &&
      !t.isRevoked &&
      t.expiration > new Date()
    );
    if (!tokenValid) {
      return res.status(401).json({
        success: false,
        message: 'Token has been revoked or expired'
      });
    }

    // Remove sensitive data manually before attaching to request
    const adminData = admin.toObject();


    // Remove all sensitive fields manually
    delete adminData.password;
    delete adminData.tokens;
    delete adminData.mfa?.secret;
    // delete adminData.mfa?.backupCodes;
    delete adminData.security?.passwordHistory;

    req.admin = adminData;
    req.token = token;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({
      success: false,
      message: 'Token is not valid'
    });
  }
};


const subscriptionPlanValidation = [
  body('name').notEmpty().trim().withMessage('Plan name is required'),
  body('tier').isIn(['FREE', 'BASIC', 'PRO', 'ENTERPRISE', 'CUSTOM']).withMessage('Invalid tier'),
  body('description').notEmpty().trim().withMessage('Description is required'),

  // More flexible price validation
  body('price.monthly')
    .custom((value) => {
      if (value === undefined || value === null) return false;
      // Allow both objects and numbers
      return typeof value === 'object' || typeof value === 'number';
    })
    .withMessage('Monthly price must be an object with currency keys or a number'),

  body('price.annually')
    .optional()
    .custom((value) => {
      if (value === undefined || value === null) return true; // Optional field
      // Allow both objects and numbers
      return typeof value === 'object' || typeof value === 'number';
    })
    .withMessage('Annual price must be an object with currency keys or a number'),

  body('price.currency')
    .optional()
    .isLength({ min: 3, max: 3 })
    .withMessage('Currency must be 3 characters'),
];


// Helper function to convert price Maps to plain objects

const convertPlanPricesToObjects = (plan) => {
  if (plan.price && plan.price.monthly instanceof Map) {
    plan.price.monthly = Object.fromEntries(plan.price.monthly);
  }
  if (plan.price && plan.price.annually instanceof Map) {
    plan.price.annually = Object.fromEntries(plan.price.annually);
  }
  return plan;
};







module.exports = router;