// models/SearchAnalytics.js
const mongoose = require('mongoose');

const SearchAnalyticsSchema = new mongoose.Schema({
  // Configuration reference
  configurationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: `${process.env.APP_NAME}_SearchConfiguration`,
    required: true,
    index: true
  },
  
  // Time period
  period: {
    type: String,
    enum: ['hourly', 'daily', 'weekly', 'monthly'],
    required: true,
    index: true
  },
  periodStart: {
    type: Date,
    required: true,
    index: true
  },
  periodEnd: {
    type: Date,
    required: true
  },
  
  // Core metrics
  metrics: {
    // Search volume
    totalSearches: { type: Number, default: 0 },
    uniqueSearchers: { type: Number, default: 0 },
    searchesPerUser: { type: Number, default: 0 },
    
    // Search quality
    noResultSearches: { type: Number, default: 0 },
    noResultRate: { type: Number, default: 0 },
    avgResultsPerSearch: { type: Number, default: 0 },
    avgQueryLength: { type: Number, default: 0 },
    
    // Performance
    avgResponseTime: { type: Number, default: 0 }, // milliseconds
    p95ResponseTime: { type: Number, default: 0 },
    p99ResponseTime: { type: Number, default: 0 },
    
    // Engagement
    clickThroughRate: { type: Number, default: 0 },
    avgTimeToClick: { type: Number, default: 0 },
    conversionRate: { type: Number, default: 0 },
    bounceRate: { type: Number, default: 0 },
    
    // User retention
    returningUsers: { type: Number, default: 0 },
    newUsers: { type: Number, default: 0 },
    userRetentionRate: { type: Number, default: 0 }
  },
  
  // User breakdown
  userBreakdown: {
    byUserType: {
      admin: { type: Number, default: 0 },
      Client: { type: Number, default: 0 },
      user: { type: Number, default: 0 },
      public: { type: Number, default: 0 }
    },
    byAuthStatus: {
      authenticated: { type: Number, default: 0 },
      anonymous: { type: Number, default: 0 }
    },
    byRole: {
      // Admin roles
      super_admin: { type: Number, default: 0 },
      admin: { type: Number, default: 0 },
      support: { type: Number, default: 0 },
      billing: { type: Number, default: 0 },
      read_only: { type: Number, default: 0 },
      // Client team roles
      owner: { type: Number, default: 0 },
      developer: { type: Number, default: 0 },
      billing_client: { type: Number, default: 0 },
      support_client: { type: Number, default: 0 },
      viewer: { type: Number, default: 0 }
    }
  },
  
  // Content performance
  topQueries: [{
    query: String,
    count: Number,
    clickThroughRate: Number,
    avgPositionClicked: Number,
    uniqueUsers: Number,
    firstSeen: Date,
    lastSeen: Date
  }],
  
  topSuggestions: [{
    suggestionId: mongoose.Schema.Types.ObjectId,
    text: String,
    route: String,
    type: String,
    impressions: Number,
    clicks: Number,
    clickThroughRate: Number,
    avgPosition: Number
  }],
  
  // Device and platform breakdown
  deviceBreakdown: {
    desktop: {
      searches: { type: Number, default: 0 },
      clickThroughRate: { type: Number, default: 0 },
      avgResponseTime: { type: Number, default: 0 }
    },
    mobile: {
      searches: { type: Number, default: 0 },
      clickThroughRate: { type: Number, default: 0 },
      avgResponseTime: { type: Number, default: 0 }
    },
    tablet: {
      searches: { type: Number, default: 0 },
      clickThroughRate: { type: Number, default: 0 },
      avgResponseTime: { type: Number, default: 0 }
    }
  },
  
  // Time-based patterns
  hourlyPattern: [{
    hour: Number, // 0-23
    searches: Number,
    clickThroughRate: Number
  }],
  
  // Client-specific metrics (for multi-tenant)
  clientMetrics: {
    totalClients: { type: Number, default: 0 },
    activeClients: { type: Number, default: 0 },
    topClients: [{
      clientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: `${process.env.APP_NAME}_Client`
      },
      name: String,
      searches: Number,
      users: Number
    }]
  },
  
  // Error tracking
  errorTracking: {
    totalErrors: { type: Number, default: 0 },
    errorRate: { type: Number, default: 0 },
    errorTypes: [{
      type: String,
      count: Number,
      lastOccurred: Date
    }]
  },
  
  // System performance
  systemMetrics: {
    cacheHitRate: { type: Number, default: 0 },
    databaseQueries: { type: Number, default: 0 },
    avgQueryTime: { type: Number, default: 0 },
    memoryUsage: { type: Number, default: 0 }
  },
  
  // Calculated scores
  scores: {
    searchQuality: { type: Number, default: 0, min: 0, max: 100 },
    userSatisfaction: { type: Number, default: 0, min: 0, max: 100 },
    systemPerformance: { type: Number, default: 0, min: 0, max: 100 },
    overallScore: { type: Number, default: 0, min: 0, max: 100 }
  },
  
  // Metadata
  calculatedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  calculationDuration: {
    type: Number, // milliseconds
    default: 0
  }
}, {
  timestamps: true
});

