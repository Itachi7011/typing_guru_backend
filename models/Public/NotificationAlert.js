const mongoose = require('mongoose');

const notificationAlertSchema = new mongoose.Schema({
    // Basic Information
    title: {
        type: String,
        required: [true, 'Title is required'],
        trim: true,
        maxlength: [200, 'Title cannot exceed 200 characters']
    },
    message: {
        type: String,
        required: [true, 'Message is required'],
        maxlength: [1000, 'Message cannot exceed 1000 characters']
    },

    // Type & Category
    type: {
        type: String,
        enum: ['info', 'warning', 'success', 'error', 'maintenance', 'update', 'announcement', 'promotion'],
        default: 'info'
    },
    category: {
        type: String,
        enum: ['system', 'security', 'feature', 'billing', 'service', 'marketing', 'custom'],
        default: 'system'
    },

    // Priority & Severity
    priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical'],
        default: 'medium'
    },
    severity: {
        type: String,
        enum: ['info', 'minor', 'moderate', 'severe', 'critical'],
        default: 'moderate'
    },

    // Audience Targeting
    targetAudience: {
        type: String,
        enum: ['all', 'clients', 'users', 'specific_clients', 'specific_users', 'admins', 'test'],
        default: 'all'
    },
    targetedClients: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: `${process.env.APP_NAME}_Client`
    }],
    targetedUsers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: `${process.env.APP_NAME}_User`
    }],

    // Display Settings
    displayType: {
        type: String,
        enum: ['banner', 'modal', 'toast', 'inline', 'email_only'],
        default: 'banner'
    },
    position: {
        type: String,
        enum: ['top', 'bottom', 'top-left', 'top-right', 'bottom-left', 'bottom-right', 'center'],
        default: 'top'
    },
    backgroundColor: {
        type: String,
        default: ''
    },
    textColor: {
        type: String,
        default: ''
    },
    icon: {
        type: String,
        default: ''
    },

    // Behavior & Timing
    startDate: {
        type: Date,
        required: [true, 'Start date is required']
    },
    endDate: {
        type: Date,
        required: [true, 'End date is required']
    },
    showOncePerUser: {
        type: Boolean,
        default: false
    },
    maxShowCountPerUser: {
        type: Number,
        default: 0, // 0 = unlimited
        min: 0
    },
    showInterval: {
        type: Number, // minutes between shows
        default: 0 // 0 = no interval restriction
    },
    dismissible: {
        type: Boolean,
        default: true
    },
    autoDismiss: {
        type: Boolean,
        default: false
    },
    autoDismissDelay: {
        type: Number, // milliseconds
        default: 5000
    },

    // Content & Actions
    link: {
        url: String,
        text: String,
        openInNewTab: {
            type: Boolean,
            default: true
        }
    },
    actionButton: {
        text: String,
        url: String,
        actionType: String, // 'navigate', 'dismiss', 'custom'
        onClickCode: String // custom JavaScript function
    },
    imageUrl: String,
    videoUrl: String,

    // Schedule & Recurrence
    recurrence: {
        type: String,
        enum: ['none', 'daily', 'weekly', 'monthly', 'custom'],
        default: 'none'
    },
    recurrencePattern: {
        daysOfWeek: [Number], // 0-6 for Sunday-Saturday
        daysOfMonth: [Number], // 1-31
        months: [Number], // 0-11 for January-December
        customCron: String
    },

    // A/B Testing
    isAbtest: {
        type: Boolean,
        default: false
    },
    abTestVariants: [{
        variantId: String,
        title: String,
        message: String,
        displayType: String,
        weight: { type: Number, default: 1 },
        showCount: { type: Number, default: 0 },
        clickCount: { type: Number, default: 0 }
    }],

    // Analytics & Tracking
    impressions: {
        type: Number,
        default: 0
    },
    clicks: {
        type: Number,
        default: 0
    },
    dismissals: {
        type: Number,
        default: 0
    },
    conversionRate: {
        type: Number,
        default: 0
    },

    // User Engagement Tracking
    userEngagements: [{
        userId: mongoose.Schema.Types.ObjectId,
        clientId: mongoose.Schema.Types.ObjectId,
        viewedAt: Date,
        clickedAt: Date,
        dismissedAt: Date,
        actionTaken: String,
        sessionId: String,
        deviceInfo: Object
    }],

    // Status & Control
    status: {
        type: String,
        enum: ['draft', 'scheduled', 'active', 'paused', 'expired', 'archived'],
        default: 'draft'
    },
    isActive: {
        type: Boolean,
        default: true
    },
    requireAcknowledgement: {
        type: Boolean,
        default: false
    },
    acknowledgementRequiredFor: [String], // ['clients', 'users', 'admins']

    // Advanced Features
    conditions: {
        type: Map,
        of: mongoose.Schema.Types.Mixed
        // Example: { 'user.tier': 'premium', 'client.plan': 'enterprise' }
    },
    customRules: String, // JavaScript function for complex conditions
    geoTargeting: {
        countries: [String],
        regions: [String],
        cities: [String],
        excludeCountries: [String]
    },
    // Page Targeting
    pageTargeting: {
        type: {
            type: String,
            enum: ['all_pages', 'specific_pages', 'except_pages', 'regex_pattern'],
            default: 'all_pages'
        },
        pages: [{
            path: String, // e.g., '/dashboard', '/settings'
            exactMatch: {
                type: Boolean,
                default: true
            },
            includeSubpaths: {
                type: Boolean,
                default: false
            }
        }],
        exceptPages: [{
            path: String,
            exactMatch: {
                type: Boolean,
                default: true
            },
            includeSubpaths: {
                type: Boolean,
                default: false
            }
        }],
        regexPattern: String
    },

    // Route/Path Conditions
    routeConditions: {
        requireAuth: {
            type: Boolean,
            default: false
        },
        userRoles: [String], // ['admin', 'user', 'client_admin', etc.]
        userTiers: [String], // ['free', 'pro', 'enterprise']
        subscriptionStatus: [String] // ['active', 'trial', 'expired']
    },
    deviceTargeting: {
        desktop: Boolean,
        mobile: Boolean,
        tablet: Boolean,
        specificBrowsers: [String]
    },

    // Metadata
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: `${process.env.APP_NAME}_Admin`,
        required: true
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: `${process.env.APP_NAME}_Admin`
    },
    tags: [String],
    notes: String,

    // Timestamps
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Virtual for checking if currently active
notificationAlertSchema.virtual('isCurrentlyActive').get(function () {
    const now = new Date();
    return this.isActive &&
        this.status === 'active' &&
        now >= this.startDate &&
        now <= this.endDate;
});

