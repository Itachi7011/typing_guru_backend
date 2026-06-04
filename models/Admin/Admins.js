const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const AdminSchema = new mongoose.Schema({
    firstName: {
        type: String,
        required: true,
        trim: true,
        maxlength: 50
    },
    lastName: {
        type: String,
        required: true,
        trim: true,
        maxlength: 50
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        validate: {
            validator: function (v) {
                return /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(v);
            },
            message: "Please enter a valid email"
        }
    },
    username: {
        type: String,
        unique: true,
        sparse: true,
        trim: true,
        minlength: 3,
        maxlength: 30
    },
    usertype: {
        type: String,
        default: "Admin"
    },
    password: {
        type: String,
        required: function () {
            return !this.oauth.googleId && !this.oauth.githubId;
        },
        minlength: 12
    },
    phoneNumber: {
        type: String,
        validate: {
            validator: function (v) {
                return !v || /^\+?[1-9]\d{1,14}$/.test(v);
            },
            message: "Please enter a valid phone number"
        }
    },
    profile: {
        avatar: {
            data: String,
            publicId: String,
            format: String,
            originalName: String,
            contentType: String,
        },
        title: {
            type: String,
            trim: true,
            maxlength: 100
        },
        department: {
            type: String,
            enum: ['Engineering', 'Sales', 'Marketing', 'Support', 'Operations', 'Finance', 'HR', 'Executive'],
            default: 'Engineering'
        },
        bio: {
            type: String,
            maxlength: 500
        }
    },
    role: {
        type: String,
        enum: ['Super Admin', 'Admin', 'Support', 'Billing', 'Read Only'],
        default: 'Admin',
        required: true
    },
    permissions: {
        users: {
            view: { type: Boolean, default: false },
            create: { type: Boolean, default: false },
            edit: { type: Boolean, default: false },
            delete: { type: Boolean, default: false }
        },
        clients: {
            view: { type: Boolean, default: false },
            create: { type: Boolean, default: false },
            edit: { type: Boolean, default: false },
            delete: { type: Boolean, default: false },
            suspend: { type: Boolean, default: false }
        },
        billing: {
            view: { type: Boolean, default: false },
            create: { type: Boolean, default: false },
            edit: { type: Boolean, default: false },
            refund: { type: Boolean, default: false }
        },
        settings: {
            view: { type: Boolean, default: false },
            edit: { type: Boolean, default: false }
        },
        analytics: {
            view: { type: Boolean, default: false },
            export: { type: Boolean, default: false }
        },
        api: {
            manage: { type: Boolean, default: false },
            monitor: { type: Boolean, default: false }
        },
        auditLogs: {
            manage: { type: Boolean, default: false },
            monitor: { type: Boolean, default: false },
            edit: { type: Boolean, default: false },
            delete: { type: Boolean, default: false },
        },
        activityLogs: {
            manage: { type: Boolean, default: false },
            monitor: { type: Boolean, default: false },
            edit: { type: Boolean, default: false },
            delete: { type: Boolean, default: false },
        }
    },
    mfa: {
        enabled: { type: Boolean, default: false },

        methods: {
            totp: {
                enabled: { type: Boolean, default: false },
                secret: { type: String, select: false }, // Don't expose
                lastUsed: { type: Date },
                createdAt: { type: Date, default: Date.now },
                devices: [{
                    name: { type: String }, // e.g., "Chrome on MacBook"
                    ip: { type: String },
                    userAgent: { type: String },
                    lastUsed: { type: Date },
                    addedAt: { type: Date, default: Date.now }
                }]
            },

            backupCodes: {
                enabled: { type: Boolean, default: false },
                codes: [{
                    code: { type: String, select: false }, // Hashed preferably
                    used: { type: Boolean, default: false },
                    usedAt: { type: Date, default: null },
                    createdAt: { type: Date, default: Date.now },
                    expiresAt: { type: Date, default: null }
                }],
                lastUsed: { type: Date },
                generatedAt: { type: Date }
            },

            // Optional: for future extensibility
            webauthn: {
                enabled: { type: Boolean, default: false },
                credentials: [{
                    id: { type: String },
                    publicKey: { type: String },
                    name: { type: String }, // e.g. "Work Laptop"
                    addedAt: { type: Date, default: Date.now },
                    lastUsed: { type: Date }
                }]
            },

            sms: {
                enabled: { type: Boolean, default: false },
                phoneNumber: { type: String },
                lastUsed: { type: Date },
                verified: { type: Boolean, default: false }
            }
        },

        lastUsed: { type: Date },
        recoveryEmail: { type: String }, // Optional, for backup recovery flows
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now }
    },
    security: {
        lastPasswordChange: {
            type: Date,
            default: Date.now
        },
        passwordHistory: [{
            password: {
                type: String,
                select: false
            },
            changedAt: {
                type: Date,
                default: Date.now
            }
        }],
        ipWhitelist: [{
            ip: String,
            description: String,
            createdAt: {
                type: Date,
                default: Date.now
            }
        }],
        sessionTimeout: {
            type: Number,
            default: 3600 // 1 hour in seconds
        }
    },
    otp: {
        type: String,
        // required: true,
        // unique: true
    },
    securityQuestion: {
        question: {
            type: String,
            trim: true,
            maxlength: 255
        },
        answerHash: {
            type: String,
            select: false // store hashed version of the answer
        },
        lastUpdated: {
            type: Date,
            default: Date.now
        }
    },

    securityPin: {
        pinHash: {
            type: String,
            select: false // hashed 6-digit PIN
        },
        enabled: {
            type: Boolean,
            default: false
        },
        lastUpdated: {
            type: Date,
            default: Date.now
        },
        // To prevent brute force attacks
        failedAttempts: {
            type: Number,
            default: 0
        },
        // To temporarily lock the account
        lockedUntil: {
            type: Date
        }
    },

    emergencyAccess: {
        isLockedDown: { type: Boolean, default: false },
        allowedRoles: [{
            type: String,
            enum: ['Super Admin', 'Admin']
        }],
        allowedIPs: [String],
        triggeredBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: `${process.env.APP_NAME}_Admin`
        },
        triggeredAt: Date
    },


    securityTraining: {
        completed: { type: Boolean, default: false },
        completedAt: Date,
        version: String // e.g., '2025-Q3'
    },


    securityAlerts: {
        failedLoginAttempts: {
            type: Number,
            default: 0
        },
        lastFailedAttempt: Date,
        notifyOnNewDevice: {
            type: Boolean,
            default: true
        }
    },
    loginSecurity: {
        requireMfaOnNewIp: { type: Boolean, default: true },
        requireMfaOnNewDevice: { type: Boolean, default: true },
        sessionHijackDetection: { type: Boolean, default: true },
        geoLocking: {
            enabled: { type: Boolean, default: false },
            allowedCountries: [String] // e.g. ['US', 'CA']
        }
    },
    trustedDevices: [{
        deviceId: String, // UUID generated from fingerprint
        userAgent: String,
        ipAddress: String,
        addedAt: {
            type: Date,
            default: Date.now
        },
        lastUsedAt: Date,
        trusted: {
            type: Boolean,
            default: false
        },
        location: {
            city: String,
            region: String,
            country: String
        }
    }],



    notifications: {
        email: {
            newClients: { type: Boolean, default: true },
            billingIssues: { type: Boolean, default: true },
            systemAlerts: { type: Boolean, default: true },
            securityAlerts: { type: Boolean, default: true }
        },
        push: {
            criticalAlerts: { type: Boolean, default: true }
        }
    },
    assignedClients: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: `${process.env.APP_NAME}_Client`
    }],
    apiAccess: {
        hasApiAccess: {
            type: Boolean,
            default: false
        },
        apiKey: {
            type: String,
            select: false
        },
        apiSecret: {
            type: String,
            select: false
        },
        rateLimit: {
            requests: {
                type: Number,
                default: 1000
            },
            timeframe: {
                type: Number, // in minutes
                default: 15
            }
        },
        lastUsed: Date
    },
    threatDetection: {
        anomalousBehavior: {
            loginVelocity: {
                enabled: { type: Boolean, default: false },
                threshold: { type: Number, default: 3 }
            },
            impossibleTravel: {
                enabled: { type: Boolean, default: false },
                maxDistance: { type: Number, default: 500 } // km
            },
            bruteForceDetection: {
                enabled: { type: Boolean, default: false },
                maxAttempts: { type: Number, default: 5 },
                lockoutDuration: { type: Number, default: 900 } // seconds
            }
        },
        compromisedCredentials: {
            breachDetection: {
                enabled: { type: Boolean, default: false }
            },
            passwordSprayDetection: {
                enabled: { type: Boolean, default: false }
            }
        }
    },

    advancedSessionSecurity: {
        deviceFingerprinting: {
            enabled: { type: Boolean, default: false }
        },
        tokenBinding: {
            enabled: { type: Boolean, default: false }
        },
        dynamicSessionTimeout: {
            enabled: { type: Boolean, default: false }
        },
        concurrentSessionControl: {
            forceLogoutPrevious: { type: Boolean, default: false }
        }
    },

    riskBasedAuthentication: {
        enabled: { type: Boolean, default: false },
        riskFactors: {
            ipReputation: {
                weight: { type: Number, default: 0, min: 0, max: 1 }
            },
            geoVelocity: {
                weight: { type: Number, default: 0, min: 0, max: 1 }
            },
            deviceReputation: {
                weight: { type: Number, default: 0, min: 0, max: 1 }
            }
        }
    },

    securityMonitoring: {
        realTimeAlerts: {
            suspiciousLogins: {
                enabled: { type: Boolean, default: false }
            },
            configurationChanges: {
                enabled: { type: Boolean, default: false }
            },
            privilegeEscalation: {
                enabled: { type: Boolean, default: false }
            }
        },
        securityReports: {
            daily: {
                enabled: { type: Boolean, default: false }
            },
            weekly: {
                enabled: { type: Boolean, default: false }
            }
        }
    },

    zeroTrust: {
        continuousValidation: {
            deviceHealth: {
                enabled: { type: Boolean, default: false }
            },
            userBehavior: {
                enabled: { type: Boolean, default: false }
            },
            sessionHealth: {
                enabled: { type: Boolean, default: false }
            }
        },
        microSegmentation: {
            networkPolicies: {
                enabled: { type: Boolean, default: false }
            },
            apiBoundaries: {
                enabled: { type: Boolean, default: false }
            }
        }
    },

    securityHeaders: {
        csp: {
            enabled: { type: Boolean, default: false },
            directives: { type: Map, of: String }
        },
        hsts: {
            enabled: { type: Boolean, default: false },
            maxAge: { type: Number, default: 31536000 }
        }
    },

    apiSecurity: {
        jwt: {
            keyRotation: {
                enabled: { type: Boolean, default: false },
                rotationInterval: { type: Number, default: 90 } // days
            }
        },
        tokenLifetime: {
            accessToken: { type: Number, default: 3600 }, // 1 hour
            refreshToken: { type: Number, default: 2592000 } // 30 days
        }
    },

    cryptography: {
        encryption: {
            algorithm: { type: String, default: 'AES-256-GCM' },
            keyManagement: {
                keyRotation: {
                    interval: { type: Number, default: 90 } // days
                }
            }
        }
    },

    botProtection: {
        enrollment: {
            captcha: {
                enabled: { type: Boolean, default: false }
            },
            behaviorAnalysis: {
                enabled: { type: Boolean, default: false }
            }
        }
    },


    pendingApprovals: [{
        action: String, // 'delete_client', 'change_api_key', etc.
        payload: mongoose.Schema.Types.Mixed,
        requestedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: `${process.env.APP_NAME}_Admin`
        },
        approvedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: `${process.env.APP_NAME}_Admin`
        },
        status: {
            type: String,
            enum: ['pending', 'approved', 'rejected'],
            default: 'pending'
        },
        createdAt: { type: Date, default: Date.now },
        resolvedAt: Date
    }],

    themePreference: {
        type: String,
        enum: ['light', 'dark', 'system'],
        default: 'system'
    },
    languagePreference: {
        type: String,
        default: 'en-US'
    },
    timeZone: {
        type: String,
        default: 'UTC'
    },
    statusMessage: {
        type: String,
        maxlength: 140,
        trim: true
    },
    loginHistory: [{
        ipAddress: String,
        deviceType: {
            type: String,
            enum: ['desktop', 'mobile', 'tablet', 'unknown']
        },
        userAgent: String,
        timestamp: {
            type: Date,
            default: Date.now
        },
        location: {
            city: String,
            region: String,
            country: String
        }
    }],
    emailPreferences: {
        newsletters: { type: Boolean, default: false },
        productUpdates: { type: Boolean, default: true },
        featureAnnouncements: { type: Boolean, default: true }
    },
    privacySettings: {
        showProfileToOtherAdmins: {
            type: Boolean,
            default: true
        },
        shareActivityLog: {
            type: Boolean,
            default: false
        }
    },
    webAuthn: {
        credentials: [{
            credentialId: String,
            publicKey: String,
            signCount: Number,
            transports: [String],
            addedAt: {
                type: Date,
                default: Date.now
            }
        }],
        lastUsed: Date
    },
    browserSessions: [{
        deviceId: String,
        userAgent: String,
        ipAddress: String,
        lastActiveAt: {
            type: Date,
            default: Date.now
        },
        createdAt: {
            type: Date,
            default: Date.now
        },
        location: {
            city: String,
            region: String,
            country: String
        }
    }],
    customAttributes: {
        type: Map,
        of: mongoose.Schema.Types.Mixed
    },
    activityLog: [{
        action: {
            type: String,
            required: true
        },
        resourceType: {
            type: String,
            enum: ['Client', 'User', 'Billing', 'Settings', 'API', 'System', 'Admin', 'AuditLog', 'ActivityLog', 'admin']
        },
        resourceId: mongoose.Schema.Types.ObjectId,
        details: mongoose.Schema.Types.Mixed,
        ipAddress: String,
        userAgent: String,
        timestamp: {
            type: Date,
            default: Date.now
        }
    }],
    immutableAuditLog: [{
        actionType: String,
        performedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: `${process.env.APP_NAME}_Admin`
        },
        performedAt: { type: Date, default: Date.now },
        originalData: mongoose.Schema.Types.Mixed,
        newData: mongoose.Schema.Types.Mixed,
        reason: String,
        critical: { type: Boolean, default: false }
    }],

    emailVerified: {
        type: Boolean,
        default: false
    },
    emailVerificationHistory: [{
        action: {
            type: String,
            enum: ['email_sent', 'email_verified', 'code_resent', 'verification_failed']
        },
        timestamp: {
            type: Date,
            default: Date.now
        },
        ipAddress: String,
        userAgent: String,
        details: mongoose.Schema.Types.Mixed
    }], emailVerificationAttempts: {
        type: Number,
        default: 0
    },
    lastVerificationEmailSent: Date,
    verificationEmailsSentToday: {
        type: Number,
        default: 0
    },
    verificationEmailsSentDate: {
        type: Date,
        default: Date.now
    },
    phoneVerified: {
        type: Boolean,
        default: false
    },
    isActive: {
        type: Boolean,
        default: true
    },
    isSuspended: {
        type: Boolean,
        default: false
    },
    suspensionReason: String,
    suspendedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: `${process.env.APP_NAME}_Admin`
    },
    suspendedAt: Date,
    lastLogin: Date,
    lastActivity: Date,
    loginAttempts: {
        type: Number,
        default: 0
    },
    lockUntil: Date,
    tokens: [{
        token: {
            type: String,
            required: true
        },
        tokenType: {
            type: String,
            enum: ['access', 'refresh', 'password_reset', 'email_verification', 'api'],
            default: 'access'
        },
        expiration: {
            type: Date,
            required: true
        },
        createdAt: {
            type: Date,
            default: Date.now
        },
        isBlocked: {
            type: Boolean,
            default: false
        },
        isActive: {
            type: Boolean,
            default: true
        },
        deviceInfo: {
            userAgent: String,
            ipAddress: String,
            deviceId: String,
            deviceType: {
                type: String,
                enum: ['desktop', 'mobile', 'tablet', 'unknown']
            }
        },
        scope: {
            type: [String],
            enum: [
                'admin:read',
                'admin:write',
                'admin:delete',
                'client:read',
                'client:write',
                'client:delete',
                'user:read',
                'user:write',
                'user:delete',
                'billing:read',
                'billing:write',
                'settings:read',
                'settings:write',
                'analytics:read',
                'api:manage'
            ],
            default: ['admin:read']
        }
    }],
    oauth: {
        googleId: String,
        githubId: String,
        profile: mongoose.Schema.Types.Mixed
    },
    registerUsing: {
        type: String,
        enum: ['invitation', 'registration', 'google-auth', 'github-auth'],
        default: 'invitation'
    },
    invitedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: `${process.env.APP_NAME}_Admin`
    },
    invitationToken: String,
    invitationExpires: Date,
    invitationAccepted: {
        type: Boolean,
        default: false
    },
    metadata: mongoose.Schema.Types.Mixed
}, {
    timestamps: true,
    // toJSON: {
    //     virtuals: true,
    //     transform: function (doc, ret) {
    //         delete ret.password;
    //         delete ret.mfa;
    //         delete ret.security;
    //         // delete ret.tokens;
    //         return ret;
    //     }
    // }
});

