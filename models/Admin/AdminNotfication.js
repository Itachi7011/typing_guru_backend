const mongoose = require('mongoose');

const AdminNotificationSchema = new mongoose.Schema({
    recipient: {
        adminId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            ref: `${process.env.APP_NAME}_Admin`
        }
    },

    type: {
        type: String,
        required: true,
        enum: [
            'system_alert', 'security_alert', 'compliance',
            'audit_log', 'ai_anomaly', 'admin_action_required',
            'admin_message', 'update_notice', 'policy_change',
            'login_activity', 'mfa_prompt'
        ]
    },

    priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'urgent'],
        default: 'medium'
    },

    title: {
        type: String,
        required: true,
        trim: true,
        maxlength: 120
    },

    message: {
        type: String,
        required: true,
        maxlength: 1000
    },

    data: mongoose.Schema.Types.Mixed, // Optional: linked resource
    actionLink: String,
    actionLabel: String,

    relatedComponent: {
        type: String,
        enum: ['user_management', 'admin_panel', 'audit_log', 'system_settings', 'security_console', 'mfa_center']
    },

    isRead: { type: Boolean, default: false },
    readAt: Date,
    isArchived: { type: Boolean, default: false },
    archivedAt: Date,
    isAcknowledged: { type: Boolean, default: false },
    acknowledgedAt: Date,

    expiresAt: Date,

    triggeredBy: {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            refPath: 'triggeredBy.userModel'
        },
        userModel: {
            type: String,
            enum: [`${process.env.APP_NAME}_Admin`, 'System']
        }
    },

    // For system-wide alerts to multiple admins
    isBroadcast: {
        type: Boolean,
        default: false
    },
    broadcastCriteria: {
        role: [String], // e.g., ['superadmin', 'auditor']
        minCreatedAt: Date,
        specificAdmins: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: `${process.env.APP_NAME}_Admin`
        }]
    },

    deliveryStatus: {
        inApp: {
            delivered: { type: Boolean, default: true },
            deliveredAt: { type: Date, default: Date.now }
        },
        email: {
            sent: { type: Boolean, default: false },
            sentAt: Date,
            error: String
        },
        webhook: {
            sent: { type: Boolean, default: false },
            sentAt: Date,
            response: mongoose.Schema.Types.Mixed
        }
    }
}, {
    timestamps: true
});

// Indexes
AdminNotificationSchema.index({ 'recipient.adminId': 1, isRead: 1, createdAt: -1 });
AdminNotificationSchema.index({ type: 1, priority: 1 });
AdminNotificationSchema.index({ isBroadcast: 1 });
AdminNotificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
AdminNotificationSchema.index({ createdAt: 1 });
AdminNotificationSchema.index({ 'deliveryStatus.email.sent': 1 });

// Auto-expiry fallback
AdminNotificationSchema.pre('save', function (next) {
    if (!this.expiresAt) {
        const expiry = new Date();
        switch (this.priority) {
            case 'urgent': expiry.setDate(expiry.getDate() + 7); break;
            case 'high': expiry.setDate(expiry.getDate() + 15); break;
            default: expiry.setDate(expiry.getDate() + 30);
        }
        this.expiresAt = expiry;
    }
    next();
});

// Static methods
AdminNotificationSchema.statics.getUnreadCount = function (adminId) {
    return this.countDocuments({
        'recipient.adminId': adminId,
        isRead: false,
        isArchived: false,
        expiresAt: { $gt: new Date() }
    });
};

AdminNotificationSchema.statics.markAsRead = function (adminId, notificationIds = []) {
    const filter = { 'recipient.adminId': adminId };
    if (notificationIds.length > 0) {
        filter._id = { $in: notificationIds };
    }

    return this.updateMany(filter, {
        isRead: true,
        readAt: new Date()
    });
};

AdminNotificationSchema.methods.requiresAction = function () {
    return this.priority === 'urgent' ||
        ['security_alert', 'ai_anomaly', 'compliance'].includes(this.type);
};

module.exports = mongoose.model(`${process.env.APP_NAME}_AdminNotification`, AdminNotificationSchema);
