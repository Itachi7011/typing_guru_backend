// models/SubscriptionPlan.js
const mongoose = require('mongoose');

const supportLevelResponseMap = {
  COMMUNITY: 72,
  EMAIL: 48,
  CHAT: 24,
  PHONE: 4,
  DEDICATED: 1
};

const FeatureSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  key: {
    type: String,
    required: true,
    uppercase: true,
    trim: true
  },
  value: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  description: {
    type: String,
    trim: true
  }
});

const PlanLimitationSchema = new mongoose.Schema({
  maxUsers: {
    type: Number,
    default: null // null means unlimited
  },
  maxDevicesPerUser: {
    type: Number,
    default: 5
  },
  maxSessions: {
    type: Number,
    default: null
  },
  maxApiCalls: {
    type: Number,
    default: 1000
  },
  maxApiKeysAllowed: {
    type: Number,
    default: 1
  },
  maxAuditLogsRetention: {
    type: Number, // in days
    default: 30
  },
  maxCustomRoles: {
    type: Number,
    default: 5
  },
  rateLimit: {
    requests: {
      type: Number,
      default: 100
    },
    timeframe: {
      type: Number, // in minutes
      default: 15
    }
  },
  maxMfaMethods: {
    type: Number,
    default: 1
  },
  maxStorageInMB: {
    type: Number,
    default: null // null = unlimited
  }
  ,
  maxBiometricDevices: {
    type: Number,
    default: 0
  },
  maxTrustedDevices: {
    type: Number,
    default: 5
  },
  maxCustomAttributes: {
    type: Number,
    default: 5
  },
  maxSecurityPolicies: {
    type: Number,
    default: 1
  },
  maxGeoLockingCountries: {
    type: Number,
    default: 0
  },
  maxConcurrentSessions: {
    type: Number,
    default: 3
  },
  maxWebhookEndpoints: {
    type: Number,
    default: 1
  },
  maxSiemIntegrations: {
    type: Number,
    default: 0
  },
  threatDetectionEnabled: {
    type: Boolean,
    default: false
  },
  riskBasedAuthEnabled: {
    type: Boolean,
    default: false
  },
  advancedAnalytics: {
    type: Boolean,
    default: false
  }
});


const AnalyticsSchema = new mongoose.Schema({
  // ===== Purchase tracking =====
  totalPurchases: { type: Number, default: 0 },
  activeSubscriptions: { type: Number, default: 0 },
  canceledSubscriptions: { type: Number, default: 0 },
  downgradedSubscriptions: { type: Number, default: 0 },
  upgradedSubscriptions: { type: Number, default: 0 },

  // ===== Revenue tracking =====
  totalRevenue: {
    amount: { type: Number, default: 0 },
    currency: { type: String, default: 'USD' }
  },
  monthlyRecurringRevenue: {
    amount: { type: Number, default: 0 },
    currency: { type: String, default: 'USD' }
  },
  annualRecurringRevenue: {
    amount: { type: Number, default: 0 },
    currency: { type: String, default: 'USD' }
  },

  // ===== Churn analysis =====
  churnRate: { type: Number, default: 0 },
  monthlyChurnRate: { type: Number, default: 0 },
  upgradeRate: { type: Number, default: 0 },
  downgradeRate: { type: Number, default: 0 },

  // ===== Trial conversion =====
  trialConversions: { type: Number, default: 0 },
  trialConversionRate: { type: Number, default: 0 },

  // ===== Usage metrics =====
  averageSubscriptionDuration: { type: Number, default: 0 }, // in days
  retentionRate: {
    '30days': { type: Number, default: 0 },
    '90days': { type: Number, default: 0 },
    '365days': { type: Number, default: 0 }
  },

  // ===== Geographic distribution =====
  geographicDistribution: {
    type: Map,
    of: Number,
    default: {}
  },

  // ===== Industry distribution =====
  industryDistribution: {
    type: Map,
    of: Number,
    default: {}
  },

  // ===== Timeline data for charts =====
  timeline: {
    purchases: [{
      date: Date,
      count: Number,
      revenue: Number
    }],
    cancellations: [{
      date: Date,
      count: Number,
      reason: String
    }],
    upgrades: [{
      date: Date,
      count: Number,
      fromPlan: String
    }],
    downgrades: [{
      date: Date,
      count: Number,
      toPlan: String
    }]
  },

  // ===== Last calculated dates =====
  lastCalculated: {
    churn: Date,
    revenue: Date,
    retention: Date
  },

  // ===== Performance metrics =====
  performance: {
    customerSatisfaction: {
      type: Number,
      min: 0,
      max: 5,
      default: 0
    },
    supportTickets: {
      type: Number,
      default: 0
    },
    averageResolutionTime: {
      type: Number, // in hours
      default: 0
    }
  }
}, {
  _id: false, // Analytics is embedded, doesn't need its own ID
  minimize: false // Ensure empty objects are stored
});


const SubscriptionPlanSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  tier: {
    type: String,
    enum: ['FREE', 'BASIC', 'PRO', 'ENTERPRISE', 'CUSTOM'], // ADDED 'CUSTOM'
    required: true,
    uppercase: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  shortDescription: {
    type: String,
    trim: true
  },
  price: {
    monthly: {
      type: Map,
      of: Number, // e.g., { USD: 10, EUR: 9 }
      required: true
    },
    annually: {
      type: Map,
      of: Number
    },
    currency: {
      type: String,
      default: 'USD',
      uppercase: true
    }
  },


  isActive: {
    type: Boolean,
    default: true
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  // ADDED: Custom/Private Plan Fields
  isPublic: {
    type: Boolean,
    default: true
  },
  isCustom: {
    type: Boolean,
    default: false
  },
  allowedUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User' // or your user model
  }],
  allowedUserEmails: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  invitationCode: {
    type: String,
    trim: true,
    uppercase: true,
    sparse: true
  },
  accessType: {
    type: String,
    enum: ['PUBLIC', 'INVITE_ONLY', 'SPECIFIC_USERS', 'SPECIFIC_EMAILS'],
    default: 'PUBLIC'
  },
  features: [FeatureSchema],
  limitations: PlanLimitationSchema,
  authenticationMethods: {
    emailPassword: {
      type: Boolean,
      default: true
    },
    socialLogin: {
      google: { type: Boolean, default: false },
      facebook: { type: Boolean, default: false },
      github: { type: Boolean, default: false },
      linkedin: { type: Boolean, default: false },
    },
    magicLink: {
      type: Boolean,
      default: false
    },
    emailVerification: {
      type: Boolean,
      default: false
    },
    phoneVerification: {
      type: Boolean,
      default: false
    },

    // models/SubscriptionPlan.js - Updated MFA section
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
            name: { type: String },
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
            vendor: { type: String },
            addedAt: { type: Date, default: Date.now },
            lastUsed: { type: Date }
          }]
        },

        fingerprint: {
          enabled: { type: Boolean, default: false },
          devices: [{
            deviceId: { type: String },
            fingerprintHash: { type: String },
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
        }
      },

      lastUsed: { type: Date },
      recoveryEmail: { type: String },
      createdAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now }
    },
  },
  securityFeatures: {
    passwordPolicy: {
      minLength: { type: Number, default: 8 },
      requireUppercase: { type: Boolean, default: true },
      requireLowercase: { type: Boolean, default: true },
      requireNumbers: { type: Boolean, default: true },
      requireSpecialChars: { type: Boolean, default: true }
    },
    sessionManagement: {
      type: Boolean,
      default: true
    },
    bruteForceProtection: {
      type: Boolean,
      default: true
    },
    advancedThreatDetection: {
      type: Boolean,
      default: false
    },
    advancedThreatDetectionFeatures: {
      impossibleTravel: { type: Boolean, default: false },
      loginVelocity: { type: Boolean, default: false },
      bruteForceAdvanced: { type: Boolean, default: false },
      botDetection: { type: Boolean, default: false },
      breachDetection: { type: Boolean, default: false }
    },
    riskBasedAuthentication: {
      enabled: { type: Boolean, default: false },
      maxRiskFactors: { type: Number, default: 0 }
    },
    sessionSecurity: {
      deviceFingerprinting: { type: Boolean, default: false },
      tokenBinding: { type: Boolean, default: false },
      dynamicSessionTimeout: { type: Boolean, default: false },
      concurrentSessionControl: { type: Boolean, default: false }
    },
    complianceFeatures: {
      gdpr: { type: Boolean, default: false },
      hipaa: { type: Boolean, default: false },
      soc2: { type: Boolean, default: false },
      dataResidency: { type: Boolean, default: false }
    },
    securityMonitoring: {
      realTimeAlerts: { type: Boolean, default: false },
      siemIntegration: { type: Boolean, default: false },
      securityReports: { type: Boolean, default: false }
    }
  },

  support: {
    level: {
      type: String,
      enum: ['COMMUNITY', 'EMAIL', 'CHAT', 'PHONE', 'DEDICATED'],
      default: 'EMAIL'
    },
    responseTimeHours: {
      type: Number,
      default: 48
    }
  },
  billingTiers: {
    overagePricing: {
      additionalUsers: { type: Number, default: 0 },
      additionalApiCalls: { type: Number, default: 0 },
      additionalStorage: { type: Number, default: 0 },
      additionalMfaMethods: { type: Number, default: 0 }
    },
    featureUnlocks: {
      advancedMfa: { type: Boolean, default: false },
      threatDetection: { type: Boolean, default: false },
      complianceFeatures: { type: Boolean, default: false },
      customBranding: { type: Boolean, default: false }
    },

    usageMetrics: {
      trackUserLogins: { type: Boolean, default: true },
      trackApiCalls: { type: Boolean, default: true },
      trackMfaUsage: { type: Boolean, default: false },
      trackSecurityEvents: { type: Boolean, default: false }
    }
  },
  trial: {
    available: { type: Boolean, default: true },
    periodDays: { type: Number, default: 14 },
    includes: {
      features: [{ type: String, uppercase: true }],
      limitations: mongoose.Schema.Types.Mixed // optional overrides during trial
    }
  },
  brandingOptions: {
    allowCustomBranding: { type: Boolean, default: false },
    themeControl: { type: Boolean, default: false },
    logoUpload: { type: Boolean, default: false },
    whiteLabelSupport: { type: Boolean, default: false }
  },
  sla: {
    uptime: { type: Number, default: 99.9 },
    downtimeCredits: { type: Boolean, default: false }
  },
  sortOrder: {
    type: Number,
    default: 0
  },
  expirySettings: {
    notifyBeforeDays: {
      type: [Number], // Array of days to notify before expiry (e.g., [7, 3, 1])
      default: [7, 3, 1]
    },
    autoRenew: {
      type: Boolean,
      default: false
    },
    gracePeriod: {
      type: Number, // in days
      default: 3
    },
    suspendAfterGrace: {
      type: Boolean,
      default: true
    }
  },
  addOnPlans: [{
    name: String,
    description: String,
    price: Number,
    featureOverrides: Object
  }],

  upgradePaths: [{
    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: `${process.env.APP_NAME}_SubscriptionPlan`
    },
    tier: String,
    prorated: {
      type: Boolean,
      default: true
    }
  }],
  analytics: {
    type: AnalyticsSchema,
    default: () => ({}) // Initialize with empty analytics object
  },
  // In SubscriptionPlanSchema (add near isActive)
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date,
    default: null
  },
  deletedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // or your user model
    default: null
  }
  ,
  monitorLatency: { type: Boolean, default: false },
  monitorErrorRate: { type: Boolean, default: false },

  //industry Could be used for grouping plans by industry (e.g., fintech, healthcare), size, or internal labels like ["legacy", "growth", "promo2024"].
  industry: {
    type: String,
    enum: ['GENERAL', 'FINTECH', 'HEALTHCARE', 'EDUCATION', 'E-COMMERCE', 'SAAS', 'GOVERNMENT', 'LEGAL', 'MEDIA', 'TRAVEL'],
    default: 'GENERAL'
  },

  version: { type: Number, default: 1 },
  metadata: mongoose.Schema.Types.Mixed
}, {
  timestamps: true
});