// Indexes
// AdminSchema.index({ email: 1 });
AdminSchema.index({ 'tokens.token': 1 });
AdminSchema.index({ isActive: 1, isSuspended: 1 });
AdminSchema.index({ role: 1 });
AdminSchema.index({ 'permissions.clients.view': 1 });
AdminSchema.index({ lastActivity: 1 });

// Virtuals
AdminSchema.virtual('fullName').get(function () {
    return `${this.firstName} ${this.lastName}`;
});

AdminSchema.virtual('isLocked').get(function () {
    return !!(this.lockUntil && this.lockUntil > Date.now());
});

AdminSchema.virtual('requiresPasswordChange').get(function () {
    const ninetyDays = 90 * 24 * 60 * 60 * 1000;
    return Date.now() - this.security.lastPasswordChange > ninetyDays;
});

// Methods
AdminSchema.methods.comparePassword = async function (candidatePassword) {
    if (!this.password) return false;
    return await bcrypt.compare(candidatePassword, this.password);
};

AdminSchema.methods.incrementLoginAttempts = async function () {
    const MAX_ATTEMPTS = 5;
    const LOCKOUT_DURATION = 2 * 60 * 60 * 1000; // 2 hours

    if (this.lockUntil && this.lockUntil < Date.now()) {
        this.loginAttempts = 1;
        this.lockUntil = undefined;
        return this.save();
    }

    this.loginAttempts += 1;

    if (this.loginAttempts >= MAX_ATTEMPTS && !this.isLocked) {
        this.lockUntil = Date.now() + LOCKOUT_DURATION;
    }

    return this.save();
};

