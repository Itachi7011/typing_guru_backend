const mongoose = require('mongoose');

const AdminActivitySchema = new mongoose.Schema({
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: `${process.env.APP_NAME}_Admin`
  },

  // Core activity information
  eventType: {
    type: String,
    required: true,
    enum: [
      'user_management', // e.g., create, delete, suspend user
      'form_management', // e.g., create, delete, suspend form
      'client_management', // e.g., client settings changes
      'security', // login, MFA changes, lockout, suspicious IP
      'system_config', // e.g., global settings, environment changes
      'permission', // role updates, access grants
      'audit_control', // deletion/restoration of logs, edits
      'admin_management', // creating/modifying other admins
      'notification', // triggering system/client notifications
      'ai_flag_action', // resolving or escalating AI anomaly flags
      'compliance', // legal/PII data access/export
      'billing', // manual billing changes or refunds
      'login_activity', // admin login, logout, mfa triggered
      `user_blocked`,
      `user_unblocked`,
      `monitoring`,
      `privacy_policy_created`,
      `privacy_policy_version_added`,
      `privacy_policy_publish`,
      `privacy_policy_updated`,
      `privacy_policy_deleted`,
      `terms_created`,
      `terms_version_added`,
      `terms_published`,
      `social_link_removed`,
      `business_hours_added`,
      `business_hours_removed`,
      `regional_setting_added`,
      `regional_setting_removed`,
      `feature_flag_added`,
      `feature_flag_updated`,
      `feature_flag_removed`,
      `settings_restored`,
      `security_management`,
      `notification_alerts_viewed`,
      `notification_alerts_bulk_status`,

    ]
  },

  eventAction: {
    type: String,
    required: true, // e.g., 'user_suspended', 'client_updated', 'mfa_disabled', etc.
    maxlength: 100
  },

  // Optional: target resource this admin interacted with
  target: {
    targetId: mongoose.Schema.Types.ObjectId,
    targetModel: {
      type: String,
      enum: [`${process.env.APP_NAME}_User`, `${process.env.APP_NAME}_Client`, `${process.env.APP_NAME}_Admin`, 'System', 'Settings', 'Logs', 'Policy', 'None']
    }
  },

  eventData: mongoose.Schema.Types.Mixed, // any relevant payload
  status: {
    type: String,
    enum: ['success', 'failure', 'pending', 'failed'],
    default: 'success'
  },
  errorMessage: String,

  ipAddress: String,
  userAgent: String,
  location: {
    city: String,
    region: String,
    country: String
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
  alertSeverity: {
    type: String,
    enum: ['info', 'warning', 'error', 'critical']
  }

// In models/AdminActivity.js - Add to indexes array
}, { 
    timestamps: true,
    indexes: [
        { adminId: 1, createdAt: -1 },
        { eventType: 1, eventAction: 1 },
        { target: 1 },
        { createdAt: 1 },
        { 'location.country': 1 },
        { status: 1 },
        // Add TTL index for automatic expiration
        { 
            createdAt: 1, 
            expireAfterSeconds: process.env.ADMIN_ACTIVITY_LOGS_RETENTION_DAYS 
                ? parseInt(process.env.ADMIN_ACTIVITY_LOGS_RETENTION_DAYS) * 24 * 60 * 60 
                : 365 * 24 * 60 * 60 // Default 365 days
        }
    ]
});

// Add cleanup methods
AdminActivitySchema.statics.cleanupOldLogs = async function (retentionDays = null) {
    try {
        const days = retentionDays || parseInt(process.env.ADMIN_ACTIVITY_LOGS_RETENTION_DAYS) || 365;
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        
        const result = await this.deleteMany({
            createdAt: { $lt: cutoffDate }
        });
        
        console.log(`Admin activity logs cleanup: Deleted ${result.deletedCount} logs older than ${days} days`);
        return result;
    } catch (error) {
        console.error('Admin activity logs cleanup error:', error);
        throw error;
    }
};

AdminActivitySchema.statics.getRetentionSettings = function () {
    const retentionDays = parseInt(process.env.ADMIN_ACTIVITY_LOGS_RETENTION_DAYS) || 365;
    return {
        retentionDays: retentionDays,
        description: `Admin activity logs are automatically deleted after ${retentionDays} days`
    };
};

AdminActivitySchema.index({ adminId: 1, createdAt: -1 });
AdminActivitySchema.index({ eventType: 1, eventAction: 1 });
AdminActivitySchema.index({ target: 1 });
AdminActivitySchema.index({ createdAt: 1 });
AdminActivitySchema.index({ 'location.country': 1 });
AdminActivitySchema.index({ status: 1 });

module.exports = mongoose.model(`${process.env.APP_NAME}_AdminActivity`, AdminActivitySchema);
