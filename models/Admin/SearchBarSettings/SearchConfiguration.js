// models/SearchConfiguration.js
const mongoose = require('mongoose');

const SearchSuggestionSchema = new mongoose.Schema({
  text: {
    type: String,
    required: true,
    trim: true
  },
  route: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: [
      'dashboard', 'analytics', 'users', 'settings', 'billing', 
      'documents', 'support', 'profile', 'security', 'logs',
      'clients', 'admin', 'plans', 'services', 'contact'
    ],
    required: true
  },
  icon: {
    type: String, // Lucide React icon name
    required: true
  },
  description: {
    type: String,
    trim: true
  },
  keywords: [{
    type: String,
    lowercase: true,
    trim: true
  }],
  permissions: {
    requiredRoles: [{
      type: String,
      enum: ['Super Admin', 'Admin', 'Support', 'Billing', 'Read Only', 'owner', 'admin', 'developer', 'billing', 'support', 'viewer', 'Client', 'User']
    }],
    requiredAuth: {
      type: Boolean,
      default: false
    },
    requiredUserType: [{
      type: String,
      enum: ['admin', 'Client', 'user']
    }],
    // Add specific permission requirements based on your system
    requiredPermissions: [{
      type: String,
      enum: [
        // Admin permissions
        'users.view', 'users.create', 'users.edit', 'users.delete',
        'clients.view', 'clients.create', 'clients.edit', 'clients.delete', 'clients.suspend',
        'billing.view', 'billing.create', 'billing.edit', 'billing.refund',
        'settings.view', 'settings.edit',
        'analytics.view', 'analytics.export',
        'api.manage', 'api.monitor',
        'auditLogs.manage', 'auditLogs.monitor',
        'activityLogs.manage', 'activityLogs.monitor',
        
        // Client team permissions
        'manage_team', 'transfer_ownership',
        'manage_api_keys', 'view_api_keys',
        'manage_auth_config', 'manage_branding', 'manage_cors', 'manage_webhooks',
        'view_billing', 'manage_subscription',
        'manage_registration_forms', 'view_registration_forms',
        'view_analytics', 'export_data'
      ]
    }]
  },
  metadata: {
    category: {
      type: String,
      enum: ['navigation', 'management', 'analytics', 'account', 'settings', 'security', 'billing', 'support', 'resources'],
      default: 'navigation'
    },
    priority: {
      type: Number,
      min: 1,
      max: 10,
      default: 5
    },
    lastAccessed: Date,
    accessCount: {
      type: Number,
      default: 0
    },
    featured: {
      type: Boolean,
      default: false
    },
    system: {
      type: Boolean,
      default: false // True for system pages, false for custom
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  sortOrder: {
    type: Number,
    default: 0
  },
  // Link to specific resources
  resourceRef: {
    model: {
      type: String,
      enum: [
        `${process.env.APP_NAME}_User`,
        `${process.env.APP_NAME}_Client`, 
        `${process.env.APP_NAME}_Admin`,
        `${process.env.APP_NAME}_SubscriptionPlan`
      ]
    },
    resourceId: mongoose.Schema.Types.ObjectId
  }
}, {
  timestamps: true,
  _id: true
});

const SearchShortcutSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  key: {
    type: String,
    required: true,
    uppercase: true
  },
  description: String,
  action: {
    type: String,
    enum: ['navigate', 'command', 'quick_action', 'search_filter', 'toggle'],
    required: true
  },
  route: String,
  command: String,
  icon: String,
  category: {
    type: String,
    enum: ['navigation', 'tools', 'filters', 'views'],
    default: 'navigation'
  },
  requiresPermission: [String],
  isActive: {
    type: Boolean,
    default: true
  },
  systemDefault: {
    type: Boolean,
    default: false
  }
});

const SearchConfigurationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true
  },
  description: {
    type: String,
    trim: true
  },
  target: {
    type: String,
    enum: ['admin', 'client', 'user', 'public'],
    required: true,
    index: true
  },
  userState: {
    type: String,
    enum: ['logged_in', 'logged_out', 'user_logged_in', 'client_logged_in', 'admin_logged_in', 'all'],
    default: 'all',
    index: true
  },
  
  // Search suggestions
  suggestions: [SearchSuggestionSchema],
  
  // Keyboard shortcuts
  shortcuts: [SearchShortcutSchema],
  
  // Search behavior settings
  behavior: {
    minCharsForSuggestions: {
      type: Number,
      default: 2,
      min: 1,
      max: 5
    },
    maxSuggestions: {
      type: Number,
      default: 10,
      min: 1,
      max: 20
    },
    debounceMs: {
      type: Number,
      default: 300,
      min: 100,
      max: 1000
    },
    searchIn: {
      titles: { type: Boolean, default: true },
      descriptions: { type: Boolean, default: true },
      keywords: { type: Boolean, default: true },
      routePaths: { type: Boolean, default: false }
    },
    fuzzySearch: {
      enabled: { type: Boolean, default: true },
      threshold: { type: Number, default: 0.3, min: 0, max: 1 }
    },
    recentSearches: {
      enabled: { type: Boolean, default: true },
      maxItems: { type: Number, default: 10 }
    },
    popularSearches: {
      enabled: { type: Boolean, default: true },
      weightByAccessCount: { type: Boolean, default: true }
    },
    autoComplete: {
      enabled: { type: Boolean, default: true },
      minChars: { type: Number, default: 2 }
    }
  },
  
  // UI Configuration
  ui: {
    placeholder: {
      type: String,
      default: 'Search...'
    },
    showShortcutHint: {
      type: Boolean,
      default: true
    },
    showCategories: {
      type: Boolean,
      default: true
    },
    highlightMatches: {
      type: Boolean,
      default: true
    },
    showIcons: {
      type: Boolean,
      default: true
    },
    showDescriptions: {
      type: Boolean,
      default: false
    },
    theme: {
      type: String,
      enum: ['light', 'dark', 'auto'],
      default: 'auto'
    },
    position: {
      type: String,
      enum: ['navbar', 'sidebar', 'floating', 'header'],
      default: 'navbar'
    },
    width: {
      type: String,
      enum: ['small', 'medium', 'large', 'full'],
      default: 'medium'
    }
  },
  
  // Access control based on your system
  access: {
    isPublic: { type: Boolean, default: true },
    allowedRoles: [String],
    allowedUserTypes: [String],
    requireAuth: { type: Boolean, default: false },
    requireMfa: { type: Boolean, default: false },
    ipWhitelist: [String],
    // Client-specific access (for multi-tenant)
    clientAccess: {
      type: String,
      enum: ['all', 'specific', 'none'],
      default: 'all'
    },
    allowedClients: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: `${process.env.APP_NAME}_Client`
    }]
  },
  
  // Categories for grouping suggestions
  categories: [{
    name: String,
    icon: String,
    color: String,
    description: String,
    sortOrder: { type: Number, default: 0 },
    suggestions: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SearchSuggestion'
    }]
  }],
  
  // Advanced features
  features: {
    voiceSearch: { type: Boolean, default: false },
    imageSearch: { type: Boolean, default: false },
    searchFilters: { 
      enabled: { type: Boolean, default: true },
      filters: [{
        field: String,
        label: String,
        type: { type: String, enum: ['select', 'multiselect', 'date', 'range'] },
        options: [{
          value: String,
          label: String
        }]
      }]
    },
    saveSearch: { type: Boolean, default: false },
    shareSearch: { type: Boolean, default: false },
    advancedOperators: {
      enabled: { type: Boolean, default: false },
      operators: [{
        symbol: String,
        description: String,
        example: String,
        requiresPermission: [String]
      }]
    },
    // Integration with your system
    searchUsers: { type: Boolean, default: false },
    searchClients: { type: Boolean, default: false },
    searchSubscriptions: { type: Boolean, default: false },
    searchAnalytics: { type: Boolean, default: false }
  },
  
  // Analytics
  analytics: {
    totalSearches: { type: Number, default: 0 },
    popularQueries: [{
      query: String,
      count: Number,
      lastSearched: Date,
      userType: String
    }],
    clickThroughRate: { type: Number, default: 0 },
    averageResults: { type: Number, default: 0 },
    noResultsRate: { type: Number, default: 0 },
    userEngagement: {
      averageTimeSpent: { type: Number, default: 0 },
      bounceRate: { type: Number, default: 0 }
    }
  },
  
  // Integration with your system models
  integration: {
    syncWithUsers: { type: Boolean, default: false },
    syncWithClients: { type: Boolean, default: false },
    syncWithSubscriptions: { type: Boolean, default: false },
    autoGenerateFromRoutes: { type: Boolean, default: false },
    routesToExclude: [String]
  },
  
  // Versioning and lifecycle
  version: {
    type: Number,
    default: 1
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isSystem: {
    type: Boolean,
    default: false // True for system configurations, false for custom
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'createdByModel'
  },
  createdByModel: {
    type: String,
    enum: [`${process.env.APP_NAME}_Admin`, `${process.env.APP_NAME}_Client`, `${process.env.APP_NAME}_User`]
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'updatedByModel'
  },
  updatedByModel: {
    type: String,
    enum: [`${process.env.APP_NAME}_Admin`, `${process.env.APP_NAME}_Client`, `${process.env.APP_NAME}_User`]
  },
  metadata: mongoose.Schema.Types.Mixed
}, {
  timestamps: true
});