AdminSchema.methods.generateApiKeys = function () {
    const apiKey = `adm_${crypto.randomBytes(24).toString('hex')}`;
    const apiSecret = `adm_sec_${crypto.randomBytes(32).toString('hex')}`;

    this.apiAccess.apiKey = apiKey;
    this.apiAccess.apiSecret = apiSecret;
    this.apiAccess.lastUsed = new Date();

    return { apiKey, apiSecret };
};

AdminSchema.methods.generateMfaSecret = function () {
    const secret = crypto.randomBytes(20).toString('base64');
    this.mfa.secret = secret;
    return secret;
};

AdminSchema.methods.generateBackupCodes = function (count = 10) {
    const codes = [];
    for (let i = 0; i < count; i++) {
        codes.push({
            code: crypto.randomBytes(8).toString('hex').toUpperCase(),
            used: false,
            createdAt: new Date()
        });
    }
    this.mfa.backupCodes = codes;
    return codes;
};

AdminSchema.methods.canPerform = function (resource, action) {
    if (!this.permissions[resource]) return false;
    return this.permissions[resource][action] === true;
};

// Method to get admin's active sessions
AdminSchema.methods.getActiveSessions = function () {
    const now = new Date();
    return this.browserSessions.filter(session => {
        const sessionExpiry = new Date(session.lastActiveAt.getTime() + (this.security.sessionTimeout * 1000));
        return sessionExpiry > now;
    });
};

