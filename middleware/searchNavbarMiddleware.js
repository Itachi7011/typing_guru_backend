// middleware/searchMiddleware.js
const SearchConfiguration = require('../models/Admin/SearchBarSettings/SearchConfiguration');

exports.attachSearchConfig = async (req, res, next) => {
  try {
    // Check for different types of authentication
    let user = req.user || req.admin || req.client;
    let target = 'public';
    let userState = 'logged_out';
    
    if (user) {
      if (user.usertype === 'admin') {
        target = 'admin';
        userState = 'admin_logged_in';
      } else if (user.usertype === 'Client') {
        target = 'client';
        userState = 'client_logged_in';
      } else if (user.usertype === 'user') {
        target = 'user';
        userState = 'user_logged_in';
      }
    } else {
      // Determine from request path
      if (req.path.includes('/admin/')) {
        target = 'admin';
      } else if (req.path.includes('/clients/')) {
        target = 'client';
      } else if (req.path.includes('/users/')) {
        target = 'user';
      }
    }
    
    // Get search configuration
    const config = await SearchConfiguration.getForUser(target, userState, {
      role: user?.role || 'guest',
      userType: user?.usertype || 'public',
      isAuthenticated: !!user,
      permissions: [],
      clientId: user?.clientId || null
    });
    
    req.searchConfig = config;
    next();
  } catch (error) {
    console.error('Search middleware error:', error);
    req.searchConfig = null;
    next();
  }
};

exports.trackSearchPerformance = (req, res, next) => {
  const startTime = Date.now();
  
  // Override res.json to track response time
  const originalJson = res.json;
  res.json = function(data) {
    const responseTime = Date.now() - startTime;
    
    // Store response time for potential analytics
    if (req.searchConfig && data.suggestions) {
      req.searchPerformance = {
        responseTime,
        resultCount: data.suggestions.length,
        query: req.query.query || ''
      };
    }
    
    return originalJson.call(this, data);
  };
  
  next();
};