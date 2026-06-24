// routes/user/authRoutes.js
const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const cookieParser = require('cookie-parser');

const router = express.Router();

// Models
const User = require('../models/User/Users');
const UserActivity = require(`../models/User/UserActivity`);
const UserNotification = require(`../models/User/UserNotification`);

// Services
const { generateOTP, sendUserRegistrationOTP, sendOTPEmail } = require('../services/emailService');

// ============ RATE LIMITERS ============
const signupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: { success: false, message: 'Too many signup attempts. Please try again later.' }
});

const otpLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 3, // 3 OTP requests per window
  message: { success: false, message: 'Too many OTP requests. Please wait before trying again.' }
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 login attempts
  message: { success: false, message: 'Too many login attempts. Please try again later.' }
});

const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 reset requests per hour
  message: { success: false, message: 'Too many password reset attempts. Please try again later.' }
});

// ============ VALIDATION MIDDLEWARES ============
const validateSignup = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[A-Z])(?=.*\d)/).withMessage('Password must contain at least one uppercase letter and one number'),
  body('phone').optional().isMobilePhone().withMessage('Valid phone number is required'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: errors.array()[0].msg });
    }
    next();
  }
];

const validateOTP = [
  body('otp').isLength({ min: 6, max: 6 }).isNumeric().withMessage('Valid 6-digit OTP is required'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: errors.array()[0].msg });
    }
    next();
  }
];

const validateLogin = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: errors.array()[0].msg });
    }
    next();
  }
];

// ============ HELPER FUNCTIONS ============
const generateTokens = (user) => {
  const accessToken = jwt.sign(
    { userId: user._id, email: user.email, usertype: user.usertype },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
  
  const refreshToken = jwt.sign(
    { userId: user._id },
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );
  
  return { accessToken, refreshToken };
};

const logUserActivity = async (userId, eventType, eventAction, req, eventData = {}) => {
  try {
    const activity = new UserActivity({
      user: { userId, userModel: `${process.env.APP_NAME}_User` },
      clientId: null, // Optional now
      eventType,
      eventAction,
      eventData,
      location: {
        pathname: req.originalUrl,
        search: req.query ? JSON.stringify(req.query) : '',
        hash: ''
      },
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'],
      sessionId: req.session?.id || null
    });
    await activity.save();
  } catch (error) {
    console.error('Error logging user activity:', error);
  }
};

const createNotification = async (userId, title, message, type, priority = 'medium', data = null) => {
  try {
    const notification = new UserNotification({
      recipient: { userId, userModel: `${process.env.APP_NAME}_User` },
      type,
      priority,
      title,
      message,
      data,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
    });
    await notification.save();
    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
  }
};

// ============ PASSPORT GOOGLE STRATEGY ============
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "/api/user/auth/google/callback"
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      let user = await User.findOne({ 
        email: profile.emails[0].value,
        isDeleted: false 
      });
      
      if (!user) {
        // Create new user
        user = new User({
          name: profile.displayName || `${profile.name.givenName} ${profile.name.familyName}`,
          email: profile.emails[0].value,
          password: crypto.randomBytes(32).toString('hex'), // Random password
          emailVerified: true, // Google verified email
          usertype: "User",
          socialLogins: {
            google: {
              id: profile.id,
              profile: profile._json
            }
          },
          isActive: true,
          xp: 0,
          level: 1,
          points: 0
        });
        
        await user.save();
        
        // Create welcome notification
        await createNotification(
          user._id,
          "Welcome to Typing Exam Hub!",
          `Welcome ${user.name}! Start your typing journey today. Complete your first test to earn XP and level up.`,
          "announcement",
          "high"
        );
      }
      
      return done(null, user);
    } catch (error) {
      return done(error, null);
    }
  }
));

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

// ============ ROUTES ============

