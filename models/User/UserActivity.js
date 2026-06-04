const mongoose = require('mongoose');

const UserActivitySchema = new mongoose.Schema({
    // The user who performed the activity
    user: {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            refPath: 'user.userModel'
        },
        userModel: {
            type: String,
            required: true,
            enum: [`${process.env.APP_NAME}_User`, `${process.env.APP_NAME}_Admin`, `${process.env.APP_NAME}_Client`]
        }
    },
    // The client/tenant context
    clientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: `${process.env.APP_NAME}_Client`,
        required: true
    },
    // Core activity information
    eventType: {
        type: String,
        required: true // e.g., 'page_view', 'button_click', 'search_query', 'api_call', 'file_download'
    },
    eventAction: {
        type: String,
        required: true // e.g., 'viewed_dashboard', 'clicked_sign_up', 'searched_for_products'
    },
    // Detailed context about the event
    eventData: mongoose.Schema.Types.Mixed, // Flexible object for event-specific properties
    location: {
        pathname: String, // URL path
        search: String,   // Query params
        hash: String
    },
    element: { // For UI interactions
        id: String,
        type: String,
        name: String,
        classes: [String]
    },
    // Device and connection context
    ipAddress: String,
    userAgent: String,
    screenResolution: {
        width: Number,
        height: Number
    },
    viewportSize: {
        width: Number,
        height: Number
    },
    // Performance metrics (if applicable)
    performance: {
        loadTime: Number,
        responseTime: Number,
        domContentLoadedTime: Number
    }, isDeleted: {
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
    // Session context
    sessionId: String,
    // A/B Testing or Feature Flag context
    experiment: {
        id: String,
        variant: String
    }
// In UserActivitySchema - Replace the TTL index comment with actual index
}, {
    timestamps: true,
    indexes: [
        { 'user.userId': 1, createdAt: -1 },
        { clientId: 1, eventType: 1, createdAt: -1 },
        { eventAction: 1 },
        { createdAt: 1 },
        { clientId: 1, eventType: 1, 'user.userModel': 1, createdAt: -1 },
        // TTL index for auto-delete old events
        { 
            createdAt: 1, 
            expireAfterSeconds: process.env.USER_ACTIVITY_LOGS_RETENTION_DAYS 
                ? parseInt(process.env.USER_ACTIVITY_LOGS_RETENTION_DAYS) * 24 * 60 * 60 
                : 60 * 24 * 60 * 60 // Default 60 days
        }
    ]
});

// Add cleanup methods
UserActivitySchema.statics.cleanupOldLogs = async function (retentionDays = null) {
    try {
        const days = retentionDays || parseInt(process.env.USER_ACTIVITY_LOGS_RETENTION_DAYS) || 60;
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        
        const result = await this.deleteMany({
            createdAt: { $lt: cutoffDate }
        });
        
        console.log(`User activity logs cleanup: Deleted ${result.deletedCount} logs older than ${days} days`);
        return result;
    } catch (error) {
        console.error('User activity logs cleanup error:', error);
        throw error;
    }
};

UserActivitySchema.statics.getRetentionSettings = function () {
    const retentionDays = parseInt(process.env.USER_ACTIVITY_LOGS_RETENTION_DAYS) || 60;
    return {
        retentionDays: retentionDays,
        description: `User activity logs are automatically deleted after ${retentionDays} days`
    };
};

// Indexes for powerful analytics queries
UserActivitySchema.index({ 'user.userId': 1, createdAt: -1 });
UserActivitySchema.index({ clientId: 1, eventType: 1, createdAt: -1 });
UserActivitySchema.index({ eventAction: 1 });
UserActivitySchema.index({ createdAt: 1 }); // Time-series analysis
// Compound index for common analytics dashboards
UserActivitySchema.index({ clientId: 1, eventType: 1, 'user.userModel': 1, createdAt: -1 });

// Optional: TTL index to auto-delete old events for data retention (e.g., 2 years)
// UserActivitySchema.index({ createdAt: 1 }, { expireAfterSeconds: 63072000 }); // 2 years in seconds

module.exports = mongoose.model(`${process.env.APP_NAME}_UserActivity`, UserActivitySchema);