// Index for efficient querying
SubscriptionPlanSchema.index({ tier: 1, isActive: 1 });
SubscriptionPlanSchema.index({ isDefault: 1 });
SubscriptionPlanSchema.index({ 'price.monthly': 1 });
SubscriptionPlanSchema.index({ 'price.annually': 1 });
SubscriptionPlanSchema.index({ createdAt: 1 });

SubscriptionPlanSchema.index({ isPublic: 1, accessType: 1 });
SubscriptionPlanSchema.index({ allowedUsers: 1 });
SubscriptionPlanSchema.index({ allowedUserEmails: 1 });
// SubscriptionPlanSchema.index({ invitationCode: 1 }, { sparse: true });


SubscriptionPlanSchema.pre('save', function (next) {

  if (this.trial?.periodDays > 60) {
    return next(new Error('Trial period cannot exceed 60 days'));
  }
  // Validate price consistency

  if (this.price.annually && this.price.monthly) {
    const expectedAnnual = this.price.monthly * 12;
    const actualAnnual = this.price.annually;

    // Annual price should be less than monthly * 12 (discounted)
    if (actualAnnual >= expectedAnnual) {
      return next(new Error('Annual price should be less than monthly price multiplied by 12'));
    }
  }

  // Validate trial period
  if (this.trialPeriod > 365) {
    return next(new Error('Trial period cannot exceed 365 days'));
  }

  // Validate SLA uptime
  if (this.sla.uptime < 0 || this.sla.uptime > 100) {
    return next(new Error('SLA uptime must be between 0 and 100'));
  }

  // Set default annual price if not provided
  if (!this.price.annually && this.price.monthly) {
    this.price.annually = this.price.monthly * 12;
  }

  next();
});

SubscriptionPlanSchema.pre('save', function (next) {
  // Validate that features have unique keys
  const featureKeys = this.features.map(f => f.key);
  const uniqueKeys = new Set(featureKeys);

  if (featureKeys.length !== uniqueKeys.size) {
    return next(new Error('Feature keys must be unique'));
  }

  // Enhanced MFA validation with all methods
  if (this.authenticationMethods.mfa.enabled) {
    const mfaMethods = this.authenticationMethods.mfa.methods;
    const hasMfaMethod = Object.values(mfaMethods).some(
      method => method.enabled
    );

    if (!hasMfaMethod) {
      return next(new Error('At least one MFA method must be enabled when MFA is enabled'));
    }

    // Validate biometric methods don't exceed plan limits
    const biometricMethods = [
      mfaMethods.fingerprint,
      mfaMethods.irisScan,
      mfaMethods.retinaScan,
      mfaMethods.faceRecognition,
      mfaMethods.voiceRecognition,
      mfaMethods.palmVein
    ];

    const enabledBiometricCount = biometricMethods.filter(method =>
      method && method.enabled
    ).length;

    if (enabledBiometricCount > this.limitations.maxBiometricDevices) {
      return next(new Error(`Cannot enable more than ${this.limitations.maxBiometricDevices} biometric methods`));
    }

    // Validate total MFA methods don't exceed plan limits
    const enabledMfaCount = Object.values(mfaMethods).filter(method =>
      method && method.enabled
    ).length;

    if (enabledMfaCount > this.limitations.maxMfaMethods) {
      return next(new Error(`Cannot enable more than ${this.limitations.maxMfaMethods} MFA methods`));
    }
  }

  next();
});