// Indexes
SearchAnalyticsSchema.index({ configurationId: 1, period: 1, periodStart: 1 }, { unique: true });
SearchAnalyticsSchema.index({ periodStart: -1 });
SearchAnalyticsSchema.index({ 'metrics.totalSearches': -1 });
SearchAnalyticsSchema.index({ 'scores.overallScore': -1 });

// Pre-save middleware
SearchAnalyticsSchema.pre('save', function(next) {
  // Calculate derived metrics
  if (this.metrics.totalSearches > 0) {
    this.metrics.noResultRate = (this.metrics.noResultSearches / this.metrics.totalSearches) * 100;
    this.metrics.searchesPerUser = this.metrics.totalSearches / Math.max(this.metrics.uniqueSearchers, 1);
    
    // Calculate user retention
    const totalUsers = this.metrics.uniqueSearchers;
    const returningUsers = this.userBreakdown.byUserType.admin + 
                         this.userBreakdown.byUserType.Client + 
                         this.userBreakdown.byUserType.user;
    this.metrics.userRetentionRate = totalUsers > 0 ? (returningUsers / totalUsers) * 100 : 0;
  }
  
  // Calculate scores
  this.calculateScores();
  
  next();
});

// Instance methods
SearchAnalyticsSchema.methods.calculateScores = function() {
  const scores = this.scores;
  
  // Search Quality Score (0-100)
  const qualityFactors = {
    clickThroughRate: this.metrics.clickThroughRate * 2, // Weighted
    noResultRate: Math.max(0, 100 - (this.metrics.noResultRate * 2)),
    avgResults: Math.min(100, this.metrics.avgResultsPerSearch * 10),
    conversionRate: this.metrics.conversionRate * 100
  };
  
  scores.searchQuality = Math.round(
    (qualityFactors.clickThroughRate * 0.4) +
    (qualityFactors.noResultRate * 0.3) +
    (qualityFactors.avgResults * 0.2) +
    (qualityFactors.conversionRate * 0.1)
  );
  
  // User Satisfaction Score (0-100)
  const satisfactionFactors = {
    responseTime: Math.max(0, 100 - (this.metrics.avgResponseTime / 100)), // Penalize slow responses
    bounceRate: Math.max(0, 100 - (this.metrics.bounceRate * 2)),
    retention: this.metrics.userRetentionRate,
    errorRate: Math.max(0, 100 - (this.errors.errorRate * 10))
  };
  
  scores.userSatisfaction = Math.round(
    (satisfactionFactors.responseTime * 0.3) +
    (satisfactionFactors.bounceRate * 0.3) +
    (satisfactionFactors.retention * 0.2) +
    (satisfactionFactors.errorRate * 0.2)
  );
  
  // System Performance Score (0-100)
  const performanceFactors = {
    cacheHitRate: this.systemMetrics.cacheHitRate,
    queryTime: Math.max(0, 100 - (this.systemMetrics.avgQueryTime / 10)),
    errorRate: Math.max(0, 100 - (this.errors.errorRate * 10)),
    memory: Math.max(0, 100 - (this.systemMetrics.memoryUsage / 100))
  };
  
  scores.systemPerformance = Math.round(
    (performanceFactors.cacheHitRate * 0.4) +
    (performanceFactors.queryTime * 0.3) +
    (performanceFactors.errorRate * 0.2) +
    (performanceFactors.memory * 0.1)
  );
  
  // Overall Score
  scores.overallScore = Math.round(
    (scores.searchQuality * 0.4) +
    (scores.userSatisfaction * 0.4) +
    (scores.systemPerformance * 0.2)
  );
  
  this.scores = scores;
};

