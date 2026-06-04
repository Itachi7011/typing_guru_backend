const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
    // Required identification
    clientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: `${process.env.APP_NAME}_Client`,
        required: true,
        index: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        default: () => new mongoose.Types.ObjectId(),
        required: true,
        index: true
    },
    registrationFormId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: `${process.env.APP_NAME}_Customised_Register_Page`,
        required: true,
        index: true
    },

    // Basic fields (from registration form configuration)
    name: {
        type: String,
        required: true,
        trim: true
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

    avatar: {
        data: String,
        publicId: String,
        format: String,
        originalName: String,
        contentType: String,
    },

    password: {
        type: String,
        required: true,
        minlength: 8
    },
    phone: {
        type: String,
        // required: true,
        sparse: true // Allows null/undefined but enforces uniqueness for non-null
    },
    usertype: {
        type: String,
        required: true,
        default: "User"
    },

    otp: {
        type: String,
        sparse: true // This allows multiple null values but enforces uniqueness for non-null
    },
    // Custom attributes (dynamic based on registration form)
    customAttributes: {
        type: Map,
        of: mongoose.Schema.Types.Mixed,
        default: {}
    },
    apiKey: {
        type: String,
    },

    // Authentication status
    emailVerified: {
        type: Boolean,
        default: false
    },
    phoneVerified: {
        type: Boolean,
        default: false
    },

    preferences: {
        communication: {
            marketingEmails: { type: Boolean, default: false },
            securityAlerts: { type: Boolean, default: true },
            productUpdates: { type: Boolean, default: false }
        },
        ui: {
            theme: { type: String, enum: ['light', 'dark', 'auto'], default: 'auto' },
            language: { type: String, default: 'en' }
        }
    },
    // twoFactorEnabled: {
    //     type: Boolean,
    //     default: false
    // },

    mfa: {
        enabled: { type: Boolean, default: false },

        methods: {
            totp: {
                enabled: { type: Boolean, default: false },
                secret: { type: String, select: false },
                lastUsed: { type: Date },
                createdAt: { type: Date, default: Date.now },
                devices: [{
                    name: { type: String },
                    ip: { type: String },
                    userAgent: { type: String },
                    lastUsed: { type: Date },
                    addedAt: { type: Date, default: Date.now }
                }]
            },

            backupCodes: {
                enabled: { type: Boolean, default: false },
                codes: [{
                    code: { type: String, select: false },
                    used: { type: Boolean, default: false },
                    usedAt: { type: Date, default: null },
                    createdAt: { type: Date, default: Date.now },
                    expiresAt: { type: Date, default: null }
                }],
                lastUsed: { type: Date },
                generatedAt: { type: Date }
            },

            webauthn: {
                enabled: { type: Boolean, default: false },
                credentials: [{
                    id: { type: String },
                    publicKey: { type: String },
                    name: { type: String },
                    addedAt: { type: Date, default: Date.now },
                    lastUsed: { type: Date }
                }]
            },

            sms: {
                enabled: { type: Boolean, default: false },
                phoneNumber: { type: String },
                lastUsed: { type: Date },
                verified: { type: Boolean, default: false }
            },

            emailOtp: {
                enabled: { type: Boolean, default: false },
                email: { type: String },
                lastSentAt: { type: Date },
                lastUsed: { type: Date },
                verified: { type: Boolean, default: false }
            },

            pushNotification: {
                enabled: { type: Boolean, default: false },
                providers: [{
                    name: { type: String }, // e.g., "Duo", "Authy"
                    deviceId: { type: String },
                    pushToken: { type: String },
                    lastUsed: { type: Date },
                    addedAt: { type: Date, default: Date.now }
                }]
            },


            physicalSecurityKeys: {
                enabled: { type: Boolean, default: false },
                devices: [{
                    serialNumber: { type: String },
                    vendor: { type: String }, // e.g., "Yubico", "RSA"
                    addedAt: { type: Date, default: Date.now },
                    lastUsed: { type: Date }
                }]
            },
            
            fingerprint: {
                enabled: { type: Boolean, default: false },
                devices: [{
                    deviceId: { type: String },
                    fingerprintHash: { type: String }, // hashed representation
                    name: { type: String },
                    addedAt: { type: Date, default: Date.now },
                    lastUsed: { type: Date }
                }]
            },

            irisScan: {
                enabled: { type: Boolean, default: false },
                devices: [{
                    deviceId: { type: String },
                    irisTemplateHash: { type: String },
                    name: { type: String },
                    addedAt: { type: Date, default: Date.now },
                    lastUsed: { type: Date }
                }]
            },

            retinaScan: {
                enabled: { type: Boolean, default: false },
                devices: [{
                    deviceId: { type: String },
                    retinaTemplateHash: { type: String },
                    name: { type: String },
                    addedAt: { type: Date, default: Date.now },
                    lastUsed: { type: Date }
                }]
            },

            faceRecognition: {
                enabled: { type: Boolean, default: false },
                devices: [{
                    deviceId: { type: String },
                    faceTemplateHash: { type: String },
                    name: { type: String },
                    addedAt: { type: Date, default: Date.now },
                    lastUsed: { type: Date }
                }]
            },

            voiceRecognition: {
                enabled: { type: Boolean, default: false },
                devices: [{
                    deviceId: { type: String },
                    voicePrintHash: { type: String },
                    name: { type: String },
                    addedAt: { type: Date, default: Date.now },
                    lastUsed: { type: Date }
                }]
            },

            palmVein: {
                enabled: { type: Boolean, default: false },
                devices: [{
                    deviceId: { type: String },
                    palmVeinHash: { type: String },
                    name: { type: String },
                    addedAt: { type: Date, default: Date.now },
                    lastUsed: { type: Date }
                }]
            },

            behavioral: {
                enabled: { type: Boolean, default: false },
                profile: {
                    keystrokePatternHash: { type: String },
                    gaitPatternHash: { type: String },
                    mouseMovementHash: { type: String },
                    updatedAt: { type: Date, default: Date.now }
                },
                lastUsed: { type: Date }
            },

        },


        lastUsed: { type: Date },
        recoveryEmail: { type: String },
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now }
    },
    notificationSettings: {
        preferences: {
            communication: {
                marketingEmails: { type: Boolean, default: false },
                securityAlerts: { type: Boolean, default: true },
                productUpdates: { type: Boolean, default: false },
                newsletter: { type: Boolean, default: false },
                promotionalOffers: { type: Boolean, default: false }
            },
            ui: {
                theme: { type: String, enum: ['light', 'dark', 'auto'], default: 'auto' },
                language: { type: String, default: 'en' }
            }
        },
        securityAlerts: {
            failedLoginAttempts: { type: Number, default: 0 },
            notifyOnNewDevice: { type: Boolean, default: true },
            notifyOnSuspiciousActivity: { type: Boolean, default: true },
            notifyOnPasswordChange: { type: Boolean, default: true },
            notifyOnMFAChanges: { type: Boolean, default: true }
        },
        securityMonitoring: {
            realTimeAlerts: {
                suspiciousLogins: {
                    enabled: { type: Boolean, default: true },
                    channels: [{ type: String, enum: ['email', 'push', 'sms'] }]
                },
                configurationChanges: {
                    enabled: { type: Boolean, default: true },
                    channels: [{ type: String, enum: ['email', 'push', 'sms'] }]
                },
                privilegeEscalation: {
                    enabled: { type: Boolean, default: true },
                    channels: [{ type: String, enum: ['email', 'push', 'sms'] }]
                },
                dataBreachAttempts: {
                    enabled: { type: Boolean, default: true },
                    channels: [{ type: String, enum: ['email', 'push', 'sms'] }]
                }
            },
            securityReports: {
                daily: {
                    enabled: { type: Boolean, default: false },
                    channels: [{ type: String, enum: ['email', 'push', 'sms'] }]
                },
                weekly: {
                    enabled: { type: Boolean, default: true },
                    channels: [{ type: String, enum: ['email', 'push', 'sms'] }]
                },
                monthly: {
                    enabled: { type: Boolean, default: true },
                    channels: [{ type: String, enum: ['email', 'push', 'sms'] }]
                }
            }
        },
        customAlerts: [{
            name: String,
            type: { type: String, enum: ['info', 'warning', 'critical'] },
            enabled: { type: Boolean, default: true },
            channels: [{ type: String, enum: ['email', 'push', 'sms'] }],
            conditions: mongoose.Schema.Types.Mixed,
            createdAt: { type: Date, default: Date.now }
        }],
        notificationChannels: {
            email: {
                enabled: { type: Boolean, default: true },
                address: String
            },
            push: {
                enabled: { type: Boolean, default: true }
            },
            sms: {
                enabled: { type: Boolean, default: false },
                number: String
            },
            webhook: {
                enabled: { type: Boolean, default: false },
                url: String
            }
        },
        quietHours: {
            enabled: { type: Boolean, default: false },
            startTime: { type: String, default: '22:00' },
            endTime: { type: String, default: '08:00' },
            timezone: { type: String, default: 'UTC' }
        }
    },
    // ENHANCE the existing passwordPolicy in UserSchema
    passwordPolicy: {
        minLength: { type: Number, default: 8 },
        maxLength: { type: Number, default: 128 },
        requireNumbers: { type: Boolean, default: true },
        requireSymbols: { type: Boolean, default: true },
        requireUppercase: { type: Boolean, default: true },
        requireLowercase: { type: Boolean, default: true },
        allowCommonPasswords: { type: Boolean, default: false },
        maxPasswordAge: { type: Number, default: 90 }, // days
        passwordHistorySize: { type: Number, default: 5 },
        temporaryPasswordExpiry: { type: Number, default: 24 } // hours
    },

    verificationToken: String,
    verificationTokenExpires: Date,

    // Social logins
    socialLogins: {
        google: {
            id: String,
            profile: mongoose.Schema.Types.Mixed
        },
        github: {
            id: String,
            profile: mongoose.Schema.Types.Mixed
        },
        facebook: {
            id: String,
            profile: mongoose.Schema.Types.Mixed
        },
        linkedin: {
            id: String,
            profile: mongoose.Schema.Types.Mixed
        },
        apple: {
            id: String,
            profile: mongoose.Schema.Types.Mixed
        },
        microsoft: {
            id: String,
            profile: mongoose.Schema.Types.Mixed
        },
        twitter: {
            id: String,
            profile: mongoose.Schema.Types.Mixed
        },
        instagram: {
            id: String,
            profile: mongoose.Schema.Types.Mixed
        },
        snapchat: {
            id: String,
            profile: mongoose.Schema.Types.Mixed
        }
    },
    magicLinks: {
        type: Boolean,
        default: false
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
    loginSecurity: {
        requireMfaOnNewIp: { type: Boolean, default: true },
        requireMfaOnNewDevice: { type: Boolean, default: true },
        sessionHijackDetection: { type: Boolean, default: true },
        geoLocking: {
            enabled: { type: Boolean, default: false },
            allowedCountries: [String] // e.g. ['US', 'CA']
        }
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

    threatDetection: {
        anomalousBehavior: {
            loginVelocity: { enabled: Boolean, threshold: Number }, // logins from unusual locations
            impossibleTravel: { enabled: Boolean, maxDistance: Number }, // logins from geographically impossible locations
            bruteForceDetection: {
                enabled: Boolean,
                maxAttempts: Number,
                lockoutDuration: Number,
                ipBased: Boolean,
                userBased: Boolean
            },
            botDetection: {
                enabled: Boolean,
                captcha: {
                    enabled: Boolean,
                    provider: String, // recaptcha, hcaptcha
                    threshold: Number
                }
            }
        },
        compromisedCredentials: {
            breachDetection: {
                enabled: Boolean,
                checkOnLogin: Boolean,
                monitorDarkWeb: Boolean
            },
            passwordSprayDetection: { enabled: Boolean }
        }
    },

    advancedSessionSecurity: {
        deviceFingerprinting: {
            enabled: Boolean,
            factors: ['canvas', 'webgl', 'fonts', 'screen', 'timezone', 'plugins'],
            confidenceThreshold: Number
        },
        tokenBinding: {
            enabled: Boolean,
            type: String // TLS, HTTP
        },
        dynamicSessionTimeout: {
            enabled: Boolean,
            riskBased: Boolean, // shorter for high-risk sessions
            activityBased: Boolean // extend on user activity
        },
        concurrentSessionControl: {
            maxSessions: Number,
            allowMultipleDevices: Boolean,
            forceLogoutPrevious: Boolean
        }
    },
    securityHeaders: {
        csp: {
            enabled: Boolean,
            directives: Map,
            reportOnly: Boolean,
            reportUri: String
        },
        hsts: {
            enabled: Boolean,
            maxAge: Number,
            includeSubDomains: Boolean,
            preload: Boolean
        },
        featurePolicy: Map,
        permissionsPolicy: Map
    },
    apiSecurity: {
        jwt: {
            signingAlgorithms: ['RS256', 'ES256', 'HS256'],
            keyRotation: {
                enabled: Boolean,
                rotationInterval: Number,
                gracePeriod: Number
            }
        },
        oauth2: {
            pkce: { enabled: Boolean, mandatory: Boolean },
            jwtProfile: { enabled: Boolean },
            assertionFramework: { enabled: Boolean }
        },
        tokenLifetime: {
            accessToken: Number,
            refreshToken: Number,
            idToken: Number
        }
    },
    compliance: {
        certifications: ['SOC2', 'ISO27001', 'GDPR', 'HIPAA', 'PCI-DSS'],
        dataResidency: {
            enabled: Boolean,
            regions: [String],
            defaultRegion: String
        },
        privacy: {
            dataMinimization: { enabled: Boolean },
            rightToErasure: { enabled: Boolean, automation: String },
            consentManagement: { enabled: Boolean }
        }
    },
    riskBasedAuthentication: {
        enabled: Boolean,
        riskFactors: {
            ipReputation: { weight: Number },
            geoVelocity: { weight: Number },
            deviceReputation: { weight: Number },
            behaviorBiometrics: { weight: Number },
            threatIntelligence: { weight: Number }
        },
        riskScoring: {
            low: { action: { type: String, enum: ['allow', 'stepup_auth', 'block'] } },
            medium: { action: { type: String, enum: ['allow', 'stepup_auth', 'block'] } },
            high: { action: { type: String, enum: ['allow', 'stepup_auth', 'block'] } }
        },
        stepUpAuthentication: {
            triggers: [{ type: String }],
            methods: [{ type: String }]
        }
    },

    securityMonitoring: {
        realTimeAlerts: {
            suspiciousLogins: { enabled: Boolean, channels: ['email', 'webhook', 'slack'] },
            configurationChanges: { enabled: Boolean },
            privilegeEscalation: { enabled: Boolean }
        },
        siemIntegration: {
            splunk: { enabled: Boolean, endpoint: String },
            sumologic: { enabled: Boolean, endpoint: String },
            datadog: { enabled: Boolean, endpoint: String }
        },
        securityReports: {
            daily: { enabled: Boolean },
            weekly: { enabled: Boolean },
            monthly: { enabled: Boolean }
        }
    },
    cryptography: {
        encryption: {
            algorithm: String, // AES-256-GCM
            keyManagement: {
                hsm: { enabled: Boolean, provider: String },
                keyRotation: { interval: Number },
                keyVersioning: { enabled: Boolean }
            }
        },
        secretsManagement: {
            apiKeys: { encryption: Boolean, rotation: Boolean },
            webhookSecrets: { encryption: Boolean, rotation: Boolean }
        }
    },
    botProtection: {
        enrollment: {
            captcha: { provider: String, difficulty: String },
            behaviorAnalysis: { enabled: Boolean },
            deviceAttestation: { enabled: Boolean }
        },
        runtime: {
            requestPatterns: { enabled: Boolean },
            trafficAnalysis: { enabled: Boolean },
            challengeMechanisms: { enabled: Boolean }
        }
    },
    zeroTrust: {
        continuousValidation: {
            deviceHealth: { enabled: Boolean, checks: [String] },
            userBehavior: { enabled: Boolean, baseline: Object },
            sessionHealth: { enabled: Boolean, metrics: [String] }
        },
        microSegmentation: {
            networkPolicies: { enabled: Boolean },
            apiBoundaries: { enabled: Boolean }
        }
    },

    // AI Anomaly Scoring (Future-Proof)
    anomalyScores: [{
        type: String, // 'login', 'action', 'device'
        score: Number, // 0-100
        explanation: String,
        timestamp: { type: Date, default: Date.now }
    }],

    activityLog: [{
        action: String,
        resourceType: String,
        resourceId: mongoose.Schema.Types.ObjectId,
        performedBy: {
            id: mongoose.Schema.Types.ObjectId,
            model: String
        },
        ipAddress: String,
        userAgent: String,
        timestamp: Date,
        details: mongoose.Schema.Types.Mixed
    }],

    immutableAuditLog: [{
        actionType: {
            type: String,
            required: true // e.g. 'data_change', 'account_suspend', 'permission_grant'
        },
        resourceType: {
            type: String,
            enum: ['Admin', 'Client', 'User', 'Billing', 'Settings', 'API', 'System', 'Session', 'Payment', 'Custom'],
            required: true
        },
        resourceId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true
        },
        performedBy: {
            id: {
                type: mongoose.Schema.Types.ObjectId,
                required: true
            },
            model: {
                type: String,
                enum: ['Admin', 'Client', 'User', `${process.env.APP_NAME}_Client`, `${process.env.APP_NAME}_Admin`, `${process.env.APP_NAME}_User`],
                required: true
            }
        },
        performedAt: {
            type: Date,
            default: Date.now
        },
        originalData: mongoose.Schema.Types.Mixed, // Keep it minimal; only sensitive deltas
        newData: mongoose.Schema.Types.Mixed,
        reason: {
            type: String,
            maxlength: 500
        },
        critical: {
            type: Boolean,
            default: false
        }
    }],

    tokens: [{
        token: {
            type: String,
        },
        tokenType: {
            type: String,
            enum: ['access', 'refresh', 'password_reset', 'email_verification'],
            default: 'access'
        },
        sessionId: {
            type: String
        },
        expiration: {
            type: Date,
            default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
        },
        createdAt: {
            type: Date,
            default: Date.now
        },
        isRevoked: {
            type: Boolean,
            default: false
        },
        isActive: {
            type: Boolean,
            default: true
        },
        isDeleted: {
            type: Boolean,
            default: false
        },
        deviceInfo: {
            userAgent: {
                type: String
            },
            ipAddress: {
                type: String
            }
        },
        scope: {
            type: [String],
            enum: [
                // Client scopes
                'client:read',
                'client:write',
                'client:delete',
                'client:profile:read',
                'client:profile:write',
                'client:billing:read',
                'client:billing:write',
                'client:subscription:read',
                'client:subscription:write',
                'client:api:read',
                'client:api:write',
                'client:files:read',
                'client:files:write',
                'client:settings:read',
                'client:settings:write',

                // User scopes
                'user:read',
                'user:write',
                'user:delete',
                'user:profile:read',
                'user:profile:write',
                'user:settings:read',
                'user:settings:write'
            ],
            default: ['client:read']
        }
    }],

    // Security & status
    loginAttempts: {
        type: Number,
        default: 0
    },

    lockUntil: Date,
    lastLogin: Date,
    isActive: {
        type: Boolean,
        default: true
    },
    isBlocked: {
        type: Boolean,
        default: false
    },

    blockedAt: {
        type: Date,

    },
    isDeleted: {
        type: Boolean,
        default: false
    },
    blockedReason: String,

    // Metadata
    ipAddress: String,
    userAgent: String,
    timezone: String,
    preferredLanguage: {
        type: String,
        default: 'en'
    },

    // Audit trail
    lastPasswordChange: Date,
    passwordHistory: [{
        password: String,
        changedAt: Date
    }]

}, {
    timestamps: true,
    toJSON: {
        transform: function (doc, ret) {
            delete ret.password;
            delete ret.passwordHistory;
            delete ret.verificationToken;
            delete ret.verificationTokenExpires;
            return ret;
        }
    }
});