// Method to revoke all sessions except current
AdminSchema.methods.revokeAllSessions = function (currentDeviceId) {
    this.browserSessions = this.browserSessions.filter(session =>
        session.deviceId === currentDeviceId
    );

    // Also revoke all tokens except current
    this.tokens = this.tokens.filter(token =>
        token.deviceInfo && token.deviceInfo.deviceId === currentDeviceId
    );

    return this.save();
};

// Method to update last activity
AdminSchema.methods.updateActivity = function (ipAddress, userAgent) {
    this.lastActivity = new Date();

    // Update or create browser session
    const deviceId = require('crypto').createHash('md5').update(userAgent + ipAddress).digest('hex');
    const existingSession = this.browserSessions.find(session => session.deviceId === deviceId);

    if (existingSession) {
        existingSession.lastActiveAt = new Date();
    } else {
        this.browserSessions.push({
            deviceId,
            userAgent,
            ipAddress,
            lastActiveAt: new Date(),
            createdAt: new Date()
        });
    }

    // Keep only last 10 sessions
    if (this.browserSessions.length > 10) {
        this.browserSessions = this.browserSessions
            .sort((a, b) => b.lastActiveAt - a.lastActiveAt)
            .slice(0, 10);
    }

    return this.save();
};

// Static method to get admins by department
AdminSchema.statics.findByDepartment = function (department) {
    return this.find({
        'profile.department': department,
        isActive: true,
        isSuspended: false
    });
};

