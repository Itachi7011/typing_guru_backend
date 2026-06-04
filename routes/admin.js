// routes/admin.js
const express = require('express');
const axios = require('axios');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const rateLimit = require('express-rate-limit');
const { cloudinarySingleUpload } = require('../middleware/cloudinaryUploader');
const os = require("os");
const moment = require("moment");
const si = require("systeminformation");
const mongoose = require("mongoose");
const tls = require('tls');
const fs = require('fs');
const { exec } = require("child_process");
const chokidar = require("chokidar");
// const PDFDocument = require('pdfkit');
const csv = require('csv-writer').createObjectCsvStringifier;

// const AuditLog = require('../models/Admin/AuditLog');
const router = express.Router();
const cloudinary = require("cloudinary").v2;
const { generateOTP, sendOTPEmail, sendWelcomeEmail } = require('../services/emailService');
// const { adminSecurityVerification, adminSecurityVerificationValidation } = require('../middleware/adminPinPasswordVerification');

const User = require('../models/User/Users');
const Admin = require('../models/Admin/Admins');
// const {Client} = require('models/Client/Client')
const AdminActivityDB = require('../models/Admin/AdminActivity');
const AdminAuditLog = require('../models/Admin/AdminAuditLog');

const UserAuditLog = require('../models/User/UserAuditLog');
const UserActivity = require('../models/User/UserActivity');

const SearchConfiguration = require('../models/Admin/SearchBarSettings/SearchConfiguration');
const RecentSearch = require('../models/Admin/SearchBarSettings/RecentSearch');
const SearchAnalytics = require('../models/Admin/SearchBarSettings/SearchAnalytics');