// Indexes for performance
UserSchema.index({ email: 1, clientId: 1 }, { unique: true });
UserSchema.index({ clientId: 1, isActive: 1 });
UserSchema.index({ 'socialLogins.google.id': 1 });
UserSchema.index({ 'socialLogins.github.id': 1 });
UserSchema.index({ createdAt: 1 });

// Add these indexes for better performance
UserSchema.index({ email: 1, clientId: 1, registrationFormId: 1 });
UserSchema.index({ 'mfa.methods.backupCodes.codes': 1 });
UserSchema.index({ lastLogin: -1 });
UserSchema.index({ createdAt: -1 });



// Virtual for checking if account is locked
UserSchema.virtual('isLocked').get(function () {
    return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Single Pre Save Hook for Hash password and security pin before saving and other MFA and other features too.
UserSchema.pre('save', async function (next) {

    // ============================================
    // 1. INITIALIZATION FOR NEW DOCUMENTS
    // ============================================
    if (this.isNew) {
        // Set userId for new documents
        this.userId = this._id;

        // Initialize mfa.methods if it doesn't exist or has incorrect structure
        if (!this.mfa.methods || typeof this.mfa.methods !== 'object') {
            this.mfa.methods = {};
        }

        // Ensure backupCodes has the correct structure
        if (!this.mfa.methods.backupCodes || typeof this.mfa.methods.backupCodes !== 'object') {
            this.mfa.methods.backupCodes = {
                enabled: false,
                codes: [],
                lastUsed: null,
                generatedAt: null
            };
        }

        // Generate backup codes for new users who have MFA enabled with backup codes
        if (this.mfa.enabled && this.mfa.methods.backupCodes.enabled) {
            try {
                console.log('🔐 Generating backup codes for new user');
                await this.generateBackupCodes();
            } catch (error) {
                console.error('❌ Backup code generation error:', error);
                return next(error);
            }
        }
    }

    // ============================================
    // 2. PASSWORD HANDLING (ONLY ONCE)
    // ============================================
    if (this.isModified('password')) {


        try {
            // Clean the password - remove any invisible characters
            const cleanPassword = this.password.trim();

            // Use consistent salt rounds
            const saltRounds = 12;
            const salt = await bcrypt.genSalt(saltRounds);
            this.password = await bcrypt.hash(cleanPassword, salt);



            // Update password history
            if (!this.passwordHistory) {
                this.passwordHistory = [];
            }

            if (this.passwordHistory.length >= 5) {
                this.passwordHistory.shift();
            }

            this.passwordHistory.push({
                password: this.password,
                changedAt: new Date()
            });

            this.lastPasswordChange = new Date();
            console.log('✅ Password hashed and history updated');

        } catch (error) {
            console.error('❌ Password hashing error:', error);
            return next(error);
        }
    }

    // ============================================
    // 3. SECURITY PIN HANDLING
    // ============================================
    if (this.isModified('securityPin.pinHash') && this.securityPin.pinHash) {
        console.log('🔢 PRE-SAVE HOOK - Security PIN is being modified');
        console.log('🔢 PRE-SAVE HOOK - PIN details:', {
            rawPinValue: this.securityPin.pinHash,
            rawPinLength: this.securityPin.pinHash.length,
            rawPinType: typeof this.securityPin.pinHash,
            isAlreadyHashed: this.securityPin.pinHash.startsWith('$2b$'),
            modificationPaths: this.modifiedPaths()
        });

        try {
            // Only hash if it's not already hashed
            if (!this.securityPin.pinHash.startsWith('$2b$')) {
                console.log('🔢 PRE-SAVE HOOK - Hashing PIN...');
                const salt = await bcrypt.genSalt(12);
                const pinBeforeHash = this.securityPin.pinHash;
                this.securityPin.pinHash = await bcrypt.hash(this.securityPin.pinHash, salt);
                console.log('🔢 PRE-SAVE HOOK - PIN hashing completed:', {
                    pinBeforeHash: pinBeforeHash,
                    pinBeforeHashLength: pinBeforeHash.length,
                    hashedPinPrefix: this.securityPin.pinHash.substring(0, 20) + '...',
                    hashedPinLength: this.securityPin.pinHash.length
                });
            } else {
                console.log('🔢 PRE-SAVE HOOK - PIN already hashed, skipping re-hash');
            }
            this.securityPin.lastUpdated = new Date();
            console.log('✅ PRE-SAVE HOOK - Security PIN processing completed');
        } catch (error) {
            console.error('❌ PRE-SAVE HOOK - Security PIN hashing error:', error);
            return next(error);
        }
    }

    // ============================================
    // 4. EMAIL VERIFICATION RESET ON EMAIL CHANGE
    // ============================================
    if (this.isModified('email') && this.emailVerified) {
        console.log('📧 Email changed - resetting email verification');
        this.emailVerified = false; // Require re-verification on email change
    }

    // ============================================
    // 5. MFA BACKUP CODES REGENERATION (FOR EXISTING USERS)
    // ============================================
    if (!this.isNew && this.isModified('mfa.methods.backupCodes') &&
        this.mfa.enabled && this.mfa.methods.backupCodes.enabled) {
        try {
            const remainingCodes = this.getRemainingBackupCodes();
            if (remainingCodes < 3) {
                console.log('🔐 Regenerating backup codes (low remaining)');
                await this.generateBackupCodes();
            }
        } catch (error) {
            console.error('❌ Backup code regeneration error:', error);
            // Don't block the save if backup code regeneration fails
        }
    }

    // ============================================
    // 6. AUDIT LOG UPDATES
    // ============================================
    if (this.isModified('mfa') || this.isModified('securityPin') || this.isModified('password')) {
        console.log('📝 Security-related changes detected - would update audit log');
        // You can add audit log updates here if needed
    }

    // ============================================
    // 7. VALIDATION AND SANITIZATION
    // ============================================
    if (this.isModified('email')) {
        // Ensure email is lowercase
        this.email = this.email.toLowerCase();
        console.log('📧 Email normalized to lowercase');
    }

    // Validate custom attributes structure
    if (this.isModified('customAttributes') && this.customAttributes) {
        try {
            // Ensure customAttributes is a proper Map or object
            if (!(this.customAttributes instanceof Map) && typeof this.customAttributes === 'object') {
                this.customAttributes = new Map(Object.entries(this.customAttributes));
            }
        } catch (error) {
            console.warn('⚠️ Could not normalize customAttributes:', error);
        }
    }

    next();
});

// Add this to your UserSchema methods section (after the existing methods)
UserSchema.methods.generateBackupCodes = async function () {
    const crypto = require('crypto');
    const bcrypt = require('bcryptjs');

    const NUM_CODES = 10;
    const CODE_LENGTH = 10;
    const SALT_ROUNDS = 12;

    const now = new Date();
    const rawCodes = [];
    const hashedCodes = [];

    for (let i = 0; i < NUM_CODES; i++) {
        const rawCode = crypto.randomBytes(CODE_LENGTH / 2).toString('hex').toUpperCase();
        const hashedCode = await bcrypt.hash(rawCode, SALT_ROUNDS);

        rawCodes.push(rawCode);
        hashedCodes.push({
            code: hashedCode,
            used: false,
            createdAt: now,
            expiresAt: null
        });
    }

    // Safely initialize the backupCodes structure
    if (!this.mfa.methods.backupCodes) {
        this.mfa.methods.backupCodes = {
            enabled: false,
            codes: [],
            lastUsed: null,
            generatedAt: null
        };
    }

    this.mfa.methods.backupCodes.codes = hashedCodes;
    this.mfa.methods.backupCodes.generatedAt = now;
    this.mfa.methods.backupCodes.enabled = true;

    return rawCodes;
};
// Add this method to verify and use backup codes
UserSchema.methods.verifyAndUseBackupCode = async function (candidateCode) {
    // Safely check if backupCodes exists and has the correct structure
    if (!this.mfa.methods.backupCodes ||
        !this.mfa.methods.backupCodes.codes ||
        !Array.isArray(this.mfa.methods.backupCodes.codes) ||
        !this.mfa.methods.backupCodes.enabled) {
        return false;
    }

    const backupCodes = this.mfa.methods.backupCodes.codes;

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
// Add this pre-save hook (place it with your other pre-save hooks)



// Add this method to check how many backup codes are left
UserSchema.methods.getRemainingBackupCodes = function () {
    if (!this.mfa.methods.backupCodes ||
        !this.mfa.methods.backupCodes.codes ||
        !Array.isArray(this.mfa.methods.backupCodes.codes)) {
        return 0;
    }

    return this.mfa.methods.backupCodes.codes.filter(code => !code.used).length;
};

UserSchema.statics.findByIdWithPin = function (id) {
    return this.findById(id).select('+securityPin.pinHash');
};

// Add this method to your UserSchema
UserSchema.methods.handleOAuthLogin = function (provider, profile) {
    this.socialLogins[provider] = {
        id: profile.id,
        profile: profile
    };
    this.lastLogin = new Date();
    return this.save();
};

// Compare password method
UserSchema.methods.comparePassword = async function (candidatePassword) {


    if (!this.password) {
        console.log('❌ No password hash stored');
        return false;
    }

    try {
        // Clean the candidate password (same as during registration)
        const cleanCandidate = candidatePassword.trim();


        const isMatch = await bcrypt.compare(cleanCandidate, this.password);


        if (!isMatch) {
            console.log('❌ Password mismatch details:');
            console.log('   Stored hash:', this.password);

            // Debug: Create a new hash to see if it matches
            const testHash = await bcrypt.hash(cleanCandidate, 12);
            console.log('   Test hash:', testHash);
            console.log('   Hashes equal?', testHash === this.password);

            // Check if it's a timing issue
            const testCompare = await bcrypt.compare(cleanCandidate, this.password);
            console.log('   Retry comparison:', testCompare);
        }

        return isMatch;
    } catch (error) {
        console.error('❌ Bcrypt comparison error:', error);
        return false;
    }
};

UserSchema.methods.verifyAndRehashPassword = async function (candidatePassword) {
    try {
        const isMatch = await this.comparePassword(candidatePassword);

        if (isMatch) {
            // Check if password needs rehashing (if using different salt rounds)
            const needsRehash = !this.password.startsWith('$2b$12$');

            if (needsRehash) {
                console.log('🔄 Rehashing password with consistent salt rounds');
                this.password = candidatePassword; // This will trigger the pre-save hook
                await this.save();
            }
        }

        return isMatch;
    } catch (error) {
        console.error('Verify and rehash error:', error);
        return false;
    }
};


// Check if password was used before
UserSchema.methods.isPasswordUsedBefore = async function (newPassword) {
    for (const history of this.passwordHistory) {
        if (await bcrypt.compare(newPassword, history.password)) {
            return true;
        }
    }
    return false;
};

// Increment login attempts
UserSchema.methods.incrementLoginAttempts = async function () {
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

// Reset login attempts
UserSchema.methods.resetLoginAttempts = function () {
    this.loginAttempts = 0;
    this.lockUntil = undefined;
    return this.save();
};

// Compare security pin method
UserSchema.methods.compareSecurityPin = async function (candidatePin) {
    console.log('🔢 PIN COMPARE - Starting comparison:', {
        candidatePin: candidatePin,
        candidatePinLength: candidatePin?.length,
        candidatePinCharacters: candidatePin?.split(''),
        hasSecurityPinObject: !!this.securityPin,
        securityPinEnabled: this.securityPin?.enabled,
        hasPinHash: !!this.securityPin?.pinHash,
        pinHashLength: this.securityPin?.pinHash?.length,
        pinHashPrefix: this.securityPin?.pinHash?.substring(0, 20) + '...'
    });

    if (!this.securityPin || !this.securityPin.pinHash) {
        console.log('❌ PIN COMPARE - No security PIN configured or no pinHash');
        return false;
    }

    if (!this.securityPin.enabled) {
        console.log('❌ PIN COMPARE - Security PIN is not enabled');
        return false;
    }

    try {
        console.log('🔢 PIN COMPARE - Calling bcrypt.compare...');
        const isMatch = await bcrypt.compare(candidatePin, this.securityPin.pinHash);
        console.log('🔢 PIN COMPARE - bcrypt.compare result:', isMatch);

        if (!isMatch) {
            console.log('🔢 PIN COMPARE - PINs do not match. Details:', {
                candidatePin: candidatePin,
                storedHashPrefix: this.securityPin.pinHash.substring(0, 30) + '...'
            });
        }

        return isMatch;
    } catch (error) {
        console.error('❌ PIN COMPARE - bcrypt.compare error:', error);
        console.error('❌ PIN COMPARE - Error details:', {
            candidatePin: candidatePin,
            candidatePinLength: candidatePin?.length,
            pinHashLength: this.securityPin.pinHash?.length
        });
        return false;
    }
};

// Increment security pin attempts
UserSchema.methods.incrementPinAttempts = async function () {
    const MAX_PIN_ATTEMPTS = 5;
    const PIN_LOCKOUT_DURATION = 30 * 60 * 1000; // 30 minutes lockout

    const pinSecurity = this.securityPin;

    if (pinSecurity.lockedUntil && pinSecurity.lockedUntil < Date.now()) {
        // Reset attempts if lockout has expired
        pinSecurity.failedAttempts = 1;
        pinSecurity.lockedUntil = undefined;
        return this.save();
    }

    pinSecurity.failedAttempts += 1;

    if (pinSecurity.failedAttempts >= MAX_PIN_ATTEMPTS && !pinSecurity.lockedUntil) {
        // Apply new lockout
        pinSecurity.lockedUntil = Date.now() + PIN_LOCKOUT_DURATION;
    }

    return this.save();
};

// Reset security pin attempts
UserSchema.methods.resetPinAttempts = function () {
    this.securityPin.failedAttempts = 0;
    this.securityPin.lockedUntil = undefined;
    return this.save();
};

// Add to UserSchema
UserSchema.methods.initiatePasswordReset = function () {
    this.verificationToken = crypto.randomBytes(32).toString('hex');
    this.verificationTokenExpires = Date.now() + 3600000; // 1 hour
    return this.save();
};


// Get public profile (safe for frontend)
UserSchema.methods.getPublicProfile = function () {
    return {
        id: this._id,
        name: this.name,
        email: this.email,
        phone: this.phone,
        usertype: this.usertype,
        customAttributes: this.customAttributes,
        emailVerified: this.emailVerified,
        phoneVerified: this.phoneVerified,
        loginAttempts: this.loginAttempts,
        preferences: this.preferences,
        notificationSettings: this.notificationSettings,
        lockUntil: this.lockUntil,
        lastLogin: this.lastLogin,
        isBlocked: this.isBlocked,
        isDeleted: this.isDeleted,
        timezone: this.timezone,
        preferredLanguage: this.preferredLanguage,
        isActive: this.isActive,
        createdAt: this.createdAt,
        updatedAt: this.updatedAt,
        loginCount: this.loginCount
    };
};

module.exports = mongoose.model(`${process.env.APP_NAME}_User`, UserSchema);