// @route   POST /api/user/auth/signup
// @desc    Register new user
// @access  Public
router.post('/signup', signupLimiter, validateSignup, async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;
    
    // Check if user already exists (including soft-deleted)
    const existingUser = await User.findOne({ 
      email: email.toLowerCase(),
      isDeleted: false
    });
    
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'A user with this email already exists'
      });
    }
    
    // Check soft-deleted user
    const softDeletedUser = await User.findOne({ 
      email: email.toLowerCase(),
      isDeleted: true
    });
    
    if (softDeletedUser) {
      return res.status(409).json({
        success: false,
        message: 'This account was deleted. Please contact support to restore it.'
      });
    }
    
    // Generate OTP
    const otp = generateOTP();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    
    // Create new user
    const newUser = new User({
      name: name.trim(),
      email: email.toLowerCase(),
      phone: phone || '',
      password,
      usertype: 'User',
      otp,
      emailVerified: false,
      phoneVerified: false,
      verificationToken: crypto.randomBytes(32).toString('hex'),
      verificationTokenExpires: otpExpires,
      isActive: true,
      isDeleted: false,
      xp: 0,
      level: 1,
      points: 0,
      totalTests: 0,
      bestWPM: 0,
      bestAccuracy: 0
    });
    
    await newUser.save();
    
    // Send OTP email
    const emailSent = await sendUserRegistrationOTP(email.toLowerCase(), {
      name: name.trim(),
      otp,
      website: { websiteName: 'Typing Exam Hub' },
      company: { name: 'Typing Exam Hub' },
      expiration: 10
    });
    
    // Log activity
    await logUserActivity(newUser._id, 'auth', 'user_registered', req, { email: email.toLowerCase() });
    
    // Create notification
    await createNotification(
      newUser._id,
      "Verify Your Email",
      `Please verify your email address using the OTP sent to ${email}. Your OTP expires in 10 minutes.`,
      "security_alert",
      "high"
    );
    
    return res.status(201).json({
      success: true,
      message: 'Registration successful. Please verify your email with the OTP sent.',
      emailSent: emailSent,
      userId: newUser._id
    });
    
  } catch (error) {
    console.error('Signup error:', error);
    return res.status(500).json({
      success: false,
      message: 'Registration failed. Please try again.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   POST /api/user/auth/send-email-otp
// @desc    Send email OTP for verification
// @access  Public (requires email in session/body)
router.post('/send-email-otp', otpLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }
    
    const user = await User.findOne({ 
      email: email.toLowerCase(),
      isDeleted: false
    });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    if (user.emailVerified) {
      return res.status(400).json({
        success: false,
        message: 'Email already verified'
      });
    }
    
    // Generate new OTP
    const otp = generateOTP();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000);
    
    user.otp = otp;
    user.verificationTokenExpires = otpExpires;
    await user.save();
    
    // Send OTP email
    const emailSent = await sendUserRegistrationOTP(email.toLowerCase(), {
      name: user.name,
      otp,
      website: { websiteName: 'Typing Exam Hub' },
      company: { name: 'Typing Exam Hub' },
      expiration: 10
    });
    
    if (!emailSent) {
      return res.status(500).json({
        success: false,
        message: 'Failed to send OTP email'
      });
    }
    
    await logUserActivity(user._id, 'auth', 'otp_sent', req, { type: 'email' });
    
    return res.status(200).json({
      success: true,
      message: 'OTP sent to your email'
    });
    
  } catch (error) {
    console.error('Send OTP error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to send OTP'
    });
  }
});

// @route   POST /api/user/auth/verify-email
// @desc    Verify email with OTP
// @access  Public
router.post('/verify-email', validateOTP, async (req, res) => {
  try {
    const { email, otp } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }
    
    const user = await User.findOne({ 
      email: email.toLowerCase(),
      isDeleted: false
    });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    if (user.emailVerified) {
      return res.status(400).json({
        success: false,
        message: 'Email already verified'
      });
    }
    
    // Check OTP
    if (user.otp !== otp) {
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP'
      });
    }
    
    // Check expiry
    if (user.verificationTokenExpires < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'OTP has expired. Please request a new one.'
      });
    }
    
    // Verify email
    user.emailVerified = true;
    user.otp = null;
    user.verificationToken = null;
    user.verificationTokenExpires = null;
    await user.save();
    
    // Log activity
    await logUserActivity(user._id, 'auth', 'email_verified', req);
    
    // Create welcome notification
    await createNotification(
      user._id,
      "🎉 Email Verified Successfully!",
      "Your email has been verified. Start your typing journey now and earn XP, badges, and climb the leaderboards!",
      "announcement",
      "high"
    );
    
    return res.status(200).json({
      success: true,
      message: 'Email verified successfully'
    });
    
  } catch (error) {
    console.error('Verify email error:', error);
    return res.status(500).json({
      success: false,
      message: 'Verification failed'
    });
  }
});

