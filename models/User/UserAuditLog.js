// models/UserAuditLog.js
const mongoose = require('mongoose');

const UserAuditLogSchema = new mongoose.Schema({
    action: {
        type: String,
        required: true,
        enum: [
            'login',
            'logout',
            'register',
            'password_change',
            'profile_update',
            'email_verification',
            'password_reset',
            'mfa_enabled',
            'mfa_disabled',
            'device_added',
            'device_removed',
            'session_created',
            'session_terminated',
            'consent_given',
            'consent_revoked',
            'data_export',
            'account_deletion',
            'failed_login',
            'suspicious_activity',
            'blocked',
            'unblocked',
            'preferences_updated',
            'notification_settings_updated',
            'failed_login',
            'profile_viewed',
            'token_verification_failed',
            'token_verified',
            'notification_settings_viewed',
            'security_settings_viewed',
            'security_setting_updated',
            'security_pin_created',
            'logout_all_devices',     // NEW - for logout from all devices
            'security_settings_viewed', // NEW - already used in routes
            'notification_settings_viewed', // NEW - already used in routes
            'otp_resent',             // NEW - already used in routes
            'otp_verified',           // NEW - already used in routes
            'profile_viewed',         // Already exists ✓
            'token_verified',         // Already exists ✓
            'token_verification_failed', // Already exists ✓
            'oauth_login',            // NEW - already used in routes
            'oauth_callback',         // NEW - already used in routes
            'unauthorized_access',    // NEW - already used in routes
            'security_setting_updated', // Already exists ✓
            'security_pin_created',   // Already exists ✓
            // Add these for consistency with your routes:
            'account_deletion',       // Already exists ✓
            'account_deletion_failed', // NEW
            'account_deletion_initiated', // NEW
            'account_deletion_error', // NEW
            'unauthorized_deletion_attempt' // NEW
        ]
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: `${process.env.APP_NAME}_User`,
        required: true
    },
    clientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: `${process.env.APP_NAME}_Client`
    },
    ipAddress: String,
    userAgent: String,
    userAgentDetails: {
        browser: String,
        os: String,
        device: String,
        platform: String,
        isMobile: Boolean,
        isTablet: Boolean,
        isDesktop: Boolean
    },
    location: {
        country: String,
        region: String,
        city: String,
        coordinates: {
            latitude: Number,
            longitude: Number
        },
        timezone: String
    },
    metadata: mongoose.Schema.Types.Mixed,
    status: {
        type: String,
        enum: ['success', 'failure', 'pending'],
        required: true
    },
    severity: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical'],
        default: 'low'
    },
    resourceType: {
        type: String,
        enum: [
            'admin',
            'client',
            'user',
            'profile',
            'security',
            'privacy',
            'devices',
            'sessions',
            'preferences',
            'notifications',
               'account',      // NEW - for account-level operations
        'authentication', // NEW - for auth-specific logs
        'authorization' // NEW - for permission-related logs
        ]
    },
    resourceId: mongoose.Schema.Types.ObjectId,
    changes: [{
        field: String,
        oldValue: mongoose.Schema.Types.Mixed,
        newValue: mongoose.Schema.Types.Mixed
    }],
    duration: {
        type: Number, // in milliseconds
        default: 0
    },
    sessionId: String,
    deviceId: String,
    correlationId: String,
    riskScore: {
        type: Number,
        min: 0,
        max: 100,
        default: 0
    },
    isSuspicious: {
        type: Boolean,
        default: false
    },
    isDeleted: {
        type: Boolean,
        default: false
    },
    deletedAt: {
        type: Date,
        default: null
    },
    deletedBy: {
        adminId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: `${process.env.APP_NAME}_Admin`
        },
        email: String,
        name: String
    },
    // In models/UserAuditLog.js - Add to indexes array
}, {
    timestamps: true,
    indexes: [
        { userId: 1, createdAt: -1 },
        { clientId: 1, createdAt: -1 },
        { action: 1, createdAt: -1 },
        { status: 1, createdAt: -1 },
        { severity: 1, createdAt: -1 },
        { isSuspicious: 1, createdAt: -1 },
        { deviceId: 1, createdAt: -1 },
        { sessionId: 1, createdAt: -1 },
        { correlationId: 1 },
        // Add TTL index for automatic expiration
        {
            createdAt: 1,
            expireAfterSeconds: process.env.USER_AUDIT_LOGS_RETENTION_DAYS
                ? parseInt(process.env.USER_AUDIT_LOGS_RETENTION_DAYS) * 24 * 60 * 60
                : 180 * 24 * 60 * 60 // Default 180 days
        }
    ]
});

// Add cleanup methods
UserAuditLogSchema.statics.cleanupOldLogs = async function (retentionDays = null) {
    try {
        const days = retentionDays || parseInt(process.env.USER_AUDIT_LOGS_RETENTION_DAYS) || 180;
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);

        const result = await this.deleteMany({
            createdAt: { $lt: cutoffDate }
        });

        console.log(`User audit logs cleanup: Deleted ${result.deletedCount} logs older than ${days} days`);
        return result;
    } catch (error) {
        console.error('User audit logs cleanup error:', error);
        throw error;
    }
};

UserAuditLogSchema.statics.getRetentionSettings = function () {
    const retentionDays = parseInt(process.env.USER_AUDIT_LOGS_RETENTION_DAYS) || 180;
    return {
        retentionDays: retentionDays,
        description: `User audit logs are automatically deleted after ${retentionDays} days`
    };
};