// Indexes
SearchConfigurationSchema.index({ target: 1, userState: 1, isActive: 1 });
SearchConfigurationSchema.index({ 'suggestions.type': 1 });
SearchConfigurationSchema.index({ 'suggestions.metadata.category': 1 });
SearchConfigurationSchema.index({ 'access.allowedClients': 1 });
SearchConfigurationSchema.index( { unique: true });
SearchConfigurationSchema.index({ isSystem: 1, isActive: 1 });

// Pre-save middleware
SearchConfigurationSchema.pre('save', function(next) {
  // Validate suggestion uniqueness
  const suggestionMap = new Map();
  this.suggestions.forEach((suggestion, index) => {
    const key = `${suggestion.text}-${suggestion.route}`;
    if (suggestionMap.has(key)) {
      return next(new Error(`Duplicate suggestion: ${suggestion.text} (${suggestion.route})`));
    }
    suggestionMap.set(key, index);
  });
  
  // Validate target-userState combinations
  const validCombinations = {
    'admin': ['admin_logged_in'],
    'client': ['client_logged_in', 'logged_out', 'all'],
    'user': ['user_logged_in', 'logged_out', 'all'],
    'public': ['logged_out', 'all']
  };
  
  if (validCombinations[this.target] && !validCombinations[this.target].includes(this.userState)) {
    this.userState = validCombinations[this.target][0];
  }
  
  // Set system flag for default configurations
  if (this.name.includes('System Default') || this.name.includes('Default')) {
    this.isSystem = true;
  }
  
  next();
});

// Instance methods
SearchConfigurationSchema.methods.getFilteredSuggestions = function(userData) {
  const { 
    role, 
    userType, 
    isAuthenticated, 
    permissions = [], 
    clientId = null,
    mfaEnabled = false
  } = userData;
  
  return this.suggestions.filter(suggestion => {
    // Check authentication
    if (suggestion.permissions.requiredAuth && !isAuthenticated) {
      return false;
    }
    
    // Check user type
    if (suggestion.permissions.requiredUserType.length > 0 && 
        !suggestion.permissions.requiredUserType.includes(userType)) {
      return false;
    }
    
    // Check roles
    if (suggestion.permissions.requiredRoles.length > 0 && 
        !suggestion.permissions.requiredRoles.includes(role)) {
      return false;
    }
    
    // Check specific permissions
    if (suggestion.permissions.requiredPermissions.length > 0) {
      const hasRequiredPermissions = suggestion.permissions.requiredPermissions.every(
        perm => permissions.includes(perm)
      );
      if (!hasRequiredPermissions) {
        return false;
      }
    }
    
    // Check MFA requirement
    if (suggestion.permissions.requireMfa && !mfaEnabled) {
      return false;
    }
    
    // Check client access for multi-tenant
    if (this.access.clientAccess === 'specific' && clientId) {
      const isAllowed = this.access.allowedClients.some(allowedClient => 
        allowedClient.toString() === clientId.toString()
      );
      if (!isAllowed) {
        return false;
      }
    }
    
    return suggestion.isActive;
  }).sort((a, b) => {
    // Sort by priority, then access count, then alphabetical
    if (a.metadata.priority !== b.metadata.priority) {
      return b.metadata.priority - a.metadata.priority;
    }
    if (a.metadata.accessCount !== b.metadata.accessCount) {
      return b.metadata.accessCount - a.metadata.accessCount;
    }
    if (a.metadata.featured !== b.metadata.featured) {
      return b.metadata.featured ? 1 : -1;
    }
    return a.text.localeCompare(b.text);
  });
};