// @route   POST /api/user/auth/login
// @desc    Login user
// @access  Public
router.post('/login', loginLimiter, validateLogin, async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const user = await User.findOne({ 
      email: email.toLowerCase(),
      isDeleted: false
    });
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }
    
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated. Please contact support.'
      });
    }
    
    // Check login attempts
    if (user.lockUntil && user.lockUntil > Date.now()) {
      return res.status(401).json({
        success: false,
        message: 'Account temporarily locked. Please try again later.'
      });
    }
    
    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    
    if (!isPasswordValid) {
      await user.incrementLoginAttempts();
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }
    
    // Reset login attempts
    await user.resetLoginAttempts();
    
    // Update last login
    user.lastLogin = new Date();
    
    // Generate tokens
    const accessToken = jwt.sign(
      { userId: user._id, email: user.email, usertype: user.usertype },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    const refreshToken = jwt.sign(
      { userId: user._id },
      process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );
    
    // Store tokens in database
    user.tokens = user.tokens || []; 
    
// Add refresh token to tokens array 
user.tokens.push({
  token: refreshToken, 
  tokenType: 'refresh', 
  sessionId: crypto.randomBytes(16).toString('hex'),
  expiration: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  createdAt: new Date(),
  isRevoked: false,
  deviceInfo: {
    userAgent: req.headers['user-agent'],
    ipAddress: req.ip || req.connection.remoteAddress
  }
});

// ALSO store access token in tokens array
user.tokens.push({
  token: accessToken,
  tokenType: 'access',
  sessionId: crypto.randomBytes(16).toString('hex'),
  expiration: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  createdAt: new Date(),
  isRevoked: false,
  deviceInfo: {
    userAgent: req.headers['user-agent'],
    ipAddress: req.ip || req.connection.remoteAddress
  }
});
    
    // Also store access token for session tracking
    user.lastAccessTokenAt = new Date();
    
    // Keep only last 5 tokens
    if (user.tokens.length > 5) {
      user.tokens = user.tokens.slice(-5);
    }
    
    await user.save();
    
    // Set cookies with tokens (httpOnly for security)
    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });
    
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    });
    
    // Log activity
    await logUserActivity(user._id, 'auth', 'user_login', req);
    
    // Return user data (without sensitive info)
    const userData = user.getPublicProfile();
    
    return res.status(200).json({
      success: true,
      message: 'Login successful',
      user: userData
    });
    
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      message: 'Login failed. Please try again.'
    });
  }
});


// @route   POST /api/user/auth/forgot-password
// @desc    Send password reset OTP
// @access  Public
router.post('/forgot-password', passwordResetLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }
    
    const user = await User.findOne({ 
      email: email.toLowerCase(),
      isDeleted: false,
      isActive: true
    });
    
    if (!user) {
      // For security, don't reveal if user exists
      return res.status(200).json({
        success: true,
        message: 'If an account exists, a password reset OTP has been sent.'
      });
    }
    
    // Generate OTP
    const otp = generateOTP();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000);
    
    user.otp = otp;
    user.passwordResetToken = otp;
    user.passwordResetExpires = otpExpires;
    await user.save();
    
    // Send OTP email
    await sendOTPEmail(email.toLowerCase(), {
      name: user.name,
      otp,
      website: 'Typing Exam Hub',
      company: 'Typing Exam Hub',
      expiration: 10,
      purpose: 'password_reset'
    });
    
    await logUserActivity(user._id, 'auth', 'password_reset_requested', req);
    
    return res.status(200).json({
      success: true,
      message: 'If an account exists, a password reset OTP has been sent.'
    });
    
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to send reset OTP'
    });
  }
});

// @route   POST /api/user/auth/verify-reset-otp
// @desc    Verify reset OTP
// @access  Public
router.post('/verify-reset-otp', validateOTP, async (req, res) => {
  try {
    const { email, otp } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }
    
    const user = await User.findOne({ 
      email: email.toLowerCase(),
      isDeleted: false,
      isActive: true
    });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Check OTP
    if (user.passwordResetToken !== otp) {
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP'
      });
    }
    
    // Check expiry
    if (user.passwordResetExpires < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'OTP has expired. Please request a new one.'
      });
    }
    
    return res.status(200).json({
      success: true,
      message: 'OTP verified. You can now reset your password.'
    });
    
  } catch (error) {
    console.error('Verify reset OTP error:', error);
    return res.status(500).json({
      success: false,
      message: 'Verification failed'
    });
  }
});