SearchAnalyticsSchema.methods.getPerformanceInsights = function() {
  const insights = [];
  
  // Search quality insights
  if (this.metrics.noResultRate > 20) {
    insights.push({
      type: 'warning',
      category: 'search_quality',
      message: `High no-result rate: ${this.metrics.noResultRate.toFixed(1)}%`,
      suggestion: 'Consider adding more suggestions or improving search algorithms'
    });
  }
  
  if (this.metrics.clickThroughRate < 10) {
    insights.push({
      type: 'warning',
      category: 'engagement',
      message: `Low click-through rate: ${this.metrics.clickThroughRate.toFixed(1)}%`,
      suggestion: 'Review suggestion relevance and ranking'
    });
  }
  
  // Performance insights
  if (this.metrics.avgResponseTime > 500) {
    insights.push({
      type: 'critical',
      category: 'performance',
      message: `Slow response time: ${this.metrics.avgResponseTime.toFixed(0)}ms`,
      suggestion: 'Optimize search queries and consider caching'
    });
  }
  
  // User retention insights
  if (this.metrics.userRetentionRate < 30) {
    insights.push({
      type: 'info',
      category: 'retention',
      message: `Low user retention: ${this.metrics.userRetentionRate.toFixed(1)}%`,
      suggestion: 'Improve search relevance and user experience'
    });
  }
  
  // Device-specific insights
  const mobileCTR = this.deviceBreakdown.mobile.clickThroughRate;
  const desktopCTR = this.deviceBreakdown.desktop.clickThroughRate;
  
  if (mobileCTR > 0 && desktopCTR > 0 && mobileCTR < desktopCTR * 0.7) {
    insights.push({
      type: 'info',
      category: 'mobile_experience',
      message: 'Mobile click-through rate significantly lower than desktop',
      suggestion: 'Optimize search interface for mobile devices'
    });
  }
  
  return insights;
};

SearchAnalyticsSchema.methods.getTopPerformingSuggestions = function(limit = 10) {
  return this.topSuggestions
    .filter(s => s.impressions > 10)
    .sort((a, b) => b.clickThroughRate - a.clickThroughRate)
    .slice(0, limit);
};

SearchAnalyticsSchema.methods.getUnderperformingQueries = function(threshold = 10) {
  return this.topQueries
    .filter(q => q.count >= threshold && (!q.clickThroughRate || q.clickThroughRate < 5))
    .map(q => ({
      query: q.query,
      searches: q.count,
      clickThroughRate: q.clickThroughRate || 0,
      opportunity: 'Low engagement'
    }));
};