SubscriptionPlanSchema.pre('save', function (next) {
  if (this.support?.level && !this.support.responseTimeHours) {
    this.support.responseTimeHours = supportLevelResponseMap[this.support.level] || 48;
  }
  next();
});

// Instance method to soft delete
SubscriptionPlanSchema.methods.softDelete = function (userId) {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedBy = userId;
  return this.save();
};

// Instance method to restore
SubscriptionPlanSchema.methods.restore = function () {
  this.isDeleted = false;
  this.deletedAt = null;
  this.deletedBy = null;
  return this.save();
};


SubscriptionPlanSchema.methods.isMfaMethodAvailable = function (methodName) {
  const method = this.authenticationMethods.mfa.methods[methodName];
  return method ? method.enabled : false;
};

// ADDED: Method to get available MFA methods
SubscriptionPlanSchema.methods.getAvailableMfaMethods = function () {
  const methods = [];
  const mfaMethods = this.authenticationMethods.mfa.methods;

  for (const [methodName, methodConfig] of Object.entries(mfaMethods)) {
    if (methodConfig && methodConfig.enabled) {
      methods.push(methodName);
    }
  }

  return methods;
};

// ADDED: Method to get biometric methods count
SubscriptionPlanSchema.methods.getBiometricMethodsCount = function () {
  const mfaMethods = this.authenticationMethods.mfa.methods;
  const biometricMethods = [
    'fingerprint', 'irisScan', 'retinaScan',
    'faceRecognition', 'voiceRecognition', 'palmVein'
  ];

  return biometricMethods.filter(method =>
    mfaMethods[method] && mfaMethods[method].enabled
  ).length;
};

// ADDED: Instance methods
SubscriptionPlanSchema.methods.isFeatureEnabled = function (featureKey) {
  const feature = this.features.find(f => f.key === featureKey.toUpperCase());
  return feature ? feature.value : false;
};

SubscriptionPlanSchema.methods.getFeatureValue = function (featureKey) {
  const feature = this.features.find(f => f.key === featureKey.toUpperCase());
  return feature ? feature.value : null;
};

SubscriptionPlanSchema.methods.canUpgradeTo = function (targetPlan) {
  const currentTierOrder = { 'FREE': 0, 'BASIC': 1, 'PRO': 2, 'ENTERPRISE': 3 };
  const currentOrder = currentTierOrder[this.tier];
  const targetOrder = currentTierOrder[targetPlan.tier];

  return targetOrder > currentOrder;
};

SubscriptionPlanSchema.methods.canDowngradeTo = function (targetPlan) {
  const currentTierOrder = { 'FREE': 0, 'BASIC': 1, 'PRO': 2, 'ENTERPRISE': 3 };
  const currentOrder = currentTierOrder[this.tier];
  const targetOrder = currentTierOrder[targetPlan.tier];

  return targetOrder < currentOrder;
};

SubscriptionPlanSchema.methods.getUpgradePrice = function (targetPlan, billingCycle = 'monthly') {
  if (!this.canUpgradeTo(targetPlan)) {
    return null;
  }

  const currentPrice = this.price[billingCycle] || 0;
  const targetPrice = targetPlan.price[billingCycle] || 0;

  return Math.max(0, targetPrice - currentPrice);
};

// ADDED: Static methods
SubscriptionPlanSchema.statics.getDefaultPlan = function () {
  return this.findOne({ isDefault: true, isActive: true });
};

SubscriptionPlanSchema.statics.getPlanByTier = function (tier) {
  return this.findOne({ tier: tier.toUpperCase(), isActive: true });
};

SubscriptionPlanSchema.statics.getActivePlans = function () {
  return this.find({ isActive: true, isDeleted: false }).sort({ 'price.monthly': 1 });
};