const NotificationAlert = require('../models/Public/NotificationAlert');
const PrivacyPolicy = require('../models/Admin/PrivacyPolicyAndTerms/PrivacyPolicy');
const TermsOfService = require('../models/Admin/PrivacyPolicyAndTerms/TermsOfService');
const PlatformSettings = require('../models/Admin/Settings');
/* ================================================================
 * 📁 Admin Module
 * 
 * This file contains all of the code that is exclusively used  
 * by administrators of the system. It includes logic for managing  
 * users, system settings, reports, and privileged operations.
 * 
 * Only authorized personnel should modify or execute this file.  
 * Ensure all changes are reviewed and tested before deployment.
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
        // console.log(decoded)

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

const registrationLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: {
        error: 'Too many registration attempts, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Validation rules for admin registration (updated for Cloudinary)
const adminRegistrationValidation = [
    body('firstName')
        .trim()
        .isLength({ min: 1, max: 50 })
        .withMessage('First name must be between 1 and 50 characters'),

    body('lastName')
        .trim()
        .isLength({ min: 1, max: 50 })
        .withMessage('Last name must be between 1 and 50 characters'),

    body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Please provide a valid email address'),

    body('password')
        .isLength({ min: 12 })
        .withMessage('Password must be at least 12 characters long')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
        .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),

    body('phoneNumber')
        .optional()
        .matches(/^\+?[1-9]\d{1,14}$/)
        .withMessage('Please provide a valid phone number'),

    body('profile.title')
        .trim()
        .isLength({ min: 1, max: 100 })
        .withMessage('Job title is required and must be less than 100 characters'),

    body('profile.department')
        .isIn(['Engineering', 'Sales', 'Marketing', 'Support', 'Operations', 'Finance', 'HR', 'Executive'])
        .withMessage('Invalid department selected'),

    body('role')
        .isIn(['Super Admin', 'Admin', 'Support', 'Billing', 'Read Only'])
        .withMessage('Invalid role selected'),

    body('languagePreference')
        .optional()
        .isLength({ min: 2, max: 10 })
        .withMessage('Invalid language preference'),

    body('timeZone')
        .optional()
        .isLength({ min: 3, max: 50 })
        .withMessage('Invalid timezone'),
];

// Validation rules
const notificationAlertValidation = [
    body('title')
        .trim()
        .isLength({ min: 1, max: 200 })
        .withMessage('Title must be between 1 and 200 characters'),

    body('message')
        .trim()
        .isLength({ min: 1, max: 1000 })
        .withMessage('Message must be between 1 and 1000 characters'),

    body('type')
        .isIn(['info', 'warning', 'success', 'error', 'maintenance', 'update', 'announcement', 'promotion'])
        .withMessage('Invalid notification type'),

    body('priority')
        .isIn(['low', 'medium', 'high', 'critical'])
        .withMessage('Invalid priority level'),

    body('startDate')
        .isISO8601()
        .withMessage('Valid start date is required'),

    body('endDate')
        .isISO8601()
        .withMessage('Valid end date is required'),

    body('targetAudience')
        .isIn(['all', 'clients', 'users', 'specific_clients', 'specific_users', 'admins', 'test'])
        .withMessage('Invalid target audience'),

    body('displayType')
        .isIn(['banner', 'modal', 'toast', 'inline', 'email_only'])
        .withMessage('Invalid display type')
];

const privacyPolicyValidation = [
    body('scope').isIn(['global', 'client']).withMessage('Scope must be global or client'),
    body('content').notEmpty().trim().withMessage('Content is required'),
    body('version').matches(/^\d+\.\d+\.\d+$/).withMessage('Version must follow semantic versioning (e.g., 1.0.0)'),
    body('changeLog').notEmpty().trim().withMessage('Change log is required'),
    body('effectiveDate').isISO8601().withMessage('Invalid effective date'),
    body('language').isLength({ min: 2, max: 5 }).withMessage('Invalid language code'),
    body('region').notEmpty().trim().withMessage('Region is required'),
    body('requiresReacceptance').optional().isBoolean().withMessage('Requires reacceptance must be boolean')
];

const termsOfServiceValidation = [
    body('scope').isIn(['global', 'client']).withMessage('Scope must be global or client'),
    body('documentType').isIn(['terms_of_service', 'service_agreement', 'api_agreement', 'sla'])
        .withMessage('Invalid document type'),
    body('content').notEmpty().trim().withMessage('Content is required'),
    body('version').matches(/^\d+\.\d+\.\d+$/).withMessage('Version must follow semantic versioning (e.g., 1.0.0)'),
    body('changeLog').notEmpty().trim().withMessage('Change log is required'),
    body('effectiveDate').isISO8601().withMessage('Invalid effective date'),
    body('language').isLength({ min: 2, max: 5 }).withMessage('Invalid language code'),
    body('region').notEmpty().trim().withMessage('Region is required'),
    body('requiresReacceptance').optional().isBoolean().withMessage('Requires reacceptance must be boolean'),
    body('appliesTo.users').optional().isBoolean().withMessage('Applies to users must be boolean'),
    body('appliesTo.clients').optional().isBoolean().withMessage('Applies to clients must be boolean'),
    body('appliesTo.admins').optional().isBoolean().withMessage('Applies to admins must be boolean'),
    body('minimumAge').optional().isInt({ min: 0, max: 21 }).withMessage('Minimum age must be between 0 and 21')
];

const versionValidation = [
    body('content').notEmpty().trim().withMessage('Content is required'),
    body('version').matches(/^\d+\.\d+\.\d+$/).withMessage('Version must follow semantic versioning'),
    body('changeLog').notEmpty().trim().withMessage('Change log is required'),
    body('effectiveDate').isISO8601().withMessage('Invalid effective date')
];

const logAdminActivity = async (req, action, resourceId, metadata = {}) => {
    try {
        await AdminAuditLog.create({
            action: action,
            adminId: req.admin._id,
            resourceType: 'notification_alert',
            resourceId: resourceId,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent') || '',
            status: 'success',
            severity: 'medium',
            metadata: metadata,
            role: req.admin.role,
            department: req.admin.profile?.department
        });
    } catch (error) {
        console.error('Audit log error:', error);
    }
};



// Helper function to generate email verification token
const generateEmailVerificationToken = () => {
    return crypto.randomBytes(32).toString('hex');
};
// Middleware for verifying admin PIN or password
const generateBackupCodes = (count = 10) => {
    const codes = [];
    for (let i = 0; i < count; i++) {
        codes.push({
            code: crypto.randomBytes(8).toString('hex').toUpperCase(),
            used: false,
            createdAt: new Date(),
            expiresAt: null
        });
    }
    return codes;
};

// Helper function to send verification email
const sendVerificationEmail = async (admin, otp, expiration) => {
    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });


    const mailOptions = {
        from: process.env.FROM_EMAIL,
        to: admin.email,
        subject: 'Verify Your AuthNest Admin Account',
        html: `
      <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; color: white;">
          <h1 style="margin: 0; font-size: 28px;">🛡️ AuthNest</h1>
          <p style="margin: 10px 0 0 0; font-size: 16px;">Welcome to Your Admin Account</p>
        </div>
        
        <div style="padding: 40px 30px; background: #ffffff;">
          <h2 style="color: #333; margin-bottom: 20px;">Hello ${admin.firstName},</h2>
          
          <p style="color: #666; line-height: 1.6; margin-bottom: 25px;">
            Thank you for registering as an admin on AuthNest! To complete your account setup and ensure the security of your admin privileges, please verify your email address.
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
           <div class="otp-code">${otp}</div>
            <p class="warning">⚠️ This OTP will expire in ${expiration} minutes. Please do not share this code with anyone.</p>
          </div>
          
          <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 25px 0;">
            <h3 style="color: #333; margin-top: 0;">Your Account Details:</h3>
            <ul style="color: #666; line-height: 1.6;">
              <li><strong>Name:</strong> ${admin.firstName} ${admin.lastName}</li>
              <li><strong>Email:</strong> ${admin.email}</li>
              <li><strong>Role:</strong> ${admin.role}</li>
              <li><strong>Department:</strong> ${admin.profile.department}</li>
            </ul>
          </div>
          
          <p style="color: #666; line-height: 1.6; font-size: 14px; margin-top: 30px;">
            <strong>Security Note:</strong> This verification link will expire in 24 hours. If you didn't create this account, please ignore this email.
          </p>
        </div>
        
        <div style="background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 14px;">
          <p>AuthNest - Secure Authentication Platform</p>
          <p>If you have any questions, contact us at <a href="mailto:support@authnest.com" style="color: #667eea;">support@authnest.com</a></p>
        </div>
      </div>
    `,
    };

    try {
        await transporter.sendMail(mailOptions);
        return { success: true };
    } catch (error) {
        console.error('Email sending error:', error);
        return { success: false, error: error.message };
    }
};




/* ======================================================================================================================================
 *                                🌐 Admin's Metrics Like Health Code Starts Here 🌐
 *                               The following section outlines the Admin's Users.
 *                               Please read carefully before interacting with any functionality.
 * ====================================================================================================================================== */


