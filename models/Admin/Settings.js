const mongoose = require('mongoose');

const EmailSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['support', 'billing', 'legal', 'sales', 'technical', 'marketing', 'security', 'abuse', 'partnerships', 'careers'],
        required: true
    },
    address: {
        type: String,
        required: true
    },
    description: String
}, { _id: false });

const PhoneSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['support', 'billing', 'sales', 'technical', 'emergency', 'fraud'],
        required: true
    },
    number: {
        type: String,
        required: true
    },
    countryCode: String,
    description: String
}, { _id: false });

const SocialLinkSchema = new mongoose.Schema({
    platform: {
        type: String,
        enum: ['twitter', 'linkedin', 'facebook', 'github', 'youtube', 'instagram', 'tiktok', 'discord', 'telegram', 'slack'],
        required: true
    },
    url: {
        type: String,
        required: true
    }
}, { _id: false });

const BusinessHoursSchema = new mongoose.Schema({
    day: {
        type: String,
        enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
        required: true
    },
    open: String,
    close: String,
    isClosed: {
        type: Boolean,
        default: false
    }
}, { _id: false });

const RegionalSettingsSchema = new mongoose.Schema({
    region: {
        type: String,
        required: true
    },
    currency: String,
    language: String,
    timezone: String,
    dateFormat: String
}, { _id: false });

const FeatureFlagsSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    enabled: {
        type: Boolean,
        default: false
    },
    description: String,
    targetUsers: {
        type: String,
        enum: ['all', 'beta', 'internal', 'specific'],
        default: 'internal'
    }
}, { _id: false });


const PlatformSettingsSchema = new mongoose.Schema({
    appName: {
        type: String,
        default: 'Authnest'
    },
    companyName: {
        type: String,
        required: true
    },
    companyLegalName: String,
    companyAddress: String,
    countryOfIncorporation: String,


    officialEmails: [EmailSchema],
    contactNumbers: [PhoneSchema],
    socialLinks: [SocialLinkSchema],
    regionalSettings: [RegionalSettingsSchema],
    businessHours: [BusinessHoursSchema],
    featureFlags: [FeatureFlagsSchema],

    websiteUrl: String,
    dashboardUrl: String,
    apiBaseUrl: String,

    termsUrl: String,
    privacyPolicyUrl: String,
    cookiePolicyUrl: String,
    supportCenterUrl: String,

    branding: {
        logoUrl: String,
        faviconUrl: String,
        darkModeLogoUrl: String,
        defaultLanguage: {
            type: String,
            default: 'en'
        },

    },

    security: {
        isMaintenanceMode: {
            type: Boolean,
            default: false
        },
        maintenanceMessage: String,
        allowedIPs: [String],
        blockedIPs: [String],
        enable2FA: {
            type: Boolean,
            default: true
        },
        sessionTimeout: {
            type: Number,
            default: 24
        },
        maxLoginAttempts: {
            type: Number,
            default: 5
        },
        passwordPolicy: {
            minLength: { type: Number, default: 8 },
            maxLength: { type: Number, default: 128 },
            requireNumbers: { type: Boolean, default: true },
            requireSymbols: { type: Boolean, default: true },
            requireUppercase: { type: Boolean, default: true },
            requireLowercase: { type: Boolean, default: true },
            passwordExpiryDays: { type: Number, default: 90 }
        }
    },

    compliance: {
        gdprCompliant: {
            type: Boolean,
            default: true
        },
        dataRetentionPolicy: {
            type: String,
            default: 'User data is retained only as long as necessary for business or legal purposes.'
        },
        cookieConsent: {
            enabled: { type: Boolean, default: true },
            bannerText: String,
            privacyPolicyUrl: String
        },
        dataEncryption: {
            enabled: { type: Boolean, default: true },
            algorithm: { type: String, default: 'aes-256-gcm' }
        },
        dataProcessingAddendumUrl: String
    },

    notifications: {
        sendPlatformEmails: {
            type: Boolean,
            default: true
        },
        enableSlackAlerts: {
            type: Boolean,
            default: false
        },
        slackWebhookUrl: String,
        enableDiscordAlerts: {
            type: Boolean,
            default: false
        },
        discordWebhookUrl: String,
        alertTypes: {
            security: { type: Boolean, default: true },
            billing: { type: Boolean, default: true },
            system: { type: Boolean, default: true }
        }
    },

    defaultPolicySettings: {
        requirePolicyAcceptance: {
            type: Boolean,
            default: true
        },
        forceReacceptOnUpdate: {
            type: Boolean,
            default: true
        }
    },

    meta: {
        seoTitle: String,
        seoDescription: String,
        metaImageUrl: String
    },

    analytics: {
        googleAnalyticsId: String,
        googleTagManagerId: String,
        enableTelemetry: {
            type: Boolean,
            default: true
        },
        privacyMode: {
            type: Boolean,
            default: false
        }
    },

    // New integration section
    integrations: {
        stripe: {
            enabled: { type: Boolean, default: false },
            publicKey: String,
            secretKey: String
        },
        sendgrid: {
            enabled: { type: Boolean, default: false },
            apiKey: String,
            fromEmail: String
        },
        aws: {
            region: String,
            bucketName: String
        }
    },
    backup: {
        autoBackup: {
            type: Boolean,
            default: true
        },
        backupFrequency: {
            type: String,
            enum: ['daily', 'weekly', 'monthly'],
            default: 'daily'
        },
        retentionDays: {
            type: Number,
            default: 30
        }
    },

    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: `${process.env.APP_NAME}_Admin`
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: `${process.env.APP_NAME}_Admin`
    }
}, {
    timestamps: true
});

// Only keep this - it's the most reliable
PlatformSettingsSchema.pre('save', function (next) {
    if (this.isNew) {
        mongoose.model(`${process.env.APP_NAME}_PlatformSettings`).countDocuments({})
            .then(count => {
                if (count > 0) {
                    throw new Error('Only one platform settings entry allowed');
                }
                next();
            })
            .catch(next);
    } else {
        next();
    }
});

// Keep this simple getSingleton method
PlatformSettingsSchema.statics.getSingleton = async function () {
    let settings = await this.findOne();
    if (!settings) {
        settings = await this.create({ companyName: 'Your Company Name' });
    }
    return settings;
};

module.exports = mongoose.model(`${process.env.APP_NAME}_PlatformSettings`, PlatformSettingsSchema);