// Static method to get admin statistics
AdminSchema.statics.getStatistics = async function () {
    const totalAdmins = await this.countDocuments({ isActive: true });
    const verifiedAdmins = await this.countDocuments({
        isActive: true,
        emailVerified: true
    });
    const mfaEnabledAdmins = await this.countDocuments({
        isActive: true,
        'mfa.enabled': true
    });

    const roleStats = await this.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: '$role', count: { $sum: 1 } } }
    ]);

    const departmentStats = await this.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: '$profile.department', count: { $sum: 1 } } }
    ]);

    return {
        totalAdmins,
        verifiedAdmins,
        mfaEnabledAdmins,
        verificationRate: totalAdmins > 0 ? (verifiedAdmins / totalAdmins * 100) : 0,
        mfaAdoptionRate: totalAdmins > 0 ? (mfaEnabledAdmins / totalAdmins * 100) : 0,
        roleDistribution: roleStats,
        departmentDistribution: departmentStats
    };
};

AdminSchema.methods.getPublicProfile = function () {
    return {
        id: this._id,
        firstName: this.firstName,
        lastName: this.lastName,
        email: this.email,
        username: this.username,
        usertype: this.usertype,
        profile: this.profile,
        role: this.role,
        department: this.profile.department,
        isActive: this.isActive,
        emailVerified: this.emailVerified,
        mfaEnabled: this.mfa.enabled,
        lastLogin: this.lastLogin,
        createdAt: this.createdAt,
        updatedAt: this.updatedAt
    };
};