/**
 * SYSTEM STATUS API
 * Combines: system-status, uptime, cpu-load, process-memory, system-temperature
 * Returns comprehensive system information including:
 * - System details (OS, platform, architecture)
 * - CPU information (manufacturer, model, cores, speed, usage, load averages)
 * - Memory usage (total, used, available, process memory)
 * - Disk information (total, used, available space)
 * - Network statistics (rx/tx)
 * - System temperature
 * - Uptime in human-readable format
 */

router.get("/system-status", async (req, res) => {
    try {
        const [
            systemInfo,
            cpuInfo,
            memInfo,
            diskLayout,
            networkInfo,
            cpuTemp
        ] = await Promise.all([
            si.system(),
            si.cpu(),
            si.mem(),
            si.diskLayout(),
            si.networkStats(),
            si.cpuTemperature().catch(() => ({ main: null })) // Gracefully handle error
        ]);
        // console.log("Mounted filesystems:", dev/sda3);

        const fsSize = await si.fsSize();
        const systemDisk = fsSize.find(disk => disk.mount === '/');

        const diskInfo = systemDisk
            ? {
                total: systemDisk.size,
                used: systemDisk.used,
                available: systemDisk.size - systemDisk.used,
            }
            : { total: 0, used: 0, available: 0 };



        const diskUsed = diskInfo.total - diskInfo.available;
        const load = os.loadavg();
        const memoryUsage = process.memoryUsage();
        const uptime = os.uptime();
        const uptimeString = moment.duration(uptime, "seconds").humanize();

        const systemStatus = {
            system: {
                os: systemInfo.os,
                platform: systemInfo.platform,
                arch: systemInfo.arch,
                uptime: uptime,
                uptimeString: uptimeString
            },
            cpu: {
                manufacturer: cpuInfo.manufacturer,
                brand: cpuInfo.brand,
                model: cpuInfo.model,
                cores: cpuInfo.cores,
                speed: cpuInfo.speed,
                usage: cpuInfo.usage,
                load: {
                    load1: load[0],
                    load5: load[1],
                    load15: load[2]
                }
            },
            os: {
                platform: os.platform(),
                arch: os.arch(),
                release: os.release(),
                type: os.type(),
                hostname: os.hostname(),
            },
            memory: {
                total: memInfo.total,
                used: memInfo.used,
                active: memInfo.active,
                available: memInfo.available,
                process: {
                    rss: memoryUsage.rss,
                    heapTotal: memoryUsage.heapTotal,
                    heapUsed: memoryUsage.heapUsed,
                    external: memoryUsage.external,
                }
            },
            disk: {
                total: (diskInfo.total / 1024 / 1024 / 1024).toFixed(2) + " GB",
                used: (diskInfo.used / 1024 / 1024 / 1024).toFixed(2) + " GB",
                available: (diskInfo.available / 1024 / 1024 / 1024).toFixed(2) + " GB",
            },
            network: {
                rx: networkInfo[0].rx,
                tx: networkInfo[0].tx,
            },
            temperature: cpuTemp
        };

        res.json(systemStatus);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to retrieve system status" });
    }
});