SearchConfigurationSchema.methods.search = function(query, userData) {
  const filteredSuggestions = this.getFilteredSuggestions(userData);
  
  if (!query || query.trim().length < this.behavior.minCharsForSuggestions) {
    return {
      suggestions: filteredSuggestions.slice(0, this.behavior.maxSuggestions),
      total: filteredSuggestions.length
    };
  }
  
  const searchTerms = query.toLowerCase().trim().split(/\s+/);
  
  const results = filteredSuggestions.filter(suggestion => {
    const searchableText = [
      suggestion.text,
      suggestion.description,
      ...suggestion.keywords
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    
    return searchTerms.every(term => searchableText.includes(term));
  });
  
  // Apply fuzzy search if enabled
  let finalResults = results;
  if (this.behavior.fuzzySearch.enabled && results.length < this.behavior.maxSuggestions / 2) {
    const fuzzyResults = filteredSuggestions.filter(suggestion => {
      const searchableText = [
        suggestion.text,
        suggestion.description,
        ...suggestion.keywords
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      
      return searchTerms.some(term => {
        const similarity = this.calculateSimilarity(term, searchableText);
        return similarity >= this.behavior.fuzzySearch.threshold;
      });
    });
    
    finalResults = [...new Set([...results, ...fuzzyResults])];
  }
  
  return {
    suggestions: finalResults.slice(0, this.behavior.maxSuggestions),
    total: finalResults.length,
    query: query
  };
};

SearchConfigurationSchema.methods.calculateSimilarity = function(term, text) {
  // Simple similarity calculation - can be enhanced
  if (text.includes(term)) return 1.0;
  
  // Calculate Levenshtein distance ratio
  const maxLength = Math.max(term.length, text.length);
  if (maxLength === 0) return 0.0;
  
  const distance = this.levenshteinDistance(term, text);
  return 1.0 - (distance / maxLength);
};

SearchConfigurationSchema.methods.levenshteinDistance = function(a, b) {
  // Implementation of Levenshtein distance
  const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));
  
  for (let i = 0; i <= a.length; i++) {
    matrix[0][i] = i;
  }
  
  for (let j = 0; j <= b.length; j++) {
    matrix[j][0] = j;
  }
  
  for (let j = 1; j <= b.length; j++) {
    for (let i = 1; i <= a.length; i++) {
      const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,
        matrix[j - 1][i] + 1,
        matrix[j - 1][i - 1] + indicator
      );
    }
  }
  
  return matrix[b.length][a.length];
};

SearchConfigurationSchema.methods.incrementAccessCount = function(suggestionId) {
  const suggestion = this.suggestions.id(suggestionId);
  if (suggestion) {
    suggestion.metadata.accessCount += 1;
    suggestion.metadata.lastAccessed = new Date();
  }
  return this;
};

SearchConfigurationSchema.methods.recordSearch = function(query, resultsCount, userType = 'unknown') {
  this.analytics.totalSearches += 1;
  
  // Update popular queries
  const queryIndex = this.analytics.popularQueries.findIndex(q => q.query === query);
  if (queryIndex >= 0) {
    this.analytics.popularQueries[queryIndex].count += 1;
    this.analytics.popularQueries[queryIndex].lastSearched = new Date();
    this.analytics.popularQueries[queryIndex].userType = userType;
  } else {
    this.analytics.popularQueries.push({
      query,
      count: 1,
      lastSearched: new Date(),
      userType
    });
  }
  
  // Keep only top 20
  this.analytics.popularQueries.sort((a, b) => b.count - a.count);
  if (this.analytics.popularQueries.length > 20) {
    this.analytics.popularQueries = this.analytics.popularQueries.slice(0, 20);
  }
  
  // Update average results
  const totalSearches = this.analytics.totalSearches;
  const currentTotal = this.analytics.averageResults * (totalSearches - 1);
  this.analytics.averageResults = (currentTotal + resultsCount) / totalSearches;
  
  // Update no results rate
  if (resultsCount === 0) {
    const currentNoResults = this.analytics.noResultsRate * (totalSearches - 1);
    this.analytics.noResultsRate = (currentNoResults + 1) / totalSearches;
  }
  
  return this;
};

SearchConfigurationSchema.methods.addSuggestion = function(suggestionData) {
  const newSuggestion = {
    ...suggestionData,
    metadata: {
      ...suggestionData.metadata,
      accessCount: 0,
      lastAccessed: null,
      featured: suggestionData.metadata?.featured || false,
      system: suggestionData.metadata?.system || false
    }
  };
  
  this.suggestions.push(newSuggestion);
  return this;
};