SubscriptionPlanSchema.methods.canDowngradeTo = function (targetPlan, usageData = {}) {
  const limitations = targetPlan.limitations;
  const violations = [];

  if (limitations.maxUsers !== null && usageData.userCount > limitations.maxUsers) {
    violations.push(`User count exceeds target plan: ${usageData.userCount}/${limitations.maxUsers}`);
  }

  if (limitations.maxApiCalls !== null && usageData.apiCalls > limitations.maxApiCalls) {
    violations.push(`API calls exceed target plan: ${usageData.apiCalls}/${limitations.maxApiCalls}`);
  }

  if (usageData.mfaMethodsCount > limitations.maxMfaMethods) {
    violations.push(`Too many MFA methods: ${usageData.mfaMethodsCount}/${limitations.maxMfaMethods}`);
  }

  return {
    canDowngrade: violations.length === 0,
    violations
  };
};
// Returns plans supporting a specific compliance feature (e.g., 'gdpr')
SubscriptionPlanSchema.statics.getPlansByCompliance = function (complianceKey) {
  return this.find({
    [`securityFeatures.complianceFeatures.${complianceKey}`]: true,
    isDeleted: false,
    isActive: true
  });
};

// Plans that have any MFA method enabled
SubscriptionPlanSchema.statics.getPlansWithMfaSupport = function () {
  return this.find({
    'authenticationMethods.mfa.enabled': true,
    isDeleted: false,
    isActive: true
  });
};

// Plans that support branding
SubscriptionPlanSchema.statics.getPlansSupportingBranding = function () {
  return this.find({
    'brandingOptions.allowCustomBranding': true,
    isDeleted: false,
    isActive: true
  });
};

// ADDED: Methods for custom/private plans
SubscriptionPlanSchema.methods.isAccessibleToUser = function (userId, userEmail = null) {
  if (this.isPublic && this.accessType === 'PUBLIC') {
    return true;
  }

  if (this.accessType === 'INVITE_ONLY' && this.invitationCode) {
    return true; // Code validation handled separately
  }

  if (this.accessType === 'SPECIFIC_USERS' && userId) {
    return this.allowedUsers.includes(userId);
  }

  if (this.accessType === 'SPECIFIC_EMAILS' && userEmail) {
    return this.allowedUserEmails.includes(userEmail.toLowerCase());
  }

  return false;
};

SubscriptionPlanSchema.methods.addAllowedUser = function (userId) {
  if (!this.allowedUsers.includes(userId)) {
    this.allowedUsers.push(userId);
  }
  return this.save();
};

SubscriptionPlanSchema.methods.removeAllowedUser = function (userId) {
  this.allowedUsers = this.allowedUsers.filter(id => id.toString() !== userId.toString());
  return this.save();
};

SubscriptionPlanSchema.methods.addAllowedEmail = function (email) {
  const normalizedEmail = email.toLowerCase().trim();
  if (!this.allowedUserEmails.includes(normalizedEmail)) {
    this.allowedUserEmails.push(normalizedEmail);
  }
  return this.save();
};

SubscriptionPlanSchema.methods.removeAllowedEmail = function (email) {
  const normalizedEmail = email.toLowerCase().trim();
  this.allowedUserEmails = this.allowedUserEmails.filter(e => e !== normalizedEmail);
  return this.save();
};

SubscriptionPlanSchema.methods.generateInvitationCode = function () {
  this.invitationCode = Math.random().toString(36).substring(2, 10).toUpperCase();
  return this.save();
};

SubscriptionPlanSchema.statics.findByPriceRange = function (minPrice, maxPrice, currency = 'USD') {
  return this.find({
    'price.monthly': { $gte: minPrice, $lte: maxPrice },
    'price.currency': currency,
    isActive: true
  }).sort({ 'price.monthly': 1 });
};

SubscriptionPlanSchema.statics.getPlansWithFeature = function (featureKey) {
  return this.find({
    'features.key': featureKey.toUpperCase(),
    'features.value': true,
    isActive: true
  });
};

SubscriptionPlanSchema.statics.validatePlanLimits = function (planId, usageData) {
  return this.findById(planId).then(plan => {
    if (!plan) {
      throw new Error('Plan not found');
    }

    const limitations = plan.limitations;
    const violations = [];

    // Check user limit
    if (limitations.maxUsers !== null && usageData.userCount > limitations.maxUsers) {
      violations.push(`User limit exceeded: ${usageData.userCount}/${limitations.maxUsers}`);
    }

    // Check API call limit
    if (limitations.maxApiCalls !== null && usageData.apiCalls > limitations.maxApiCalls) {
      violations.push(`API call limit exceeded: ${usageData.apiCalls}/${limitations.maxApiCalls}`);
    }

    // Check session limit
    if (limitations.maxSessions !== null && usageData.sessionCount > limitations.maxSessions) {
      violations.push(`Session limit exceeded: ${usageData.sessionCount}/${limitations.maxSessions}`);
    }

    // Check MFA methods limit
    if (usageData.mfaMethodsCount && limitations.maxMfaMethods !== null &&
      usageData.mfaMethodsCount > limitations.maxMfaMethods) {
      violations.push(`MFA methods limit exceeded: ${usageData.mfaMethodsCount}/${limitations.maxMfaMethods}`);
    }

    // Check biometric devices limit
    if (usageData.biometricDevicesCount && limitations.maxBiometricDevices !== null &&
      usageData.biometricDevicesCount > limitations.maxBiometricDevices) {
      violations.push(`Biometric devices limit exceeded: ${usageData.biometricDevicesCount}/${limitations.maxBiometricDevices}`);
    }

    return {
      isValid: violations.length === 0,
      violations,
      plan
    };
  });
};