AdminSchema.methods.logActivity = function (action, resourceType, resourceId, details, ipAddress, userAgent) {
    this.activityLog.push({
        action,
        resourceType,
        resourceId,
        details,
        ipAddress,
        userAgent,
        timestamp: new Date()
    });

    this.lastActivity = new Date();
    return this.save();
};

const NUM_CODES = 10;
const CODE_LENGTH = 10;
const SALT_ROUNDS = 12;

// Add to AdminSchema.methods
AdminSchema.methods.generateBackupCodes = async function () {
    const now = new Date();
    const codes = [];

    for (let i = 0; i < NUM_CODES; i++) {
        const rawCode = crypto.randomBytes(CODE_LENGTH / 2).toString('hex').toUpperCase(); // e.g. 'F3A9D1C4E0'
        const hashedCode = await bcrypt.hash(rawCode, SALT_ROUNDS);

        codes.push({
            code: hashedCode,
            used: false,
            createdAt: now,
            expiresAt: null // You can add expiry logic if needed
        });
    }

    this.mfa.methods.backupCodes.codes = codes;
    this.mfa.methods.backupCodes.generatedAt = now;
    this.mfa.methods.backupCodes.enabled = true;

    // Return the plain codes so they can be shown once to the admin
    return codes.map(c => c.code); // Optionally return rawCodes if needed in the controller
};

AdminSchema.methods.setSecurityPin = async function (rawPin) {
    if (!rawPin) throw new Error('PIN is required');
    const salt = await bcrypt.genSalt(12);
    this.security.securityPin.pinHash = await bcrypt.hash(rawPin, salt);
    this.security.securityPin.enabled = true;
    this.security.securityPin.lastUpdated = new Date();
};

AdminSchema.methods.compareSecurityPin = async function (candidatePin) {
    const hash = this.security?.securityPin?.pinHash;
    if (!hash) return false;
    return await bcrypt.compare(candidatePin, hash);
};

AdminSchema.pre('save', async function (next) {
    if (
        this.isNew &&
        this.mfa?.enabled &&
        this.mfa.methods?.backupCodes?.enabled &&
        (!this.mfa.methods.backupCodes.codes || this.mfa.methods.backupCodes.codes.length === 0)
    ) {
        await this.generateBackupCodes(); // Use the method defined above
    }
    next();
});


// --- Constants ---
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 2 * 60 * 60 * 1000; // 2 hours in milliseconds
const PIN_LOCKOUT_DURATION_MS = 30 * 60 * 1000; // 30 minutes for PIN
const MAX_PIN_ATTEMPTS = 3;
const PASSWORD_HISTORY_LIMIT = 5;
const NUM_BACKUP_CODES = 10;
const BACKUP_CODE_LENGTH = 10; // 5 bytes hex = 10 characters

// ===============================================
// Pre-save Hooks (for hashing)
// ===============================================

// Handle password hashing and history before saving

AdminSchema.pre('save', async function (next) {
    if (this.isModified('password') && this.password) {
        try {
            // 1. Hash the password
            const salt = await bcrypt.genSalt(SALT_ROUNDS);
            this.password = await bcrypt.hash(this.password, salt);

            // 2. Add to password history and update last change date
            this.security.passwordHistory.unshift({
                password: this.password,
                changedAt: new Date()
            });

            // Keep only the last 5 passwords
            this.security.passwordHistory = this.security.passwordHistory.slice(0, PASSWORD_HISTORY_LIMIT);
            this.security.lastPasswordChange = new Date();

        } catch (error) {
            return next(error);
        }
    }

    // Ensure mfa.methods.backupCodes are generated if mfa is enabled on creation
    if (
        this.isNew &&
        this.mfa?.enabled &&
        this.mfa.methods?.backupCodes?.enabled &&
        (!this.mfa.methods.backupCodes.codes || this.mfa.methods.backupCodes.codes.length === 0)
    ) {
        // This relies on an async method that must be handled carefully,
        // which is why the code for this method is defined first in the methods section below.
        // In a real application, consider generating codes outside of `pre('save')` for better flow control.
        // For demonstration, we'll keep the logic here simple by assuming the codes are generated elsewhere or handle the async nature.
    }

    // Update the updated at timestamp for MFA changes
    if (this.isModified('mfa')) {
        this.mfa.updatedAt = new Date();
    }

    next();
});