/**
 * DATABASE & CONNECTIVITY API
 * Combines: db-status, response-time
 * Returns database connection status and server response time
 */

router.get("/connectivity-status", (req, res) => {
    const startTime = Date.now();

    // Check database connection status
    const dbStatus = mongoose.connection.readyState === 1 ? "Connected" : "Not Connected";

    // Calculate response time
    const endTime = Date.now();
    const responseTime = endTime - startTime;

    res.json({
        database: dbStatus,
        responseTime: `${responseTime}ms`
    });
});

/**
 * PROCESSES & NETWORK API
 * Combines: processes, network-interfaces, open-ports
 * Returns information about running processes, network interfaces and open ports
 */

router.get("/processes-network", async (req, res) => {
    try {
        const [processes, networkInterfaces] = await Promise.all([
            si.processes(),
            si.networkInterfaces()
        ]);

        // Get open ports information
        exec("lsof -i -P -n | grep LISTEN", (error, stdout, stderr) => {
            if (error) {
                return res.status(500).json({
                    error: "Failed to fetch open ports",
                    details: stderr
                });
            }

            const lines = stdout.split("\n").filter(Boolean);
            const ports = lines.map(line => line.trim().split(/\s+/)).map(parts => ({
                command: parts[0],
                pid: parts[1],
                user: parts[2],
                port: parts[8],
            }));

            res.json({
                processes: {
                    all: processes.all,
                    running: processes.running,
                    list: processes.list.slice(0, 10) // Return top 10 for brevity
                },
                networkInterfaces: networkInterfaces,
                openPorts: ports
            });
        });
    } catch (err) {
        res.status(500).json({
            error: "Failed to retrieve processes and network info",
            details: err.message
        });
    }
});

/**
 * SYSTEM INFORMATION API
 * Combines: server-time, version, env-vars, hardware-info
 * Returns server time, application version, environment variables and hardware details
 */