// @route   POST /api/user/auth/reset-password
// @desc    Reset password with OTP
// @access  Public
router.post('/reset-password', [
  body('newPassword').isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[A-Z])(?=.*\d)/).withMessage('Password must contain at least one uppercase letter and one number'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: errors.array()[0].msg });
    }
    next();
  }
], async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    
    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Email and OTP are required'
      });
    }
    
    const user = await User.findOne({ 
      email: email.toLowerCase(),
      isDeleted: false,
      isActive: true
    });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Check OTP
    if (user.passwordResetToken !== otp) {
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP'
      });
    }
    
    // Check expiry
    if (user.passwordResetExpires < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'OTP has expired. Please request a new one.'
      });
    }
    
    // Update password (will be hashed by pre-save middleware)
    user.password = newPassword;
    user.passwordResetToken = null;
    user.passwordResetExpires = null;
    user.otp = null;
    await user.save();
    
    // Log activity
    await logUserActivity(user._id, 'auth', 'password_reset_success', req);
    
    // Create notification
    await createNotification(
      user._id,
      "Password Changed Successfully",
      "Your password has been changed. If you didn't make this change, please contact support immediately.",
      "security_alert",
      "urgent"
    );
    
    return res.status(200).json({
      success: true,
      message: 'Password reset successful. You can now login with your new password.'
    });
    
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({
      success: false,
      message: 'Password reset failed'
    });
  }
});

// @route   GET /api/user/auth/google
// @desc    Google OAuth login/signup
// @access  Public
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

// @route   GET /api/user/auth/google/callback
// @desc    Google OAuth callback
// @access  Public
router.get('/google/callback', 
  passport.authenticate('google', { failureRedirect: '/auth/login', session: false }),
  async (req, res) => {
    try {
      const user = req.user;
      
      // Generate tokens
      const { accessToken, refreshToken } = generateTokens(user);
      
      // Log activity
      await logUserActivity(user._id, 'auth', 'google_login', req);
      
      // Redirect to frontend with tokens
      const frontendUrl = process.env.CLIENT_URL || 'http://localhost:5173';
      res.redirect(`${frontendUrl}/auth/callback?accessToken=${accessToken}&refreshToken=${refreshToken}`);
      
    } catch (error) {
      console.error('Google callback error:', error);
      res.redirect('/auth/login?error=google_auth_failed');
    }
  }
);

// @route   POST /api/user/auth/refresh-token
// @desc    Refresh access token
// @access  Public
router.post('/refresh-token', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token required'
      });
    }
    
    // Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);
    
    const user = await User.findOne({
      _id: decoded.userId,
      isDeleted: false,
      isActive: true
    });
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token'
      });
    }
    
    // Check if token exists and is not revoked
    const tokenExists = user.tokens?.some(t => t.token === refreshToken && !t.isRevoked);
    
    if (!tokenExists) {
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token'
      });
    }
    
    // Generate new tokens
    const { accessToken, refreshToken: newRefreshToken } = generateTokens(user);
    
    // Replace old refresh token
    if (user.tokens) {
      const tokenIndex = user.tokens.findIndex(t => t.token === refreshToken);
      if (tokenIndex !== -1) {
        user.tokens[tokenIndex].isRevoked = true;
      }
      user.tokens.push({
        token: newRefreshToken,
        tokenType: 'refresh',
        sessionId: crypto.randomBytes(16).toString('hex'),
        expiration: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
        isRevoked: false
      });
      await user.save();
    }
    
    return res.status(200).json({
      success: true,
      accessToken,
      refreshToken: newRefreshToken
    });
    
  } catch (error) {
    console.error('Refresh token error:', error);
    return res.status(401).json({
      success: false,
      message: 'Invalid refresh token'
    });
  }
});