AdminSchema.methods.setSecurityPin = async function (rawPin) {
    if (!rawPin) {
        throw new Error('Security PIN is required.');
    }

    const salt = await bcrypt.genSalt(SALT_ROUNDS);

    // Hash and store the PIN
    this.securityPin.pinHash = await bcrypt.hash(rawPin, salt);
    this.securityPin.enabled = true;
    this.securityPin.lastUpdated = new Date();
    this.securityPin.failedAttempts = 0; // Reset attempts on successful set
    this.securityPin.lockedUntil = undefined;

    return this.save();
};

AdminSchema.methods.compareSecurityPin = async function (candidatePin) {
    // 1. Check for active lock
    if (this.securityPin.lockedUntil && this.securityPin.lockedUntil > Date.now()) {
        await this.save(); // Save to ensure lock status is persisted
        return false;
    }

    // 2. Clear expired lock
    if (this.securityPin.lockedUntil && this.securityPin.lockedUntil <= Date.now()) {
        this.securityPin.failedAttempts = 0;
        this.securityPin.lockedUntil = undefined;
    }

    const hash = this.securityPin?.pinHash;
    if (!hash || !this.securityPin.enabled) {
        await this.save();
        return false;
    }

    const isMatch = await bcrypt.compare(candidatePin, hash);

    if (isMatch) {
        // Success: Reset attempts
        this.securityPin.failedAttempts = 0;
        this.securityPin.lockedUntil = undefined;
        this.securityPin.lastUsed = new Date();
        await this.save();
        return true;
    } else {
        // Failure: Increment attempts and apply lock if needed
        this.securityPin.failedAttempts += 1;
        if (this.securityPin.failedAttempts >= MAX_PIN_ATTEMPTS) {
            this.securityPin.lockedUntil = new Date(Date.now() + PIN_LOCKOUT_DURATION_MS);
        }
        await this.save();
        return false;
    }
};

AdminSchema.methods.generateBackupCodes = async function () {
    const now = new Date();
    const rawCodes = [];
    const hashedCodes = [];

    for (let i = 0; i < NUM_BACKUP_CODES; i++) {
        const rawCode = crypto.randomBytes(BACKUP_CODE_LENGTH / 2).toString('hex').toUpperCase();
        const hashedCode = await bcrypt.hash(rawCode, SALT_ROUNDS);

        rawCodes.push(rawCode);
        hashedCodes.push({
            code: hashedCode,
            used: false,
            createdAt: now,
            expiresAt: null
        });
    }

    this.mfa.methods.backupCodes.codes = hashedCodes;
    this.mfa.methods.backupCodes.generatedAt = now;
    this.mfa.methods.backupCodes.enabled = true;

    // The document must be saved by the caller, but we return the raw codes for display.
    return rawCodes;
};

AdminSchema.methods.verifyAndUseBackupCode = async function (candidateCode) {
    const backupCodes = this.mfa.methods.backupCodes.codes;
    if (!backupCodes || !this.mfa.methods.backupCodes.enabled) {
        return false;
    }

    for (let codeEntry of backupCodes) {
        if (!codeEntry.used && codeEntry.code) {
            const isMatch = await bcrypt.compare(candidateCode, codeEntry.code);
            if (isMatch) {
                codeEntry.used = true;
                codeEntry.usedAt = new Date();
                this.mfa.methods.backupCodes.lastUsed = new Date();
                return true;
            }
        }
    }
    return false;
};

AdminSchema.methods.checkPasswordHistory = async function (candidatePassword) {
    if (!candidatePassword) return false;

    for (const historyEntry of this.security.passwordHistory) {
        if (historyEntry.password) {
            const isMatch = await bcrypt.compare(candidatePassword, historyEntry.password);
            if (isMatch) return true;
        }
    }
    return false;
};

// Static methods
AdminSchema.statics.findByEmail = function (email) {
    return this.findOne({ email: email.toLowerCase() }).select('+tokens');
};


AdminSchema.statics.findActiveAdmins = function () {
    return this.find({ isActive: true, isSuspended: false });
};

AdminSchema.statics.findByRole = function (role) {
    return this.find({ role, isActive: true, isSuspended: false });
};

// Add these methods to AdminSchema.methods
AdminSchema.methods.initializeSecuritySections = function () {
    // Initialize any missing security sections with defaults
    const securitySections = [
        'threatDetection',
        'advancedSessionSecurity',
        'riskBasedAuthentication',
        'securityMonitoring',
        'zeroTrust',
        'securityHeaders',
        'apiSecurity',
        'cryptography',
        'botProtection'
    ];

    securitySections.forEach(section => {
        if (!this[section]) {
            this[section] = {};
        }
    });
};