// Static methods
SearchAnalyticsSchema.statics.recordSearchEvent = async function(
  configurationId, 
  eventType, 
  eventData,
  period = 'daily'
) {
  const now = new Date();
  let periodStart, periodEnd;
  
  // Determine period boundaries
  switch (period) {
    case 'hourly':
      periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours());
      periodEnd = new Date(periodStart.getTime() + 60 * 60 * 1000);
      break;
    case 'weekly':
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      periodStart = new Date(now.setDate(diff));
      periodStart.setHours(0, 0, 0, 0);
      periodEnd = new Date(periodStart.getTime() + 7 * 24 * 60 * 60 * 1000);
      break;
    case 'monthly':
      periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      break;
    default: // daily
      periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      periodEnd = new Date(periodStart.getTime() + 24 * 60 * 60 * 1000);
  }
  
  // Find or create analytics record
  let analytics = await this.findOne({
    configurationId,
    period,
    periodStart
  });
  
  if (!analytics) {
    analytics = new this({
      configurationId,
      period,
      periodStart,
      periodEnd,
      metrics: {
        totalSearches: 0,
        uniqueSearchers: 0,
        searchesPerUser: 0,
        noResultSearches: 0,
        noResultRate: 0,
        avgResultsPerSearch: 0,
        avgQueryLength: 0,
        avgResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        clickThroughRate: 0,
        avgTimeToClick: 0,
        conversionRate: 0,
        bounceRate: 0,
        returningUsers: 0,
        newUsers: 0,
        userRetentionRate: 0
      },
      userBreakdown: {
        byUserType: {
          admin: 0,
          Client: 0,
          user: 0,
          public: 0
        },
        byAuthStatus: {
          authenticated: 0,
          anonymous: 0
        },
        byRole: {
          super_admin: 0,
          admin: 0,
          support: 0,
          billing: 0,
          read_only: 0,
          owner: 0,
          developer: 0,
          billing_client: 0,
          support_client: 0,
          viewer: 0
        }
      },
      deviceBreakdown: {
        desktop: { searches: 0, clickThroughRate: 0, avgResponseTime: 0 },
        mobile: { searches: 0, clickThroughRate: 0, avgResponseTime: 0 },
        tablet: { searches: 0, clickThroughRate: 0, avgResponseTime: 0 }
      },
      errors: {
        totalErrors: 0,
        errorRate: 0,
        errorTypes: []
      },
      systemMetrics: {
        cacheHitRate: 0,
        databaseQueries: 0,
        avgQueryTime: 0,
        memoryUsage: 0
      }
    });
  }
  
  // Update based on event type
  switch (eventType) {
    case 'search':
      analytics.metrics.totalSearches += 1;
      
      if (eventData.userId && !analytics._processedUsers) {
        analytics._processedUsers = new Set();
      }
      
      if (eventData.userId && !analytics._processedUsers.has(eventData.userId)) {
        analytics.metrics.uniqueSearchers += 1;
        analytics._processedUsers.add(eventData.userId);
      }
      
      if (eventData.queryLength) {
        const currentTotal = analytics.metrics.avgQueryLength * (analytics.metrics.totalSearches - 1);
        analytics.metrics.avgQueryLength = (currentTotal + eventData.queryLength) / analytics.metrics.totalSearches;
      }
      
      if (eventData.userType) {
        analytics.userBreakdown.byUserType[eventData.userType] = 
          (analytics.userBreakdown.byUserType[eventData.userType] || 0) + 1;
      }
      
      if (eventData.role) {
        const roleKey = eventData.role.toLowerCase().replace(' ', '_');
        analytics.userBreakdown.byRole[roleKey] = 
          (analytics.userBreakdown.byRole[roleKey] || 0) + 1;
      }
      
      if (eventData.isAuthenticated !== undefined) {
        const status = eventData.isAuthenticated ? 'authenticated' : 'anonymous';
        analytics.userBreakdown.byAuthStatus[status] += 1;
      }
      
      if (eventData.device) {
        analytics.deviceBreakdown[eventData.device].searches += 1;
      }
      
      if (eventData.responseTime) {
        // Update response time statistics
        const currentTotal = analytics.metrics.avgResponseTime * (analytics.metrics.totalSearches - 1);
        analytics.metrics.avgResponseTime = (currentTotal + eventData.responseTime) / analytics.metrics.totalSearches;
      }
      
      // Update top queries
      if (eventData.query) {
        const queryIndex = analytics.topQueries.findIndex(q => q.query === eventData.query);
        if (queryIndex >= 0) {
          analytics.topQueries[queryIndex].count += 1;
          analytics.topQueries[queryIndex].lastSeen = now;
        } else {
          analytics.topQueries.push({
            query: eventData.query,
            count: 1,
            clickThroughRate: 0,
            avgPositionClicked: 0,
            uniqueUsers: 1,
            firstSeen: now,
            lastSeen: now
          });
        }
        
        // Keep only top 50 queries
        analytics.topQueries.sort((a, b) => b.count - a.count);
        if (analytics.topQueries.length > 50) {
          analytics.topQueries = analytics.topQueries.slice(0, 50);
        }
      }
      break;
      
    case 'click':
      analytics.metrics.clickThroughRate = 
        (analytics.metrics.clickThroughRate * (analytics.metrics.totalSearches - 1) + 1) / analytics.metrics.totalSearches;
      
      if (eventData.suggestionId) {
        const suggestionIndex = analytics.topSuggestions.findIndex(
          s => s.suggestionId.toString() === eventData.suggestionId
        );
        
        if (suggestionIndex >= 0) {
          analytics.topSuggestions[suggestionIndex].clicks += 1;
          analytics.topSuggestions[suggestionIndex].impressions += eventData.impressions || 1;
          analytics.topSuggestions[suggestionIndex].clickThroughRate = 
            (analytics.topSuggestions[suggestionIndex].clicks / analytics.topSuggestions[suggestionIndex].impressions) * 100;
        } else {
          analytics.topSuggestions.push({
            suggestionId: eventData.suggestionId,
            text: eventData.suggestionText,
            route: eventData.suggestionRoute,
            type: eventData.suggestionType,
            impressions: eventData.impressions || 1,
            clicks: 1,
            clickThroughRate: 100,
            avgPosition: eventData.position || 1
          });
        }
        
        // Keep only top 50 suggestions
        analytics.topSuggestions.sort((a, b) => b.impressions - a.impressions);
        if (analytics.topSuggestions.length > 50) {
          analytics.topSuggestions = analytics.topSuggestions.slice(0, 50);
        }
      }
      
      // Update query click-through
      if (eventData.query) {
        const queryIndex = analytics.topQueries.findIndex(q => q.query === eventData.query);
        if (queryIndex >= 0) {
          const oldCTR = analytics.topQueries[queryIndex].clickThroughRate || 0;
          const oldClicks = (oldCTR * analytics.topQueries[queryIndex].count) / 100;
          const newCTR = ((oldClicks + 1) / analytics.topQueries[queryIndex].count) * 100;
          analytics.topQueries[queryIndex].clickThroughRate = newCTR;
        }
      }
      break;
      
    case 'no_results':
      analytics.metrics.noResultSearches += 1;
      break;
      
    case 'error':
      analytics.errors.totalErrors += 1;
      
      const errorTypeIndex = analytics.errors.errorTypes.findIndex(
        e => e.type === eventData.errorType
      );
      
      if (errorTypeIndex >= 0) {
        analytics.errors.errorTypes[errorTypeIndex].count += 1;
        analytics.errors.errorTypes[errorTypeIndex].lastOccurred = now;
      } else {
        analytics.errors.errorTypes.push({
          type: eventData.errorType,
          count: 1,
          lastOccurred: now
        });
      }
      break;
      
    case 'impression':
      if (eventData.suggestionId) {
        const suggestionIndex = analytics.topSuggestions.findIndex(
          s => s.suggestionId.toString() === eventData.suggestionId
        );
        
        if (suggestionIndex >= 0) {
          analytics.topSuggestions[suggestionIndex].impressions += 1;
        } else {
          analytics.topSuggestions.push({
            suggestionId: eventData.suggestionId,
            text: eventData.suggestionText,
            route: eventData.suggestionRoute,
            type: eventData.suggestionType,
            impressions: 1,
            clicks: 0,
            clickThroughRate: 0,
            avgPosition: eventData.position || 1
          });
        }
      }
      break;
  }
  
  // Calculate error rate
  analytics.errors.errorRate = analytics.metrics.totalSearches > 0 
    ? (analytics.errors.totalErrors / analytics.metrics.totalSearches) * 100 
    : 0;
  
  // Clean up temporary data
  delete analytics._processedUsers;
  
  analytics.calculatedAt = now;
  
  await analytics.save();
  return analytics;
};

