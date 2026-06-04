// models/TokenSyncLog.js
const mongoose = require('mongoose');

const TokenSyncLogSchema = new mongoose.Schema({
  // Identifiers
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: true
  },
  instanceId: {
    type: String,
    required: true,
    index: true
  },
  sessionId: {
    type: String,
    required: true,
    index: true
  },
  
  // Log data
  level: {
    type: String,
    enum: ['DEBUG', 'INFO', 'WARN', 'ERROR', 'SECURITY'],
    required: true
  },
  message: {
    type: String,
    required: true
  },
  details: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  
  // Technical context
  timestamp: {
    type: Date,
    required: true,
    index: true
  },
  userAgent: String,
  url: String,
  referrer: String,
  timezone: String,
  language: String,
  
  // Token state at time of log
  tokenState: {
    hasToken: Boolean,
    tokenLength: Number,
    syncInProgress: Boolean,
    retryCount: Number,
    isInitialized: Boolean
  },
  
  // Security audit fields
  securityAction: String,
  severity: String,
  riskLevel: String,
  ipAddress: String,
  
  // Performance data
  performance: mongoose.Schema.Types.Mixed
  
}, {
  timestamps: true
});

// Index for efficient querying
TokenSyncLogSchema.index({ clientId: 1, timestamp: -1 });
TokenSyncLogSchema.index({ instanceId: 1, timestamp: -1 });
TokenSyncLogSchema.index({ level: 1, timestamp: -1 });
TokenSyncLogSchema.index({ 'details.syncId': 1 });

module.exports = mongoose.model('TokenSyncLog', TokenSyncLogSchema);