// ADDED: Auto-expiration check and notification system
SubscriptionPlanSchema.statics.checkExpiringSubscriptions = async function () {
  const Subscription = mongoose.model(`${process.env.APP_NAME}_Subscription`);
  const Notification = mongoose.model(`${process.env.APP_NAME}_Notification`);

  const now = new Date();
  const expiringSubscriptions = await Subscription.find({
    status: 'active',
    endDate: {
      $gte: now,
      $lte: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) // Next 30 days
    }
  }).populate('planId');

  for (const subscription of expiringSubscriptions) {
    const daysUntilExpiry = Math.ceil(
      (subscription.endDate - now) / (1000 * 60 * 60 * 24)
    );

    const plan = subscription.planId;
    if (plan && plan.expirySettings.notifyBeforeDays.includes(daysUntilExpiry)) {
      // Send notification
      await Notification.create({
        userId: subscription.userId,
        type: 'SUBSCRIPTION_EXPIRY',
        title: `Subscription Expiring in ${daysUntilExpiry} days`,
        message: `Your ${plan.name} plan will expire on ${subscription.endDate.toDateString()}.`,
        data: {
          subscriptionId: subscription._id,
          planId: plan._id,
          daysUntilExpiry,
          expiryDate: subscription.endDate
        },
        priority: daysUntilExpiry <= 3 ? 'high' : 'medium'
      });

      // TODO: Send email notification
      console.log(`Notified user ${subscription.userId} about subscription expiry in ${daysUntilExpiry} days`);
    }
  }

  return expiringSubscriptions.length;
};

// ADDED: Function to handle expired subscriptions
SubscriptionPlanSchema.statics.handleExpiredSubscriptions = async function () {
  const Subscription = mongoose.model(`${process.env.APP_NAME}_Subscription`);

  const now = new Date();
  const expiredSubscriptions = await Subscription.find({
    status: 'active',
    endDate: { $lt: now }
  }).populate('planId');

  for (const subscription of expiredSubscriptions) {
    const plan = subscription.planId;
    const gracePeriodEnd = new Date(subscription.endDate.getTime() +
      (plan.expirySettings.gracePeriod * 24 * 60 * 60 * 1000));

    if (now > gracePeriodEnd && plan.expirySettings.suspendAfterGrace) {
      // Suspend the subscription
      subscription.status = 'suspended';
      await subscription.save();

      console.log(`Suspended subscription ${subscription._id} after grace period`);
    } else if (now <= gracePeriodEnd) {
      // In grace period - mark as expired but not suspended yet
      subscription.status = 'expired';
      await subscription.save();

      console.log(`Marked subscription ${subscription._id} as expired (grace period)`);
    }
  }

  return expiredSubscriptions.length;
};

// ADDED: Cron job setup for automatic checks
SubscriptionPlanSchema.statics.setupExpirationCronJobs = function () {
  // Check for expiring subscriptions daily at 9 AM
  cron.schedule('0 9 * * *', async () => {
    try {
      const expiringCount = await this.checkExpiringSubscriptions();
      console.log(`Checked ${expiringCount} expiring subscriptions`);
    } catch (error) {
      console.error('Error checking expiring subscriptions:', error);
    }
  });

  // Handle expired subscriptions daily at midnight
  cron.schedule('0 0 * * *', async () => {
    try {
      const expiredCount = await this.handleExpiredSubscriptions();
      console.log(`Processed ${expiredCount} expired subscriptions`);
    } catch (error) {
      console.error('Error handling expired subscriptions:', error);
    }
  });

  console.log('Subscription expiration cron jobs setup completed');
};

SubscriptionPlanSchema.virtual('annualSavings').get(function () {
  const currency = this.price.currency || 'USD';
  const monthly = this.price.monthly?.get(currency);
  const annually = this.price.annually?.get(currency);
  if (!annually || !monthly) return 0;
  return monthly * 12 - annually;
});

SubscriptionPlanSchema.methods.getPriceInCurrency = function (cycle = 'monthly', currency = 'USD') {
  return this.price[cycle]?.get(currency.toUpperCase()) || null;
};


SubscriptionPlanSchema.virtual('savingsPercentage').get(function () {
  const currency = this.price.currency || 'USD';
  const monthly = this.price.monthly?.get(currency);
  const annually = this.price.annually?.get(currency);
  if (!annually || !monthly) return 0;
  const monthlyTotal = monthly * 12;
  return Math.round(((monthlyTotal - annually) / monthlyTotal) * 100);
});


// ADDED: Set virtuals to be included in JSON output
SubscriptionPlanSchema.set('toJSON', { virtuals: true });
SubscriptionPlanSchema.set('toObject', { virtuals: true });