router.get("/system-info", async (req, res) => {
    try {
        const [baseboard, bios, chassis] = await Promise.all([
            si.baseboard(),
            si.bios(),
            si.chassis()
        ]);

        const now = new Date();
        const packageJson = require("../package.json");

        res.json({
            serverTime: now.toISOString(),
            timestamp: now.getTime(),
            project: {
                name: packageJson.name || "Unknown",
                version: packageJson.version || "Unknown",
                author: packageJson.author || "Unknown"
            },
            environment: process.env,
            hardware: {
                baseboard: baseboard,
                bios: bios,
                chassis: chassis
            }
        });
    } catch (error) {
        res.status(500).json({
            error: "Failed to get system information",
            details: error.message
        });
    }
});

/**
 * SECURITY & MAINTENANCE API
 * Combines: security-audit, pending-updates, deprecation-warnings, ssl-cert-status
 * Returns security audit results, pending updates, deprecation warnings and SSL certificate status
 */
router.get("/security-status", (req, res) => {
    // Run security audit
    exec("npm audit --json", { cwd: process.cwd() }, (error, stdout, stderr) => {
        let audit = {};
        if (error && !stdout) {
            audit = { error: "Failed to run npm audit", details: stderr };
        } else {
            try {
                audit = JSON.parse(stdout);
            } catch (err) {
                audit = { error: "Failed to parse audit output", details: err.message };
            }
        }

        // Check for pending updates
        exec("apt list --upgradable 2>/dev/null", (updateError, updateStdout, updateStderr) => {
            let updates = { count: 0, updates: [] };
            if (updateError) {
                updates = { error: "Failed to fetch updates", details: updateStderr };
            } else {
                const lines = updateStdout.split("\n").slice(1).filter(Boolean);
                updates = { count: lines.length, updates: lines };
            }

            // Get deprecation warnings
            const warnings = process.report?.getReport()?.header?.warnings || [];

            // Check SSL certificate status
            const certPath = "/path/to/your/certificate.pem"; // adjust this
            let sslStatus = {};
            try {
                const cert = tls.createSecureContext({
                    cert: fs.readFileSync(certPath),
                }).context.getCertificate();

                const expireDate = new Date(cert.valid_to);
                sslStatus = {
                    validFrom: cert.valid_from,
                    validTo: cert.valid_to,
                    expiresInDays: Math.ceil((expireDate - new Date()) / (1000 * 60 * 60 * 24)),
                };
            } catch (sslError) {
                sslStatus = { error: "Failed to parse SSL certificate", details: sslError.message };
            }

            res.json({
                securityAudit: {
                    metadata: audit.metadata,
                    vulnerabilities: audit.vulnerabilities,
                },
                pendingUpdates: updates,
                deprecationWarnings: warnings,
                sslCertificate: sslStatus
            });
        });
    });
});

/**
 * MONITORING & LOGS API
 * Combines: file-watcher-status, system-logs, disk-usage-detail, logged-in-users
 * Returns file watcher status, system logs, disk usage details, and logged-in users
 */
router.get("/monitoring-logs", (req, res) => {
    // Check file watcher status
    let isWatching = false;
    const watcher = chokidar.watch("./", {
        ignored: /node_modules|\.git/,
        persistent: true,
    });

    watcher.on("ready", () => {
        isWatching = true;
    });

    // Get system logs
    exec("tail -n 50 /var/log/syslog", (logError, logStdout, logStderr) => {
        if (logError) {
            return res.status(500).json({
                error: "Failed to fetch logs",
                details: logStderr
            });
        }

        // Get disk usage details
        exec("du -sh /* 2>/dev/null | sort -hr | head -n 10", (diskError, diskStdout, diskStderr) => {
            if (diskError) {
                return res.status(500).json({
                    error: "Failed to get disk usage",
                    details: diskStderr
                });
            }

            const usage = diskStdout.split("\n").filter(Boolean).map(line => {
                const [size, path] = line.trim().split(/\s+/);
                return { path, size };
            });

            // Get logged-in users
            exec("who", (userError, userStdout, userStderr) => {
                if (userError) {
                    return res.status(500).json({
                        error: "Failed to get logged-in users",
                        details: userStderr
                    });
                }

                const users = userStdout.split("\n").filter(Boolean).map((line) => {
                    const [username, terminal, date, time] = line.split(/\s+/);
                    return { username, terminal, time: `${date} ${time}` };
                });

                res.json({
                    fileWatcher: { watching: isWatching },
                    systemLogs: logStdout,
                    diskUsage: { topDirs: usage },
                    loggedInUsers: users
                });
            });
        });
    });
});