// Virtual for readable timestamp
UserAuditLogSchema.virtual('readableTimestamp').get(function () {
    return this.createdAt.toLocaleString();
});

// Static method to get user audit statistics
UserAuditLogSchema.statics.getUserStats = async function (userId, timeframe = '30d') {
    const timeFilter = {};
    const now = new Date();

    switch (timeframe) {
        case '24h':
            timeFilter.createdAt = { $gte: new Date(now - 24 * 60 * 60 * 1000) };
            break;
        case '7d':
            timeFilter.createdAt = { $gte: new Date(now - 7 * 24 * 60 * 60 * 1000) };
            break;
        case '30d':
            timeFilter.createdAt = { $gte: new Date(now - 30 * 24 * 60 * 60 * 1000) };
            break;
        case '90d':
            timeFilter.createdAt = { $gte: new Date(now - 90 * 24 * 60 * 60 * 1000) };
            break;
    }

    const stats = await this.aggregate([
        { $match: { userId: mongoose.Types.ObjectId(userId), ...timeFilter } },
        {
            $facet: {
                overview: [
                    {
                        $group: {
                            _id: null,
                            totalActions: { $sum: 1 },
                            successCount: { $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] } },
                            failureCount: { $sum: { $cond: [{ $eq: ['$status', 'failure'] }, 1, 0] } },
                            suspiciousCount: { $sum: { $cond: [{ $eq: ['$isSuspicious', true] }, 1, 0] } },
                            uniqueDevices: { $addToSet: '$deviceId' },
                            uniqueSessions: { $addToSet: '$sessionId' }
                        }
                    }
                ],
                activityTrend: [
                    {
                        $group: {
                            _id: {
                                $dateToString: {
                                    format: "%Y-%m-%d",
                                    date: "$createdAt"
                                }
                            },
                            count: { $sum: 1 },
                            successful: { $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] } },
                            failed: { $sum: { $cond: [{ $eq: ['$status', 'failure'] }, 1, 0] } }
                        }
                    },
                    { $sort: { _id: 1 } }
                ],
                deviceBreakdown: [
                    {
                        $group: {
                            _id: '$userAgentDetails.device',
                            count: { $sum: 1 },
                            lastUsed: { $max: '$createdAt' }
                        }
                    },
                    { $sort: { count: -1 } }
                ],
                locationBreakdown: [
                    {
                        $group: {
                            _id: '$location.country',
                            count: { $sum: 1 },
                            regions: { $addToSet: '$location.region' }
                        }
                    },
                    { $sort: { count: -1 } }
                ]
            }
        }
    ]);

    return {
        overview: stats[0].overview[0] || {
            totalActions: 0,
            successCount: 0,
            failureCount: 0,
            suspiciousCount: 0,
            uniqueDevices: [],
            uniqueSessions: []
        },
        activityTrend: stats[0].activityTrend,
        deviceBreakdown: stats[0].deviceBreakdown,
        locationBreakdown: stats[0].locationBreakdown
    };
};

// Method to detect suspicious activity
UserAuditLogSchema.statics.detectSuspiciousActivity = async function (userId, currentLog) {
    const recentLogs = await this.find({
        userId,
        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        isSuspicious: false
    }).limit(50);

    let riskScore = 0;
    const flags = [];

    // Check for multiple failed logins
    const failedLogins = recentLogs.filter(log =>
        log.action === 'failed_login' && log.status === 'failure'
    ).length;

    if (failedLogins > 5) {
        riskScore += 30;
        flags.push('multiple_failed_logins');
    }

    // Check for location changes
    const uniqueLocations = new Set(recentLogs.map(log =>
        log.location ? `${log.location.country}-${log.location.region}` : 'unknown'
    ));

    if (uniqueLocations.size > 3 && currentLog.location) {
        const currentLocation = `${currentLog.location.country}-${currentLog.location.region}`;
        if (!recentLogs.some(log =>
            log.location && `${log.location.country}-${log.location.region}` === currentLocation
        )) {
            riskScore += 40;
            flags.push('unusual_location');
        }
    }

    // Check for device changes
    if (currentLog.userAgentDetails && currentLog.userAgentDetails.device) {
        const recentDevices = new Set(recentLogs.map(log =>
            log.userAgentDetails ? log.userAgentDetails.device : 'unknown'
        ));

        if (!recentDevices.has(currentLog.userAgentDetails.device)) {
            riskScore += 20;
            flags.push('new_device');
        }
    }

    // Check for unusual time activity
    const hour = currentLog.createdAt.getHours();
    if (hour < 6 || hour > 22) { // Activity between 10 PM and 6 AM
        riskScore += 10;
        flags.push('unusual_time');
    }

    return {
        riskScore: Math.min(riskScore, 100),
        isSuspicious: riskScore >= 50,
        flags
    };
};

// Method to log user activity
UserAuditLogSchema.statics.logActivity = async function (data) {
    const logData = {
        ...data,
        createdAt: new Date(),
        updatedAt: new Date()
    };

    // Detect suspicious activity for security-related actions
    if (['login', 'password_change', 'mfa_enabled', 'mfa_disabled'].includes(data.action)) {
        const suspiciousInfo = await this.detectSuspiciousActivity(data.userId, logData);
        logData.riskScore = suspiciousInfo.riskScore;
        logData.isSuspicious = suspiciousInfo.isSuspicious;
        logData.metadata = {
            ...data.metadata,
            securityFlags: suspiciousInfo.flags
        };
    }

    return this.create(logData);
};

module.exports = mongoose.model(`${process.env.APP_NAME}_User_AuditLog`, UserAuditLogSchema);