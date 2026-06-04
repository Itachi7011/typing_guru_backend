// routes/users.js
const express = require('express');
const { body, validationResult } = require('express-validator');
const multer = require('multer');
const { logManualActivity } = require('../middleware/userLoggingMiddleware');
const { sendUserRegistrationOTP, sendWelcomeEmail } = require('../services/emailService');
// const authenticateUser = require('../middleware/userAuthentication');
const bcrypt = require('bcryptjs');

const User = require('../models/User/Users');
const UserAuditLog = require('../models/User/UserAuditLog');
const UserActivity = require('../models/User/UserActivity');
const router = express.Router();
const passport = require('passport');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');


/* ================================================================
 * 👤 User Module
 * 
 * This file handles core functionality related to users (end users),
 *  including authentication, profile management, and general user operations.  
 * Both clients and admins may interact with routes defined here.
 * 
 * Sensitive data and actions are protected through middleware.  
 * Ensure proper access control at every level.
 * 
 * ================================================================ */




module.exports = router;