SearchConfigurationSchema.methods.updateSuggestion = function(suggestionId, updates) {
  const suggestion = this.suggestions.id(suggestionId);
  if (suggestion) {
    Object.keys(updates).forEach(key => {
      if (key === 'metadata') {
        suggestion.metadata = { ...suggestion.metadata, ...updates.metadata };
      } else {
        suggestion[key] = updates[key];
      }
    });
  }
  return this;
};

SearchConfigurationSchema.methods.removeSuggestion = function(suggestionId) {
  this.suggestions = this.suggestions.filter(s => s._id.toString() !== suggestionId.toString());
  return this;
};

SearchConfigurationSchema.methods.getShortcutsForUser = function(userPermissions = []) {
  return this.shortcuts.filter(shortcut => {
    if (!shortcut.isActive) return false;
    
    if (shortcut.requiresPermission && shortcut.requiresPermission.length > 0) {
      return shortcut.requiresPermission.some(perm => userPermissions.includes(perm));
    }
    
    return true;
  });
};

// Static methods
SearchConfigurationSchema.statics.getForUser = async function(target, userState, userData) {
  const config = await this.findOne({
    target,
    userState,
    isActive: true
  });
  
  if (!config) {
    // Fallback to default configuration
    return await this.findOne({
      target,
      userState: 'all',
      isActive: true,
      isSystem: true
    });
  }
  
  return config;
};

SearchConfigurationSchema.statics.searchAcrossConfigs = async function(query, target, userState, userData) {
  const config = await this.getForUser(target, userState, userData);
  
  if (!config) {
    return { suggestions: [], config: null };
  }
  
  const searchResults = config.search(query, userData);
  
  // Record the search
  await config.recordSearch(query, searchResults.suggestions.length, userData.userType);
  await config.save();
  
  return {
    suggestions: searchResults.suggestions,
    config: {
      behavior: config.behavior,
      ui: config.ui,
      features: config.features,
      shortcuts: config.getShortcutsForUser(userData.permissions || [])
    },
    metadata: {
      totalResults: searchResults.total,
      query: searchResults.query
    }
  };
};

