const mongoose = require('mongoose');

const UserNotificationSchema = new mongoose.Schema({
    // Recipient of the notification
    recipient: {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            refPath: 'recipient.userModel'
        },
        userModel: {
            type: String,
            required: true,
            enum: [`${process.env.APP_NAME}_User`, `${process.env.APP_NAME}_Admin`, `${process.env.APP_NAME}_Client`]
        }
    },
    // The client/tenant context for the notification
    clientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: `${process.env.APP_NAME}_Client`
    },
    type: {
        type: String,
        required: true,
        enum: [
            'system_alert', 'security_alert', 'billing',
            'feature_update', 'announcement', 'social',
            'reminder', 'task_assignment', 'support_update'
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
        maxlength: 500
    },
    // Data for dynamic content or action handling
    data: mongoose.Schema.Types.Mixed,
    // Deep link or action URL
    actionLink: String,
    actionLabel: String,
    // Tracking for user interaction
    isRead: {
        type: Boolean,
        default: false
    },
    readAt: Date,
    isArchived: {
        type: Boolean,
        default: false
    },
    archivedAt: Date,
    expiresAt: Date, // For time-sensitive notifications
    // Optional sender information
    triggeredBy: {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            refPath: 'triggeredBy.userModel'
        },
        userModel: {
            type: String,
            enum: [`${process.env.APP_NAME}_User`, `${process.env.APP_NAME}_Admin`, `${process.env.APP_NAME}_Client`]
        }
    }
}, {
    timestamps: true
});

// Indexes for efficient querying and fetching
UserNotificationSchema.index({ 'recipient.userId': 1, isRead: 1, createdAt: -1 });
UserNotificationSchema.index({ clientId: 1, type: 1 });
UserNotificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // Auto-delete expired docs
UserNotificationSchema.index({ createdAt: 1 });

// Pre-save to set expiry if not set (e.g., default 30 days for non-urgent)
UserNotificationSchema.pre('save', function (next) {
    if (!this.expiresAt) {
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 30); // Default 30-day expiry
        this.expiresAt = expiryDate;
    }
    next();
});

module.exports = mongoose.model(`${process.env.APP_NAME}_UserNotification`, UserNotificationSchema);