/**
 * SERVICE STATUS CHECKER API
 * Accepts a list of URLs and returns their status
 */
router.post("/service-status", async (req, res) => {
    const { urls } = req.body;

    if (!Array.isArray(urls)) {
        return res.status(400).json({ error: "Please send a list of URLs" });
    }

    const results = await Promise.all(
        urls.map(async (url) => {
            try {
                const response = await axios.get(url, { timeout: 3000 });
                return { url, status: response.status };
            } catch (err) {
                return { url, error: err.message };
            }
        })
    );

    // Create logs
    await AdminAuditLog.create({
        action: 'service_status_checked',
        adminId: req.admin._id,
        resourceType: 'system',
        ipAddress: ip,
        userAgent,
        status: 'success',
        severity: 'low',
        metadata: {
            checkedUrls: urls,
            results
        },
        role: req.admin.role,
        department: req.admin.profile?.department
    });

    await AdminActivityDB.create({
        adminId: req.admin._id,
        eventType: 'monitoring',
        eventAction: 'service_status_checked',
        target: {
            targetId: null,
            targetModel: 'System'
        },
        status: 'success',
        ipAddress,
        userAgent,
        eventData: { checkedUrls: urls, results },
        alertSeverity: 'info'
    });

    await Admin.findByIdAndUpdate(req.admin._id, {
        $push: {
            activityLog: {
                action: 'service_status_checked',
                resourceType: 'System',
                resourceId: null,
                details: { checkedUrls: urls, results },
                ipAddress,
                userAgent,
                timestamp
            }
        }
    });


    res.json({ results });
});



// ==========================================
// DATABASE MANAGEMENT ROUTES
// ==========================================

// Get comprehensive database statistics
router.get('/database/stats', authenticateAdmin, async (req, res) => {
    try {
        const mongoose = require('mongoose');
        const db = mongoose.connection.db;

        // Get all collections
        const collections = await db.listCollections().toArray();

        // Count documents in each collection
        const collectionStats = await Promise.all(
            collections.map(async (collection) => {
                const collectionName = collection.name;
                const stats = await db.collection(collectionName).stats();

                // Determine collection category
                let category = 'core';
                if (collectionName.includes('Auth') || collectionName.includes('Token')) {
                    category = 'auth';
                } else if (collectionName.includes('Payment') || collectionName.includes('Subscription')) {
                    category = 'billing';
                } else if (collectionName.includes('Log') || collectionName.includes('Activity')) {
                    category = 'logs';
                }

                return {
                    name: collectionName,
                    count: stats.count,
                    size: stats.size,
                    storageSize: stats.storageSize,
                    indexes: stats.nindexes,
                    avgObjSize: stats.avgObjSize,
                    category: category,
                    status: stats.count > 0 ? 'active' : 'healthy'
                };
            })
        );



        const totalAdmins = await Admin.countDocuments({ isActive: true });
        const totalUsers = await User.countDocuments({ isActive: true });



        // Calculate total storage
        const totalStorage = collectionStats.reduce((sum, col) => sum + col.size, 0);

        // Get index information
        const indexInfo = await Promise.all(
            collections.slice(0, 10).map(async (collection) => {
                const indexes = await db.collection(collection.name).indexes();
                return indexes.map(index => ({
                    collection: collection.name,
                    name: index.name,
                    keys: index.key,
                    type: index.unique ? 'unique' : 'standard',
                    usage: Math.floor(Math.random() * 100), // In production, get real usage stats
                    status: 'optimal'
                }));
            })
        );

        // Performance metrics (mock data - integrate with real monitoring)
        const performance = {
            avgQueryTime: Math.floor(Math.random() * 50) + 10,
            slowQueries: Math.floor(Math.random() * 5),
            cacheHitRate: Math.floor(Math.random() * 20) + 75
        };

        res.json({
            overview: {
                totalRecords: collectionStats.reduce((sum, col) => sum + col.count, 0),
                totalAdmins,
                totalUsers,
                storageUsed: totalStorage,
                totalCollections: collections.length
            },
            collections: collectionStats,
            indexes: indexInfo.flat(),
            performance,
            recentActivity: [] // Implement based on your activity log structure
        });

    } catch (error) {
        console.error('Database stats error:', error);
        res.status(500).json({
            message: 'Failed to fetch database statistics',
            error: error.message
        });
    }
});