SearchConfigurationSchema.statics.initializeSystemConfigs = async function() {
  const defaultConfigs = [
    // Admin configuration
    {
      name: 'System Default - Admin Dashboard',
      description: 'Default search configuration for admin users',
      target: 'admin',
      userState: 'admin_logged_in',
      isSystem: true,
      suggestions: [
        {
          text: 'Dashboard',
          route: '/admin/dashboard',
          type: 'dashboard',
          icon: 'LayoutDashboard',
          description: 'Admin dashboard overview',
          keywords: ['dashboard', 'home', 'overview', 'stats'],
          permissions: {
            requiredUserType: ['admin'],
            requiredAuth: true
          },
          metadata: {
            category: 'navigation',
            priority: 10,
            system: true
          }
        },
        {
          text: 'User Management',
          route: '/admin/users',
          type: 'users',
          icon: 'Users',
          description: 'Manage system users',
          keywords: ['users', 'management', 'accounts', 'profiles'],
          permissions: {
            requiredUserType: ['admin'],
            requiredAuth: true,
            requiredPermissions: ['users.view']
          },
          metadata: {
            category: 'management',
            priority: 9,
            system: true
          }
        },
        {
          text: 'Client Management',
          route: '/admin/clients',
          type: 'clients',
          icon: 'Briefcase',
          description: 'Manage client accounts',
          keywords: ['clients', 'accounts', 'management'],
          permissions: {
            requiredUserType: ['admin'],
            requiredAuth: true,
            requiredPermissions: ['clients.view']
          },
          metadata: {
            category: 'management',
            priority: 9,
            system: true
          }
        },
        {
          text: 'Analytics',
          route: '/admin/analytics',
          type: 'analytics',
          icon: 'BarChart3',
          description: 'View system analytics',
          keywords: ['analytics', 'reports', 'statistics'],
          permissions: {
            requiredUserType: ['admin'],
            requiredAuth: true,
            requiredPermissions: ['analytics.view']
          },
          metadata: {
            category: 'analytics',
            priority: 8,
            system: true
          }
        },
        {
          text: 'Security Settings',
          route: '/admin/settings/security',
          type: 'security',
          icon: 'Shield',
          description: 'Configure security settings',
          keywords: ['security', 'settings', 'protection'],
          permissions: {
            requiredUserType: ['admin'],
            requiredAuth: true,
            requiredPermissions: ['settings.view', 'settings.edit']
          },
          metadata: {
            category: 'settings',
            priority: 7,
            system: true
          }
        },
        {
          text: 'Billing',
          route: '/admin/billing',
          type: 'billing',
          icon: 'CreditCard',
          description: 'Manage billing and payments',
          keywords: ['billing', 'payments', 'invoices'],
          permissions: {
            requiredUserType: ['admin'],
            requiredAuth: true,
            requiredPermissions: ['billing.view']
          },
          metadata: {
            category: 'billing',
            priority: 6,
            system: true
          }
        },
        {
          text: 'System Logs',
          route: '/admin/logs',
          type: 'logs',
          icon: 'FileText',
          description: 'View system activity logs',
          keywords: ['logs', 'audit', 'activity'],
          permissions: {
            requiredUserType: ['admin'],
            requiredAuth: true,
            requiredPermissions: ['auditLogs.view']
          },
          metadata: {
            category: 'management',
            priority: 5,
            system: true
          }
        }
      ],
      shortcuts: [
        {
          name: 'Go to Dashboard',
          key: 'D',
          description: 'Navigate to dashboard',
          action: 'navigate',
          route: '/admin/dashboard',
          icon: 'LayoutDashboard',
          category: 'navigation',
          systemDefault: true
        },
        {
          name: 'Search Users',
          key: 'U',
          description: 'Search users quickly',
          action: 'search_filter',
          command: 'type:user',
          icon: 'Users',
          category: 'tools',
          requiresPermission: ['users.view'],
          systemDefault: true
        },
        {
          name: 'Search Clients',
          key: 'C',
          description: 'Search clients quickly',
          action: 'search_filter',
          command: 'type:client',
          icon: 'Briefcase',
          category: 'tools',
          requiresPermission: ['clients.view'],
          systemDefault: true
        }
      ],
      behavior: {
        minCharsForSuggestions: 2,
        maxSuggestions: 15,
        debounceMs: 250,
        searchIn: {
          titles: true,
          descriptions: true,
          keywords: true,
          routePaths: true
        },
        fuzzySearch: {
          enabled: true,
          threshold: 0.3
        }
      },
      ui: {
        placeholder: 'Search admin features, users, clients...',
        showShortcutHint: true,
        showCategories: true,
        highlightMatches: true,
        showIcons: true,
        showDescriptions: true,
        theme: 'auto',
        position: 'navbar',
        width: 'large'
      },
      features: {
        searchFilters: {
          enabled: true,
          filters: [
            {
              field: 'type',
              label: 'Type',
              type: 'select',
              options: [
                { value: 'all', label: 'All' },
                { value: 'users', label: 'Users' },
                { value: 'clients', label: 'Clients' },
                { value: 'settings', label: 'Settings' }
              ]
            }
          ]
        },
        searchUsers: true,
        searchClients: true,
        searchAnalytics: true
      }
    },
    
    // Client logged in configuration
    {
      name: 'System Default - Client Dashboard',
      description: 'Default search configuration for logged-in clients',
      target: 'client',
      userState: 'client_logged_in',
      isSystem: true,
      suggestions: [
        {
          text: 'Dashboard',
          route: '/client/dashboard',
          type: 'dashboard',
          icon: 'LayoutDashboard',
          description: 'Client dashboard overview',
          keywords: ['dashboard', 'home', 'overview'],
          permissions: {
            requiredUserType: ['Client'],
            requiredAuth: true,
            requiredRoles: ['owner', 'admin', 'developer', 'billing', 'support', 'viewer']
          },
          metadata: {
            category: 'navigation',
            priority: 10,
            system: true
          }
        },
        {
          text: 'Analytics',
          route: '/client/analytics',
          type: 'analytics',
          icon: 'BarChart3',
          description: 'View your analytics',
          keywords: ['analytics', 'stats', 'reports'],
          permissions: {
            requiredUserType: ['Client'],
            requiredAuth: true,
            requiredRoles: ['owner', 'admin', 'developer', 'viewer'],
            requiredPermissions: ['view_analytics']
          },
          metadata: {
            category: 'analytics',
            priority: 9,
            system: true
          }
        },
        {
          text: 'User Management',
          route: '/client/users/all',
          type: 'users',
          icon: 'Users',
          description: 'Manage your users',
          keywords: ['users', 'management', 'accounts'],
          permissions: {
            requiredUserType: ['Client'],
            requiredAuth: true,
            requiredRoles: ['owner', 'admin', 'developer', 'support']
          },
          metadata: {
            category: 'management',
            priority: 8,
            system: true
          }
        },
        {
          text: 'API Keys',
          route: '/client/api-keys',
          type: 'settings',
          icon: 'Key',
          description: 'Manage API keys',
          keywords: ['api', 'keys', 'integration'],
          permissions: {
            requiredUserType: ['Client'],
            requiredAuth: true,
            requiredRoles: ['owner', 'admin', 'developer'],
            requiredPermissions: ['manage_api_keys', 'view_api_keys']
          },
          metadata: {
            category: 'settings',
            priority: 7,
            system: true
          }
        },
        {
          text: 'Billing',
          route: '/client/billing',
          type: 'billing',
          icon: 'CreditCard',
          description: 'Manage billing and subscription',
          keywords: ['billing', 'payment', 'subscription'],
          permissions: {
            requiredUserType: ['Client'],
            requiredAuth: true,
            requiredRoles: ['owner', 'admin', 'billing'],
            requiredPermissions: ['view_billing', 'manage_subscription']
          },
          metadata: {
            category: 'billing',
            priority: 6,
            system: true
          }
        },
        {
          text: 'Settings',
          route: '/client/settings/general',
          type: 'settings',
          icon: 'Settings',
          description: 'Configure client settings',
          keywords: ['settings', 'configuration'],
          permissions: {
            requiredUserType: ['Client'],
            requiredAuth: true,
            requiredRoles: ['owner', 'admin', 'developer'],
            requiredPermissions: ['manage_auth_config', 'manage_branding']
          },
          metadata: {
            category: 'settings',
            priority: 5,
            system: true
          }
        },
        {
          text: 'Documentation',
          route: '/docs/introduction',
          type: 'documents',
          icon: 'FileText',
          description: 'System documentation',
          keywords: ['docs', 'documentation', 'help'],
          permissions: {
            requiredUserType: ['Client'],
            requiredAuth: false
          },
          metadata: {
            category: 'resources',
            priority: 4,
            system: true
          }
        }
      ],
      shortcuts: [
        {
          name: 'Dashboard',
          key: 'D',
          description: 'Go to dashboard',
          action: 'navigate',
          route: '/client/dashboard',
          icon: 'LayoutDashboard',
          category: 'navigation',
          systemDefault: true
        },
        {
          name: 'New User',
          key: 'N',
          description: 'Add new user',
          action: 'navigate',
          route: '/client/users/add',
          icon: 'UserPlus',
          category: 'tools',
          requiresPermission: ['manage_team'],
          systemDefault: true
        },
        {
          name: 'Analytics',
          key: 'A',
          description: 'View analytics',
          action: 'navigate',
          route: '/client/analytics',
          icon: 'BarChart3',
          category: 'navigation',
          requiresPermission: ['view_analytics'],
          systemDefault: true
        }
      ],
      behavior: {
        minCharsForSuggestions: 2,
        maxSuggestions: 10,
        debounceMs: 300
      },
      ui: {
        placeholder: 'Search your dashboard...',
        showShortcutHint: true,
        showCategories: true,
        highlightMatches: true,
        showIcons: true,
        showDescriptions: false,
        theme: 'auto',
        position: 'navbar',
        width: 'medium'
      }
    },
    
    // User logged in configuration
    {
      name: 'System Default - User Portal',
      description: 'Default search for logged-in users',
      target: 'user',
      userState: 'user_logged_in',
      isSystem: true,
      suggestions: [
        {
          text: 'Our Services',
          route: '/our-services',
          type: 'services',
          icon: 'Settings',
          description: 'View our services',
          keywords: ['services', 'features', 'products'],
          permissions: {
            requiredUserType: ['user'],
            requiredAuth: true
          },
          metadata: {
            category: 'navigation',
            priority: 10,
            system: true
          }
        },
        {
          text: 'Contact Us',
          route: '/contact-us',
          type: 'contact',
          icon: 'MessageCircle',
          description: 'Get in touch with us',
          keywords: ['contact', 'support', 'help'],
          permissions: {
            requiredUserType: ['user'],
            requiredAuth: true
          },
          metadata: {
            category: 'support',
            priority: 9,
            system: true
          }
        },
        {
          text: 'Plans',
          route: '/pricing',
          type: 'plans',
          icon: 'CreditCard',
          description: 'View pricing plans',
          keywords: ['pricing', 'plans', 'subscription'],
          permissions: {
            requiredUserType: ['user'],
            requiredAuth: true
          },
          metadata: {
            category: 'billing',
            priority: 8,
            system: true
          }
        },
        {
          text: 'My Profile',
          route: '/profile',
          type: 'profile',
          icon: 'User',
          description: 'View and edit your profile',
          keywords: ['profile', 'account', 'settings'],
          permissions: {
            requiredUserType: ['user'],
            requiredAuth: true
          },
          metadata: {
            category: 'account',
            priority: 7,
            system: true
          }
        }
      ],
      behavior: {
        minCharsForSuggestions: 2,
        maxSuggestions: 8,
        debounceMs: 400
      },
      ui: {
        placeholder: 'Search...',
        showShortcutHint: false,
        showCategories: false,
        highlightMatches: false,
        showIcons: false,
        showDescriptions: false,
        theme: 'auto',
        position: 'navbar',
        width: 'small'
      }
    },
    
    // Public (logged out) configuration
    {
      name: 'System Default - Public Website',
      description: 'Default search for public website',
      target: 'public',
      userState: 'logged_out',
      isSystem: true,
      suggestions: [
        {
          text: 'Documentation',
          route: '/docs/introduction',
          type: 'documents',
          icon: 'FileText',
          description: 'System documentation',
          keywords: ['docs', 'documentation', 'help'],
          permissions: {
            requiredAuth: false
          },
          metadata: {
            category: 'resources',
            priority: 10,
            system: true
          }
        },
        {
          text: 'Our Services',
          route: '/our-services',
          type: 'services',
          icon: 'Settings',
          description: 'View our services',
          keywords: ['services', 'features', 'products'],
          permissions: {
            requiredAuth: false
          },
          metadata: {
            category: 'navigation',
            priority: 9,
            system: true
          }
        },
        {
          text: 'Contact Us',
          route: '/contact-us',
          type: 'contact',
          icon: 'MessageCircle',
          description: 'Get in touch with us',
          keywords: ['contact', 'support', 'help'],
          permissions: {
            requiredAuth: false
          },
          metadata: {
            category: 'support',
            priority: 8,
            system: true
          }
        },
        {
          text: 'Plans',
          route: '/pricing',
          type: 'plans',
          icon: 'CreditCard',
          description: 'View pricing plans',
          keywords: ['pricing', 'plans', 'subscription'],
          permissions: {
            requiredAuth: false
          },
          metadata: {
            category: 'billing',
            priority: 7,
            system: true
          }
        },
        {
          text: 'Login',
          route: '/client/login',
          type: 'account',
          icon: 'LogIn',
          description: 'Client login',
          keywords: ['login', 'signin', 'auth'],
          permissions: {
            requiredAuth: false
          },
          metadata: {
            category: 'account',
            priority: 6,
            system: true
          }
        },
        {
          text: 'Sign Up',
          route: '/client/signup',
          type: 'account',
          icon: 'UserPlus',
          description: 'Client sign up',
          keywords: ['signup', 'register', 'create account'],
          permissions: {
            requiredAuth: false
          },
          metadata: {
            category: 'account',
            priority: 5,
            system: true
          }
        }
      ],
      behavior: {
        minCharsForSuggestions: 2,
        maxSuggestions: 6,
        debounceMs: 500
      },
      ui: {
        placeholder: 'Search...',
        showShortcutHint: false,
        showCategories: false,
        highlightMatches: false,
        showIcons: false,
        showDescriptions: false,
        theme: 'auto',
        position: 'navbar',
        width: 'small'
      }
    }
  ];
  
  for (const configData of defaultConfigs) {
    await this.findOneAndUpdate(
      { name: configData.name },
      configData,
      { upsert: true, new: true }
    );
  }
  
  console.log('✅ System search configurations initialized');
};

module.exports = mongoose.model(`${process.env.APP_NAME}_SearchConfiguration`, SearchConfigurationSchema);