// models/RecentSearch.js
const mongoose = require('mongoose');

const RecentSearchSchema = new mongoose.Schema({
  // User reference based on user type
  user: {
    id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true
    },
    model: {
      type: String,
      required: true,
      enum: [
        `${process.env.APP_NAME}_User`,
        `${process.env.APP_NAME}_Client`, 
        `${process.env.APP_NAME}_Admin`,
        `${process.env.APP_NAME}_ClientTeamMember`
      ],
      index: true
    },
    email: String,
    name: String,
    userType: {
      type: String,
      enum: ['admin', 'Client', 'user', 'team_member'],
      required: true
    }
  },
  
  // Search details
  query: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  target: {
    type: String,
    enum: ['admin', 'client', 'user', 'public'],
    required: true,
    index: true
  },
  
  // Results information
  resultsCount: {
    type: Number,
    default: 0
  },
  selectedSuggestion: {
    suggestionId: mongoose.Schema.Types.ObjectId,
    text: String,
    route: String,
    type: String
  },
  
  // Client context (for multi-tenant)
  clientContext: {
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: `${process.env.APP_NAME}_Client`,
      index: true
    },
    websiteId: {
      type: mongoose.Schema.Types.ObjectId,
      index: true
    },
    apiKeyId: {
      type: mongoose.Schema.Types.ObjectId,
      index: true
    }
  },
  
  // Filters and context
  filters: {
    type: {
      type: String,
      enum: ['all', 'users', 'clients', 'settings', 'analytics', 'billing']
    },
    category: String,
    dateRange: {
      from: Date,
      to: Date
    }
  },
  
  // Session and device info
  sessionId: {
    type: String,
    index: true
  },
  deviceInfo: {
    userAgent: String,
    ip: String,
    platform: String,
    browser: String,
    os: String,
    deviceType: {
      type: String,
      enum: ['desktop', 'mobile', 'tablet', 'unknown']
    }
  },
  
  // Performance metrics
  performance: {
    searchDuration: Number, // milliseconds
    responseTime: Number, // milliseconds
    totalResults: Number
  },
  
  // Metadata
  metadata: {
    referrer: String,
    pageUrl: String,
    searchContext: String, // e.g., 'navbar', 'dashboard', 'sidebar'
    saved: {
      type: Boolean,
      default: false
    },
    tags: [String]
  },
  
  // Analytics
  clicked: {
    type: Boolean,
    default: false
  },
  clickedAt: Date,
  conversion: {
    type: String,
    enum: ['navigation', 'action', 'download', 'purchase', 'none'],
    default: 'navigation'
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
RecentSearchSchema.index({ 'user.id': 1, 'user.model': 1, createdAt: -1 });
RecentSearchSchema.index({ query: 1, target: 1 });
RecentSearchSchema.index({ 'clientContext.clientId': 1, createdAt: -1 });
RecentSearchSchema.index({ sessionId: 1, createdAt: -1 });
RecentSearchSchema.index({ 'user.userType': 1, target: 1 });

// Pre-save middleware
RecentSearchSchema.pre('save', function(next) {
  // Truncate query if too long
  if (this.query && this.query.length > 500) {
    this.query = this.query.substring(0, 500);
  }
  
  next();
});

// Instance methods
RecentSearchSchema.methods.getFormattedQuery = function() {
  return this.query.trim();
};

RecentSearchSchema.methods.getSearchContext = function() {
  return {
    userType: this.user.userType,
    target: this.target,
    client: this.clientContext?.clientId || null,
    device: this.deviceInfo?.deviceType || 'unknown'
  };
};

// Static methods
RecentSearchSchema.statics.getRecentForUser = async function(userId, userModel, target, limit = 10) {
  return this.find({
    'user.id': userId,
    'user.model': userModel,
    target: target
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
};

RecentSearchSchema.statics.getPopularQueries = async function(target, userType = null, days = 7) {
  const dateThreshold = new Date();
  dateThreshold.setDate(dateThreshold.getDate() - days);
  
  const matchQuery = {
    target: target,
    createdAt: { $gte: dateThreshold }
  };
  
  if (userType) {
    matchQuery['user.userType'] = userType;
  }
  
  return this.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: '$query',
        count: { $sum: 1 },
        uniqueUsers: { $addToSet: '$user.id' },
        lastSearched: { $max: '$createdAt' },
        avgResults: { $avg: '$resultsCount' }
      }
    },
    {
      $project: {
        query: '$_id',
        count: 1,
        uniqueUsersCount: { $size: '$uniqueUsers' },
        lastSearched: 1,
        avgResults: { $round: ['$avgResults', 2] }
      }
    },
    { $sort: { count: -1 } },
    { $limit: 20 }
  ]);
};

RecentSearchSchema.statics.clearUserHistory = async function(userId, userModel, target = null) {
  const query = {
    'user.id': userId,
    'user.model': userModel
  };
  
  if (target) {
    query.target = target;
  }
  
  return this.deleteMany(query);
};

RecentSearchSchema.statics.cleanupOldSearches = async function(daysToKeep = 90) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
  
  return this.deleteMany({
    createdAt: { $lt: cutoffDate },
    'metadata.saved': { $ne: true }
  });
};

// Method to track search conversion
RecentSearchSchema.statics.trackConversion = async function(searchId, conversionType, metadata = {}) {
  return this.findByIdAndUpdate(searchId, {
    $set: {
      'clicked': true,
      'clickedAt': new Date(),
      'conversion': conversionType,
      ...metadata
    }
  });
};

module.exports = mongoose.model(`${process.env.APP_NAME}_RecentSearch`, RecentSearchSchema);