// @route   POST /api/user/auth/logout
// @desc    Logout user
// @access  Private (requires auth)
router.post('/logout', async (req, res) => {
  try {
    const accessToken = req.cookies.accessToken;
    
    if (accessToken && req.user) {
      // Decode token to get user
      const decoded = jwt.verify(accessToken, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId);
      
      if (user) {
        // Revoke the token
        if (user.tokens) {
          const tokenIndex = user.tokens.findIndex(t => t.token === accessToken);
          if (tokenIndex !== -1) {
            user.tokens[tokenIndex].isRevoked = true;
          }
        }
        user.currentAccessToken = null;
        await user.save();
        
        await logUserActivity(user._id, 'auth', 'user_logout', req);
      }
    }
    
    // Clear cookies
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    
    return res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
    
  } catch (error) {
    console.error('Logout error:', error);
    return res.status(500).json({
      success: false,
      message: 'Logout failed'
    });
  }
});


// @route   POST /api/user/auth/send-phone-otp
// @desc    Send phone OTP (placeholder for future SMS integration)
// @access  Private
router.post('/send-phone-otp', async (req, res) => {
  try {
    const userId = req.user?._id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }
    
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    if (!user.phone) {
      return res.status(400).json({
        success: false,
        message: 'Phone number not registered. Please add a phone number first.'
      });
    }
    
    // Generate phone OTP
    const phoneOtp = generateOTP();
    const phoneOtpExpires = new Date(Date.now() + 10 * 60 * 1000);
    
    // Store OTP (you might want a separate field for phone OTP)
    user.otp = phoneOtp; // Using same field for now
    user.verificationTokenExpires = phoneOtpExpires;
    await user.save();
    
    // TODO: Integrate SMS service here
    console.log(`Phone OTP for ${user.phone}: ${phoneOtp}`);
    
    await logUserActivity(user._id, 'auth', 'phone_otp_sent', req);
    
    return res.status(200).json({
      success: true,
      message: 'OTP sent to your phone. (SMS service will be integrated soon)',
      debug: process.env.NODE_ENV === 'development' ? { otp: phoneOtp } : undefined
    });
    
  } catch (error) {
    console.error('Send phone OTP error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to send phone OTP'
    });
  }
});

// @route   POST /api/user/auth/verify-phone
// @desc    Verify phone with OTP
// @access  Private
router.post('/verify-phone', validateOTP, async (req, res) => {
  try {
    const userId = req.user?._id;
    const { otp } = req.body;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }
    
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    if (user.phoneVerified) {
      return res.status(400).json({
        success: false,
        message: 'Phone already verified'
      });
    }
    
    // Check OTP
    if (user.otp !== otp) {
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP'
      });
    }
    
    // Check expiry
    if (user.verificationTokenExpires < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'OTP has expired. Please request a new one.'
      });
    }
    
    // Verify phone
    user.phoneVerified = true;
    user.otp = null;
    user.verificationTokenExpires = null;
    await user.save();
    
    await logUserActivity(user._id, 'auth', 'phone_verified', req);
    
    await createNotification(
      user._id,
      "Phone Number Verified",
      "Your phone number has been verified successfully.",
      "security_alert",
      "medium"
    );
    
    return res.status(200).json({
      success: true,
      message: 'Phone verified successfully'
    });
    
  } catch (error) {
    console.error('Verify phone error:', error);
    return res.status(500).json({
      success: false,
      message: 'Phone verification failed'
    });
  }
});

// Auth middleware to get current user
const authMiddleware = async (req, res, next) => {
  try {
    // Get token from cookie first, then from Authorization header
    let token = req.cookies.accessToken;
    
    if (!token) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
      }
    }
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token required'
      });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const user = await User.findOne({
      _id: decoded.userId,
      isDeleted: false,
      isActive: true
    });
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Verify token is not revoked
    if (user.tokens) {
      const tokenExists = user.tokens.some(t => t.token === token && !t.isRevoked);
      if (!tokenExists && user.currentAccessToken !== token) {
        return res.status(401).json({
          success: false,
          message: 'Invalid or revoked token'
        });
      }
    }
    
    req.user = user;
    req.token = token;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token'
    });
  }
};


// @route   GET /api/user/auth/me
// @desc    Get current user profile
// @access  Private
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const userData = req.user.getPublicProfile();
    const typingStats = req.user.getTypingStats();
    
    return res.status(200).json({
      success: true,
      user: userData,
      stats: typingStats
    });
    
  } catch (error) {
    console.error('Get profile error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch profile'
    });
  }
});

module.exports = router;