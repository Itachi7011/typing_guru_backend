// app.js
const express = require('express');
const app = express();
require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const hpp = require('hpp');
const compression = require('compression');
const passport = require('passport');
const cookieParser = require('cookie-parser');

const PORT = process.env.PORT || 5000;

require("./scheduler/cleanupAccounts");

const UserAuthRoutes = require('./routes/userAuth');
const UserProfileRoutes = require('./routes/userProfile');

// ============ CORS Configuration ============
const isDevelopment = process.env.NODE_ENV === 'development';

// Get frontend URL based on environment
const getFrontendURL = () => {
  if (isDevelopment) {
    return process.env.DEVELOPMENT_BASE_FRONTEND_URL || 'http://localhost:5173';
  } else {
    return process.env.PRODUCTION_BASE_FRONTEND_URL || process.env.CLIENT_URL || 'https://typingexamhub.netlify.';
  }
};

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, or server-to-server)
    if (!origin) {
      return callback(null, true);
    }
    
    const allowedOrigin = getFrontendURL();
    
    // In development, allow any localhost for convenience
    if (isDevelopment) {
      const isLocalhost = origin.match(/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/);
      if (isLocalhost || origin === allowedOrigin) {
        return callback(null, true);
      }
    }
    
    // In production, only allow specific origin
    if (origin === allowedOrigin) {
      return callback(null, true);
    }
    
    console.log('CORS blocked origin:', origin);
    callback(new Error(`Origin ${origin} not allowed by CORS`));
  },
  credentials: true, // Allow cookies to be sent
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Set-Cookie'],
  maxAge: 86400 // 24 hours
};

// Apply CORS middleware
app.use(cors(corsOptions));

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" }
}));

app.use(cookieParser());
app.use(passport.initialize());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});

app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Prevent parameter pollution
app.use(hpp());

// Compression
app.use(compression());

// Routes
app.use('/api/user/auth', UserAuthRoutes);
app.use('/api/user/profile', UserProfileRoutes);

// Test route to check CORS
app.get('/api/test-cors', (req, res) => {
  console.log('✅ CORS TEST: Request reached the server');
  res.json({
    success: true,
    message: 'CORS is working correctly',
    origin: req.headers.origin,
    environment: process.env.NODE_ENV,
    cookies: req.cookies ? 'Cookies received' : 'No cookies'
  });
});

app.get('/api/test', (req, res) => {
  res.send("Successfully reaches");
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});

// Request logger middleware (place after CORS)
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url} - Origin: ${req.headers.origin || 'No origin'}`);
  next();
});

// // 404 handler
// app.use('*', (req, res) => {
//   res.status(404).json({
//     status: 'error',
//     message: `Can't find ${req.originalUrl} on this server!`
//   });
// });

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({
      success: false,
      message: 'CORS error: Origin not allowed'
    });
  }
  
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI, {
}).then(() => {
  console.log('Connected to MongoDB');
}).catch(err => {
  console.error('MongoDB connection error:', err);
  process.exit(1);
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
//   console.log(`Environment: ${process.env.NODE_ENV}`);
//   console.log(`CORS allowed origin: ${getFrontendURL()}`);
});

module.exports = app;