SubscriptionPlanSchema.methods.initializeAnalytics = function () {
  if (!this.analytics) {
    this.analytics = {
      totalPurchases: 0,
      activeSubscriptions: 0,
      canceledSubscriptions: 0,
      downgradedSubscriptions: 0,
      upgradedSubscriptions: 0,
      totalRevenue: { amount: 0, currency: 'USD' },
      monthlyRecurringRevenue: { amount: 0, currency: 'USD' },
      annualRecurringRevenue: { amount: 0, currency: 'USD' },
      churnRate: 0,
      monthlyChurnRate: 0,
      upgradeRate: 0,
      downgradeRate: 0,
      trialConversions: 0,
      trialConversionRate: 0,
      averageSubscriptionDuration: 0,
      retentionRate: {
        '30days': 0,
        '90days': 0,
        '365days': 0
      },
      geographicDistribution: new Map(),
      industryDistribution: new Map(),
      timeline: {
        purchases: [],
        cancellations: [],
        upgrades: [],
        downgrades: []
      },
      lastCalculated: {
        churn: null,
        revenue: null,
        retention: null
      },
      performance: {
        customerSatisfaction: 0,
        supportTickets: 0,
        averageResolutionTime: 0
      }
    };
  }
  return this;
};

// Method to update analytics when a subscription is purchased
SubscriptionPlanSchema.methods.recordPurchase = async function (amount, currency = 'USD', country = 'Unknown', industry = 'GENERAL') {
  // Initialize analytics if it doesn't exist (for new plans)
  if (!this.analytics) {
    this.analytics = {};
  }

  // Initialize nested objects if they don't exist
  if (!this.analytics.totalRevenue) {
    this.analytics.totalRevenue = { amount: 0, currency: 'USD' };
  }
  if (!this.analytics.geographicDistribution) {
    this.analytics.geographicDistribution = new Map();
  }
  if (!this.analytics.industryDistribution) {
    this.analytics.industryDistribution = new Map();
  }
  if (!this.analytics.timeline) {
    this.analytics.timeline = {
      purchases: [],
      cancellations: [],
      upgrades: [],
      downgrades: []
    };
  }

  // Set defaults for required fields
  this.analytics.totalPurchases = this.analytics.totalPurchases || 0;
  this.analytics.activeSubscriptions = this.analytics.activeSubscriptions || 0;

  // Now update the analytics data
  this.analytics.totalPurchases += 1;
  this.analytics.activeSubscriptions += 1;

  // Update revenue (for free plans, amount will be 0)
  this.analytics.totalRevenue.amount += amount;
  this.analytics.totalRevenue.currency = currency;

  // Update geographic distribution
  const geoCount = this.analytics.geographicDistribution.get(country) || 0;
  this.analytics.geographicDistribution.set(country, geoCount + 1);

  // Update industry distribution
  const industryCount = this.analytics.industryDistribution.get(industry) || 0;
  this.analytics.industryDistribution.set(industry, industryCount + 1);

  // Add to timeline
  this.analytics.timeline.purchases.push({
    date: new Date(),
    count: 1,
    revenue: amount
  });

  // Keep only last 365 days of timeline data
  const oneYearAgo = new Date();
  oneYearAgo.setDate(oneYearAgo.getDate() - 365);
  this.analytics.timeline.purchases = this.analytics.timeline.purchases.filter(
    item => item.date >= oneYearAgo
  );

  await this.save();
  return this;
};

// Method to record cancellation
SubscriptionPlanSchema.methods.recordCancellation = async function (reason = 'Unknown', subscriptionDuration = 0) {

  if (!this.analytics) {
    this.analytics = {};
  }

  // Initialize required fields
  this.analytics.activeSubscriptions = this.analytics.activeSubscriptions || 0;
  this.analytics.canceledSubscriptions = this.analytics.canceledSubscriptions || 0;
  this.analytics.totalPurchases = this.analytics.totalPurchases || 1;
  this.analytics.averageSubscriptionDuration = this.analytics.averageSubscriptionDuration || 0;

  if (!this.analytics.timeline) {
    this.analytics.timeline = { cancellations: [] };
  }

  this.analytics.activeSubscriptions = Math.max(0, this.analytics.activeSubscriptions - 1);
  this.analytics.canceledSubscriptions += 1;

  // Update average duration
  const totalSubscriptions = this.analytics.totalPurchases || 1;
  const currentTotalDuration = this.analytics.averageSubscriptionDuration * (totalSubscriptions - 1);
  this.analytics.averageSubscriptionDuration = (currentTotalDuration + subscriptionDuration) / totalSubscriptions;

  // Add to timeline
  this.analytics.timeline.cancellations.push({
    date: new Date(),
    count: 1,
    reason: reason
  });

  // Keep only last 365 days
  const oneYearAgo = new Date();
  oneYearAgo.setDate(oneYearAgo.getDate() - 365);
  this.analytics.timeline.cancellations = this.analytics.timeline.cancellations.filter(
    item => item.date >= oneYearAgo
  );

  await this.save();
  return this;
};