// Reset collection test data
router.post('/database/reset/:collectionName', authenticateAdmin, async (req, res) => {
    try {
        const { collectionName } = req.params;
        const mongoose = require('mongoose');
        const db = mongoose.connection.db;

        // Security check - only allow specific collections
        const allowedCollections = ['test_users', 'test_data', 'demo_records'];
        if (!allowedCollections.includes(collectionName)) {
            return res.status(403).json({
                message: 'Cannot reset this collection for security reasons'
            });
        }

        await db.collection(collectionName).deleteMany({});

        // Log the action
        await req.admin.logActivity(
            'reset_collection',
            'database',
            null,
            { collectionName },
            req.ip,
            req.get('user-agent')
        );

        res.json({
            message: `Collection ${collectionName} reset successfully`,
            deletedCount: 0
        });

    } catch (error) {
        console.error('Reset collection error:', error);
        res.status(500).json({
            message: 'Failed to reset collection',
            error: error.message
        });
    }
});

// Export collection data
router.get('/database/export/:collectionName', authenticateAdmin, async (req, res) => {
    try {
        const { collectionName } = req.params;
        const mongoose = require('mongoose');
        const db = mongoose.connection.db;

        const data = await db.collection(collectionName).find({}).limit(1000).toArray();

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="${collectionName}_${Date.now()}.json"`);
        res.json(data);

        // Log the export
        await req.admin.logActivity(
            'export_collection',
            'database',
            null,
            { collectionName, recordCount: data.length },
            req.ip,
            req.get('user-agent')
        );

    } catch (error) {
        console.error('Export collection error:', error);
        res.status(500).json({
            message: 'Failed to export collection',
            error: error.message
        });
    }
});

// Optimize database indexes
router.post('/database/optimize-indexes', authenticateAdmin, async (req, res) => {
    try {
        const mongoose = require('mongoose');
        const db = mongoose.connection.db;

        // Get all collections
        const collections = await db.listCollections().toArray();

        const optimizationResults = await Promise.all(
            collections.map(async (collection) => {
                const collectionName = collection.name;

                try {
                    // Get current indexes
                    const currentIndexes = await db.collection(collectionName).indexes();

                    // Rebuild indexes for the collection
                    await db.collection(collectionName).reIndex();

                    // Get updated index information
                    const updatedIndexes = await db.collection(collectionName).indexes();

                    return {
                        collection: collectionName,
                        status: 'optimized',
                        indexesBefore: currentIndexes.length,
                        indexesAfter: updatedIndexes.length,
                        message: `Successfully optimized ${updatedIndexes.length} indexes`
                    };
                } catch (error) {
                    return {
                        collection: collectionName,
                        status: 'failed',
                        error: error.message,
                        message: `Failed to optimize indexes for ${collectionName}`
                    };
                }
            })
        );

        // Log the optimization action
        await req.admin.logActivity(
            'optimize_indexes',
            'database',
            null,
            {
                collectionsOptimized: optimizationResults.filter(r => r.status === 'optimized').length,
                totalCollections: collections.length
            },
            req.ip,
            req.get('user-agent')
        );

        res.json({
            message: `Index optimization completed for ${collections.length} collections`,
            results: optimizationResults,
            summary: {
                totalCollections: collections.length,
                optimized: optimizationResults.filter(r => r.status === 'optimized').length,
                failed: optimizationResults.filter(r => r.status === 'failed').length,
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('Optimize indexes error:', error);
        res.status(500).json({
            message: 'Failed to optimize database indexes',
            error: error.message
        });
    }
});





module.exports = router;