// Virtual for time remaining
notificationAlertSchema.virtual('timeRemaining').get(function () {
    const now = new Date();
    if (now < this.startDate) return 'Not started';
    if (now > this.endDate) return 'Expired';
    return this.endDate - now;
});

// Indexes for performance
notificationAlertSchema.index({ status: 1, isActive: 1 });
notificationAlertSchema.index({ startDate: 1, endDate: 1 });
notificationAlertSchema.index({ targetAudience: 1, targetedClients: 1 });
notificationAlertSchema.index({ type: 1, category: 1 });
notificationAlertSchema.index({ createdAt: -1 });

// Pre-save middleware
notificationAlertSchema.pre('save', function (next) {
    this.updatedAt = Date.now();

    // Auto-update status based on dates
    const now = new Date();
    if (this.isActive) {
        if (now < this.startDate) {
            this.status = 'scheduled';
        } else if (now > this.endDate) {
            this.status = 'expired';
        } else {
            this.status = 'active';
        }
    }

    next();
});

// Methods
notificationAlertSchema.methods.incrementImpressions = function () {
    this.impressions += 1;
    return this.save();
};

notificationAlertSchema.methods.incrementClicks = function () {
    this.clicks += 1;
    return this.save();
};

notificationAlertSchema.methods.addUserEngagement = function (engagementData) {
    this.userEngagements.push(engagementData);
    return this.save();
};

// Static methods
notificationAlertSchema.statics.getActiveNotifications = function (userId = null, clientId = null, filters = {}) {
    const now = new Date();
    const query = {
        isActive: true,
        status: 'active',
        startDate: { $lte: now },
        endDate: { $gte: now },
        ...filters
    };

    // Add audience filtering
    if (userId || clientId) {
        query.$or = [
            { targetAudience: 'all' },
            { targetAudience: 'clients' },
            { targetAudience: 'users' }
        ];

        if (clientId) {
            query.$or.push({
                targetAudience: 'specific_clients',
                targetedClients: clientId
            });
        }

        if (userId) {
            query.$or.push({
                targetAudience: 'specific_users',
                targetedUsers: userId
            });
        }
    }

    return this.find(query)
        .sort({ priority: -1, createdAt: -1 })
        .populate('createdBy', 'name email')
        .populate('updatedBy', 'name email');
};

const NotificationAlert = mongoose.model(`${process.env.APP_NAME}_NotificationAlert`, notificationAlertSchema);

module.exports = NotificationAlert;