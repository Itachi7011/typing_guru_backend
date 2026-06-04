// models/AdminAuditLog.js
const mongoose = require('mongoose');

const AdminAuditLogSchema = new mongoose.Schema({
    action: {
        type: String,
        required: true,
        enum: [
            'login',
            'logout',
            'password_change',
            'profile_update',
            'admin_created',
            'admin_updated',
            'admin_deleted',
            'admin_suspended',
            'admin_activated',
            'client_created',
            'client_updated',
            'client_deleted',
            'client_suspended',
            'client_activated',
            'client_restored',
            'client_blocked',
            'client_unblocked',
            'client_permanently_deleted',
            'user_created',
            'user_updated',
            'user_deleted',
            'user_permanently_deleted',
            'user_suspended',
            'user_activated',
            'user_blocked',
            'user_unblocked',
            'user_restored',
            'billing_updated',
            'subscription_updated',
            'settings_updated',
            'api_access_granted',
            'api_access_revoked',
            'mfa_enabled',
            'mfa_disabled',
            'permission_updated',
            'role_updated',
            'system_config_updated',
            'backup_created',
            'backup_restored',
            'audit_log_viewed',
            'report_generated',
            'failed_login',
            'password_reset',
            'email_verification',
            `terms_created`,
            `terms_version_added`,
            `terms_published`,
            `privacy_policy_created`,
            `privacy_policy_version_added`,
            `settings_restored`,
            `feature_flag_added`,
            `feature_flag_updated`,
            `feature_flag_removed`,
            `business_hours_added`,
            `business_hours_removed`,
            `regional_setting_added`,
            `regional_setting_removed`,
            `social_link_removed`,
            'form_created',
            'form_updated',
            'form_deleted',
            'form_permanently_deleted',
            'service_status_checked',
            'security_verification_failed',
            'security_verification',
            'security_settings_update',
            'security_pin_changed',
            'notification_alert',
            'notification_alerts_viewed',
            'notification_alerts_bulk_status',
            'notification_alert_created',
            'notification_alert_updated',
            'notification_alert_deleted',
            'notification_analytics_viewed',
            'notification_alerts_bulk_status',

        ]
    },
    adminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: `${process.env.APP_NAME}_Admin`,
        required: true
    },
    targetAdminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: `${process.env.APP_NAME}_Admin`
    },
    targetClientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: `${process.env.APP_NAME}_Client`
    },
    targetUserId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: `${process.env.APP_NAME}_User`
    },
    ipAddress: String,
    userAgent: String,
    userAgentDetails: {
        browser: String,
        os: String,
        device: String,
        platform: String
    },
    location: {
        country: String,
        region: String,
        city: String,
        coordinates: {
            latitude: Number,
            longitude: Number
        }
    },
    metadata: mongoose.Schema.Types.Mixed,
    status: {
        type: String,
        enum: ['success', 'failure', 'pending', 'failed'],
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
            'admin',
            'client',
            'user',
            'billing',
            'subscription',
            'settings',
            'system',
            'api',
            'audit',
            'report',
            'admin_security',
            'security_verification',
            'AuditLog',
            'ActivityLog',
            'notification_alert'
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
    sessionId: String,
    correlationId: String,
    department: String,
    role: String
// In models/AdminAuditLog.js - Add to indexes array
}, {
    timestamps: true,
    indexes: [
        { adminId: 1, createdAt: -1 },
        { action: 1, createdAt: -1 },
        { status: 1, createdAt: -1 },
        { severity: 1, createdAt: -1 },
        { department: 1, createdAt: -1 },
        { role: 1, createdAt: -1 },
        { targetClientId: 1, createdAt: -1 },
        { correlationId: 1 },
        // Add TTL index for automatic expiration
        { 
            createdAt: 1, 
            expireAfterSeconds: process.env.ADMIN_AUDIT_LOGS_RETENTION_DAYS 
                ? parseInt(process.env.ADMIN_AUDIT_LOGS_RETENTION_DAYS) * 24 * 60 * 60 
                : 365 * 24 * 60 * 60 // Default 365 days
        }
    ]
});

// Add cleanup methods
AdminAuditLogSchema.statics.cleanupOldLogs = async function (retentionDays = null) {
    try {
        const days = retentionDays || parseInt(process.env.ADMIN_AUDIT_LOGS_RETENTION_DAYS) || 365;
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        
        const result = await this.deleteMany({
            createdAt: { $lt: cutoffDate }
        });
        
        console.log(`Admin audit logs cleanup: Deleted ${result.deletedCount} logs older than ${days} days`);
        return result;
    } catch (error) {
        console.error('Admin audit logs cleanup error:', error);
        throw error;
    }
};

AdminAuditLogSchema.statics.getRetentionSettings = function () {
    const retentionDays = parseInt(process.env.ADMIN_AUDIT_LOGS_RETENTION_DAYS) || 365;
    return {
        retentionDays: retentionDays,
        description: `Admin audit logs are automatically deleted after ${retentionDays} days`
    };
};

// Virtual for readable timestamp
AdminAuditLogSchema.virtual('readableTimestamp').get(function () {
    return this.createdAt.toLocaleString();
});

// Static method to get admin audit statistics
AdminAuditLogSchema.statics.getAdminStats = async function (adminId, timeframe = '30d') {
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
        { $match: { adminId: mongoose.Types.ObjectId(adminId), ...timeFilter } },
        {
            $facet: {
                summary: [
                    {
                        $group: {
                            _id: null,
                            totalActions: { $sum: 1 },
                            successCount: { $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] } },
                            failureCount: { $sum: { $cond: [{ $eq: ['$status', 'failure'] }, 1, 0] } }
                        }
                    }
                ],
                byAction: [
                    {
                        $group: {
                            _id: '$action',
                            count: { $sum: 1 },
                            success: { $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] } },
                            failure: { $sum: { $cond: [{ $eq: ['$status', 'failure'] }, 1, 0] } }
                        }
                    },
                    { $sort: { count: -1 } },
                    { $limit: 10 }
                ],
                byResource: [
                    {
                        $group: {
                            _id: '$resourceType',
                            count: { $sum: 1 }
                        }
                    },
                    { $sort: { count: -1 } }
                ],
                bySeverity: [
                    {
                        $group: {
                            _id: '$severity',
                            count: { $sum: 1 }
                        }
                    }
                ]
            }
        }
    ]);

    return {
        summary: stats[0].summary[0] || { totalActions: 0, successCount: 0, failureCount: 0 },
        byAction: stats[0].byAction,
        byResource: stats[0].byResource,
        bySeverity: stats[0].bySeverity
    };
};

// Method to log admin activity
AdminAuditLogSchema.statics.logActivity = function (data) {
    return this.create({
        ...data,
        createdAt: new Date(),
        updatedAt: new Date()
    });
};

module.exports = mongoose.model(`${process.env.APP_NAME}_Admin_AuditLog`, AdminAuditLogSchema);