// Method to record upgrade
SubscriptionPlanSchema.methods.recordUpgrade = async function (fromPlan = 'Unknown') {
  this.analytics.upgradedSubscriptions += 1;

  this.analytics.timeline.upgrades.push({
    date: new Date(),
    count: 1,
    fromPlan: fromPlan
  });

  await this.save();
  return this;
};

// Method to record downgrade
SubscriptionPlanSchema.methods.recordDowngrade = async function (toPlan = 'Unknown') {
  this.analytics.downgradedSubscriptions += 1;
  this.analytics.activeSubscriptions = Math.max(0, this.analytics.activeSubscriptions - 1);

  this.analytics.timeline.downgrades.push({
    date: new Date(),
    count: 1,
    toPlan: toPlan
  });

  await this.save();
  return this;
};

// Method to calculate churn rate
SubscriptionPlanSchema.methods.calculateChurnRate = async function (period = 'monthly') {
  const now = new Date();
  const periodStart = new Date();

  if (period === 'monthly') {
    periodStart.setMonth(periodStart.getMonth() - 1);
  } else {
    periodStart.setFullYear(periodStart.getFullYear() - 1);
  }

  // This would typically query the PaymentTransaction model
  const PaymentTransaction = mongoose.model(`${process.env.APP_NAME}_PaymentTransaction`);

  const periodCancellations = await PaymentTransaction.countDocuments({
    planId: this._id,
    transactionType: 'cancellation',
    createdAt: { $gte: periodStart }
  });

  const periodStartActive = await PaymentTransaction.countDocuments({
    planId: this._id,
    status: 'active',
    createdAt: { $lte: periodStart }
  });

  const churnRate = periodStartActive > 0 ? (periodCancellations / periodStartActive) * 100 : 0;

  if (period === 'monthly') {
    this.analytics.monthlyChurnRate = churnRate;
  } else {
    this.analytics.churnRate = churnRate;
  }

  this.analytics.lastCalculated.churn = now;
  await this.save();

  return churnRate;
};

// Method to update MRR/ARR
SubscriptionPlanSchema.methods.updateRecurringRevenue = async function () {
  const now = new Date();
  const PaymentTransaction = mongoose.model(`${process.env.APP_NAME}_PaymentTransaction`);

  // Calculate MRR
  const activeSubscriptions = await PaymentTransaction.find({
    planId: this._id,
    status: 'active',
    $or: [
      { transactionType: 'subscription' },
      { transactionType: 'renewal' }
    ]
  });

  let mrr = 0;
  let arr = 0;

  activeSubscriptions.forEach(sub => {
    const monthlyAmount = sub.amount / (sub.billingCycle === 'yearly' ? 12 : 1);
    mrr += monthlyAmount;
    arr += monthlyAmount * 12;
  });

  this.analytics.monthlyRecurringRevenue = {
    amount: mrr,
    currency: this.price.currency || 'USD'
  };

  this.analytics.annualRecurringRevenue = {
    amount: arr,
    currency: this.price.currency || 'USD'
  };

  this.analytics.lastCalculated.revenue = now;
  await this.save();

  return { mrr, arr };
};

// Static method to get plan analytics summary
SubscriptionPlanSchema.statics.getAnalyticsSummary = async function () {
  const plans = await this.find({ isActive: true, isDeleted: false });

  const summary = {
    totalPlans: plans.length,
    totalRevenue: 0,
    totalActiveSubscriptions: 0,
    totalMRR: 0,
    totalARR: 0,
    averageChurnRate: 0,
    plans: []
  };

  for (const plan of plans) {
    summary.totalRevenue += plan.analytics.totalRevenue.amount;
    summary.totalActiveSubscriptions += plan.analytics.activeSubscriptions;
    summary.totalMRR += plan.analytics.monthlyRecurringRevenue.amount;
    summary.totalARR += plan.analytics.annualRecurringRevenue.amount;
    summary.averageChurnRate += plan.analytics.churnRate;

    summary.plans.push({
      planId: plan._id,
      name: plan.name,
      tier: plan.tier,
      activeSubscriptions: plan.analytics.activeSubscriptions,
      totalRevenue: plan.analytics.totalRevenue,
      mrr: plan.analytics.monthlyRecurringRevenue,
      churnRate: plan.analytics.churnRate
    });
  }

  summary.averageChurnRate = plans.length > 0 ? summary.averageChurnRate / plans.length : 0;

  return summary;
};

// ADDED: Initialize cron jobs when model is loaded
// Note: This should be called once during application startup
const initializeSubscriptionJobs = () => {
  const SubscriptionPlan = mongoose.model(`${process.env.APP_NAME}_SubscriptionPlan`);
  SubscriptionPlan.setupExpirationCronJobs();
};



module.exports = mongoose.model(`${process.env.APP_NAME}_SubscriptionPlan`, SubscriptionPlanSchema);