SearchAnalyticsSchema.statics.getPeriodSummary = async function(configurationId, period, startDate, endDate) {
  const analytics = await this.find({
    configurationId,
    period,
    periodStart: { $gte: startDate, $lt: endDate }
  }).sort({ periodStart: 1 });
  
  if (analytics.length === 0) {
    return null;
  }
  
  // Aggregate metrics
  const summary = {
    period: period,
    dateRange: { start: startDate, end: endDate },
    metrics: {
      totalSearches: 0,
      uniqueSearchers: 0,
      avgClickThroughRate: 0,
      avgResponseTime: 0,
      errorRate: 0
    },
    trends: {
      searches: [],
      clickThroughRate: [],
      responseTime: []
    }
  };
  
  analytics.forEach(record => {
    summary.metrics.totalSearches += record.metrics.totalSearches;
    summary.metrics.uniqueSearchers += record.metrics.uniqueSearchers;
    summary.metrics.avgClickThroughRate += record.metrics.clickThroughRate;
    summary.metrics.avgResponseTime += record.metrics.avgResponseTime;
    summary.metrics.errorRate += record.errors.errorRate;
    
    summary.trends.searches.push({
      date: record.periodStart,
      value: record.metrics.totalSearches
    });
    
    summary.trends.clickThroughRate.push({
      date: record.periodStart,
      value: record.metrics.clickThroughRate
    });
    
    summary.trends.responseTime.push({
      date: record.periodStart,
      value: record.metrics.avgResponseTime
    });
  });
  
  const count = analytics.length;
  summary.metrics.avgClickThroughRate /= count;
  summary.metrics.avgResponseTime /= count;
  summary.metrics.errorRate /= count;
  
  // Calculate growth
  if (analytics.length >= 2) {
    const first = analytics[0];
    const last = analytics[analytics.length - 1];
    
    summary.growth = {
      searches: last.metrics.totalSearches - first.metrics.totalSearches,
      searchGrowthRate: first.metrics.totalSearches > 0 
        ? ((last.metrics.totalSearches - first.metrics.totalSearches) / first.metrics.totalSearches) * 100 
        : 0,
      ctrGrowth: last.metrics.clickThroughRate - first.metrics.clickThroughRate
    };
  }
  
  return summary;
};

module.exports = mongoose.model(`${process.env.APP_NAME}_SearchAnalytics`, SearchAnalyticsSchema);