// Method to get security overview
AdminSchema.methods.getSecurityOverview = function () {
    return {
        mfaEnabled: this.mfa?.enabled || false,
        securityPinEnabled: this.securityPin?.enabled || false,
        threatDetectionEnabled: this.threatDetection?.anomalousBehavior?.loginVelocity?.enabled || false,
        riskBasedAuthEnabled: this.riskBasedAuthentication?.enabled || false,
        zeroTrustEnabled: this.zeroTrust?.continuousValidation?.deviceHealth?.enabled || false,
        lastSecurityUpdate: this.updatedAt,
        securityScore: this.calculateSecurityScore()
    };
};
// Method to reset PIN attempts and unlock
AdminSchema.methods.resetPinAttempts = function () {
    this.securityPin.failedAttempts = 0;
    this.securityPin.lockedUntil = undefined;
    return this.save();
};

// Check if PIN is currently locked
AdminSchema.methods.isPinLocked = function () {
    return !!(this.securityPin.lockedUntil && this.securityPin.lockedUntil > Date.now());
};

AdminSchema.methods.incrementPinAttempts = function () {
    // If there's no lock or the lock has expired, reset attempts
    if (this.securityPin.lockedUntil && this.securityPin.lockedUntil <= Date.now()) {
        this.securityPin.failedAttempts = 0;
        this.securityPin.lockedUntil = undefined;
    }

    // Increment failed attempts
    this.securityPin.failedAttempts += 1;

    // Apply lock if maximum attempts reached
    if (this.securityPin.failedAttempts >= MAX_PIN_ATTEMPTS) {
        this.securityPin.lockedUntil = new Date(Date.now() + PIN_LOCKOUT_DURATION_MS);
    }

    return this.save();
};

// Get PIN lock status with remaining time
AdminSchema.methods.getPinLockStatus = function () {
    if (!this.securityPin.lockedUntil) {
        return { locked: false, remainingTime: 0 };
    }

    const now = Date.now();
    if (this.securityPin.lockedUntil <= now) {
        // Lock has expired, reset it
        this.securityPin.failedAttempts = 0;
        this.securityPin.lockedUntil = undefined;
        return { locked: false, remainingTime: 0 };
    }

    return {
        locked: true,
        remainingTime: Math.ceil((this.securityPin.lockedUntil - now) / 1000), // seconds
        lockedUntil: this.securityPin.lockedUntil
    };
};

// Disable security PIN
AdminSchema.methods.disableSecurityPin = function () {
    this.securityPin.enabled = false;
    this.securityPin.failedAttempts = 0;
    this.securityPin.lockedUntil = undefined;
    this.securityPin.lastUpdated = new Date();
    return this.save();
};

// Reset PIN with new value
AdminSchema.methods.resetSecurityPin = async function (newPin) {
    if (!newPin) {
        throw new Error('New PIN is required');
    }

    const salt = await bcrypt.genSalt(SALT_ROUNDS);
    this.securityPin.pinHash = await bcrypt.hash(newPin, salt);
    this.securityPin.lastUpdated = new Date();
    this.securityPin.failedAttempts = 0;
    this.securityPin.lockedUntil = undefined;

    return this.save();
};

// Method to calculate security score (basic implementation)
AdminSchema.methods.calculateSecurityScore = function () {
    let score = 0;
    let maxScore = 100;

    // MFA (25 points)
    if (this.mfa?.enabled) score += 25;

    // Security PIN (10 points)
    if (this.securityPin?.enabled) score += 10;

    // Password strength (15 points)
    if (this.security?.passwordHistory?.length >= 5) score += 15;

    // IP Whitelist (10 points)
    if (this.security?.ipWhitelist?.length > 0) score += 10;

    // Advanced security features (40 points)
    if (this.threatDetection?.anomalousBehavior?.loginVelocity?.enabled) score += 10;
    if (this.riskBasedAuthentication?.enabled) score += 10;
    if (this.zeroTrust?.continuousValidation?.deviceHealth?.enabled) score += 10;
    if (this.securityMonitoring?.realTimeAlerts?.suspiciousLogins?.enabled) score += 10;

    return Math.min(score, maxScore);
};

AdminSchema.pre('save', function (next) {
    // Initialize security sections if they don't exist
    if (this.isNew) {
        this.initializeSecuritySections();
    }
    next();
});

module.exports = mongoose.model(`${process.env.APP_NAME}_Admin`, AdminSchema);