// routes/public.js
const express = require('express');
const router = express.Router();
const User = require('../models/User/Users'); 
const jwt = require('jsonwebtoken'); 
const SubscriptionPlan = require('../models/Admin/SubscriptionPlans');
const PrivacyPolicy = require('../models/Admin/PrivacyPolicyAndTerms/PrivacyPolicy');
const TermsOfService = require('../models/Admin/PrivacyPolicyAndTerms/TermsOfService');
const PlatFormSettings = require('../models/Admin/Settings');
const PublicEnquiry = require('../models/Public/PublicEnquiry');
const NotificationAlert = require('../models/Public/NotificationAlert');

const SearchConfiguration = require('../models/Admin/SearchBarSettings/SearchConfiguration');
const RecentSearch = require('../models/Admin/SearchBarSettings/RecentSearch');
const SearchAnalytics = require('../models/Admin/SearchBarSettings/SearchAnalytics');

const { body, validationResult } = require('express-validator');

// Validation middleware for subscription plan creation/update
const subscriptionPlanValidation = [
  body('name').notEmpty().trim().withMessage('Plan name is required'),
  body('tier').isIn(['FREE', 'BASIC', 'PRO', 'ENTERPRISE']).withMessage('Invalid tier'),
  body('description').notEmpty().trim().withMessage('Description is required'),
  body('price.monthly').isFloat({ min: 0 }).withMessage('Monthly price must be a positive number'),
  body('price.annually').optional().isFloat({ min: 0 }).withMessage('Annual price must be a positive number'),
  body('price.currency').optional().isLength({ min: 3, max: 3 }).withMessage('Currency must be 3 characters'),
];


// Helper: Determine if we should record impression
const shouldRecordImpression = (notification, userId) => {
  // Check if user has seen this notification today
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const existingEngagement = notification.userEngagements.find(eng =>
    eng.userId &&
    eng.userId.toString() === userId.toString() &&
    eng.viewedAt >= today
  );

  return !existingEngagement;
};

// Helper function: Check audience targeting
const checkAudienceTargeting = (notification, userId, clientId, user) => {
  const { targetAudience } = notification;

  switch (targetAudience) {
    case 'all':
      return true;

    case 'clients':
      return !!clientId;

    case 'users':
      return !!userId;

    case 'specific_clients':
      if (!clientId || !notification.targetedClients || notification.targetedClients.length === 0) {
        return false;
      }
      return notification.targetedClients.some(id =>
        id.toString() === clientId.toString()
      );

    case 'specific_users':
      if (!userId || !notification.targetedUsers || notification.targetedUsers.length === 0) {
        return false;
      }
      return notification.targetedUsers.some(id =>
        id.toString() === userId.toString()
      );

    case 'admins':
      return user && user.usertype === 'admin';

    case 'test':
      // Only show in development or if explicitly enabled
      return process.env.NODE_ENV === 'development' || req.query.testMode === 'true';

    default:
      return true;
  }
};

// Helper function: Check page targeting
const checkPageTargeting = (notification, currentPath, user) => {
  const { pageTargeting } = notification;

  if (!pageTargeting || pageTargeting.type === 'all_pages') {
    return true;
  }

  switch (pageTargeting.type) {
    case 'specific_pages':
      if (!pageTargeting.pages || pageTargeting.pages.length === 0) {
        return false;
      }

      return pageTargeting.pages.some(page => {
        if (page.exactMatch) {
          if (page.includeSubpaths) {
            return currentPath.startsWith(page.path);
          }
          return currentPath === page.path;
        } else {
          return currentPath.includes(page.path);
        }
      });

    case 'except_pages':
      if (!pageTargeting.exceptPages || pageTargeting.exceptPages.length === 0) {
        return true;
      }

      const isExcluded = pageTargeting.exceptPages.some(page => {
        if (page.exactMatch) {
          if (page.includeSubpaths) {
            return currentPath.startsWith(page.path);
          }
          return currentPath === page.path;
        } else {
          return currentPath.includes(page.path);
        }
      });

      return !isExcluded;

    case 'regex_pattern':
      if (!pageTargeting.regexPattern) {
        return false;
      }
      try {
        const regex = new RegExp(pageTargeting.regexPattern);
        return regex.test(currentPath);
      } catch (error) {
        console.error('Invalid regex pattern:', error);
        return false;
      }

    default:
      return true;
  }
};

// Helper function: Check route conditions
const checkRouteConditions = (notification, user) => {
  const { routeConditions } = notification;

  if (!routeConditions) {
    return true;
  }

  // Check requireAuth
  if (routeConditions.requireAuth && !user) {
    return false;
  }

  // Check user roles
  if (routeConditions.userRoles && routeConditions.userRoles.length > 0) {
    if (!user || !routeConditions.userRoles.includes(user.usertype)) {
      return false;
    }
  }

  // Check user tiers
  if (routeConditions.userTiers && routeConditions.userTiers.length > 0) {
    if (!user || !routeConditions.userTiers.includes(user.tier)) {
      return false;
    }
  }

  // Check subscription status
  if (routeConditions.subscriptionStatus && routeConditions.subscriptionStatus.length > 0) {
    if (!user || !routeConditions.subscriptionStatus.includes(user.subscription?.status)) {
      return false;
    }
  }

  return true;
};

/* ================================================================
 * 🌍 Public Module
 * 
 * This file includes all code that is publicly accessible without  
 * authentication. It handles landing pages, open APIs, resources,  
 * or public documentation.
 * 
 * Avoid placing any sensitive or private logic in this file.  
 * Keep performance and security in mind for open access.
 * 
 * ================================================================ */


// @access  Public

router.get('/platformSettings', async (req, res) => {
  try {
    const settings = await PlatFormSettings.findOne({}).lean();

    if (!settings) {
      return res.status(404).json({ message: 'Platform settings not found' });
    }

    // Return only public-facing data (exclude sensitive information)
    const publicSettings = {
      // Basic company information
      appName: settings.appName,
      companyName: settings.companyName,
      companyLegalName: settings.companyLegalName,
      companyAddress: settings.companyAddress,
      countryOfIncorporation: settings.countryOfIncorporation,

      // Contact information
      officialEmails: settings.officialEmails?.map(email => ({
        type: email.type,
        address: email.address,
        description: email.description
      })),
      contactNumbers: settings.contactNumbers?.map(phone => ({
        type: phone.type,
        number: phone.number,
        countryCode: phone.countryCode,
        description: phone.description
      })),
      socialLinks: settings.socialLinks,
      businessHours: settings.businessHours,
      regionalSettings: settings.regionalSettings,

      // URLs
      websiteUrl: settings.websiteUrl,
      dashboardUrl: settings.dashboardUrl,
      apiBaseUrl: settings.apiBaseUrl,
      termsUrl: settings.termsUrl,
      privacyPolicyUrl: settings.privacyPolicyUrl,
      cookiePolicyUrl: settings.cookiePolicyUrl,
      supportCenterUrl: settings.supportCenterUrl,

      // Branding (public assets only)
      branding: {
        logoUrl: settings.branding?.logoUrl,
        faviconUrl: settings.branding?.faviconUrl,
        darkModeLogoUrl: settings.branding?.darkModeLogoUrl,
        defaultLanguage: settings.branding?.defaultLanguage
      },

      // Public compliance information
      compliance: {
        gdprCompliant: settings.compliance?.gdprCompliant,
        dataRetentionPolicy: settings.compliance?.dataRetentionPolicy,
        cookieConsent: {
          enabled: settings.compliance?.cookieConsent?.enabled,
          bannerText: settings.compliance?.cookieConsent?.bannerText,
          privacyPolicyUrl: settings.compliance?.cookieConsent?.privacyPolicyUrl
        },
        dataProcessingAddendumUrl: settings.compliance?.dataProcessingAddendumUrl
      },

      // Feature flags (only public ones)
      featureFlags: settings.featureFlags?.filter(flag =>
        flag.targetUsers === 'all' || flag.targetUsers === 'beta'
      ).map(flag => ({
        name: flag.name,
        enabled: flag.enabled,
        description: flag.description
      })),

      // Public policy settings
      defaultPolicySettings: {
        requirePolicyAcceptance: settings.defaultPolicySettings?.requirePolicyAcceptance,
        forceReacceptOnUpdate: settings.defaultPolicySettings?.forceReacceptOnUpdate
      },

      // SEO and meta information
      meta: {
        seoTitle: settings.meta?.seoTitle,
        seoDescription: settings.meta?.seoDescription,
        metaImageUrl: settings.meta?.metaImageUrl
      },

      // Public analytics (client-side only)
      analytics: {
        googleAnalyticsId: settings.analytics?.googleAnalyticsId,
        googleTagManagerId: settings.analytics?.googleTagManagerId,
        privacyMode: settings.analytics?.privacyMode
      },

      // Maintenance mode status (public info)
      security: {
        isMaintenanceMode: settings.security?.isMaintenanceMode,
        maintenanceMessage: settings.security?.maintenanceMessage
      }
    };

    res.json(publicSettings);
  } catch (error) {
    console.error('Error fetching platform settings:', error);
    res.status(500).json({
      message: 'Server error while fetching platform settings',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

router.get('/subscriptionPlans', async (req, res) => {
  try {
    const plans = await SubscriptionPlan.find({ isActive: true })
      .select('-metadata -__v')
      .sort({ sortOrder: 1, tier: 1 })
      .lean();

    res.json(plans);
  } catch (error) {
    console.error('Error fetching active subscription plans:', error);
    res.status(500).json({
      message: 'Server error while fetching active subscription plans',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

router.get('/privacyPolicy', async (req, res) => {
  try {
    const policy = await PrivacyPolicy.findOne({
      isActive: true,
      scope: 'global',
    }).lean();

    // console.log('Fetched Privacy Policy:', policy);

    if (!policy) {
      return res.status(404).json({ message: 'No active privacy policy found.' });
    }

    // Find the current version document inside versions
    const currentVersion = policy.versions.find(
      v => v.version === policy.currentVersion && v.isPublished === true
    );

    if (!currentVersion) {
      return res.status(404).json({ message: 'No published version found for the active policy.' });
    }

    // console.log('Current Privacy Policy Version:', currentVersion);

    res.json({
      version: currentVersion.version,
      effectiveDate: currentVersion.effectiveDate,
      content: currentVersion.content,
      changeLog: currentVersion.changeLog,
      metadata: currentVersion.metadata || {},
      publishedAt: currentVersion.publishedAt
    });
  } catch (error) {
    console.error('Error fetching privacy Policy:', error);
    res.status(500).json({
      message: 'Server error while fetching privacy Policy',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

router.get('/termsOfService', async (req, res) => {
  try {
    const terms = await TermsOfService.findOne({
      isActive: true,
      scope: 'global',
      documentType: 'terms_of_service'
    }).lean();

    if (!terms) {
      return res.status(404).json({ message: 'No active Terms of Service found.' });
    }

    const currentVersion = terms.versions.find(
      v => v.version === terms.currentVersion && v.isPublished === true
    );

    if (!currentVersion) {
      return res.status(404).json({ message: 'No published version found for the active Terms of Service.' });
    }

    res.json({
      version: currentVersion.version,
      effectiveDate: currentVersion.effectiveDate,
      content: currentVersion.content,
      changeLog: currentVersion.changeLog,
      metadata: currentVersion.metadata || {},
      publishedAt: currentVersion.publishedAt,
      appliesTo: terms.appliesTo,
      minimumAge: terms.minimumAge
    });

  } catch (error) {
    console.error('Error fetching Terms of Service:', error);
    res.status(500).json({
      message: 'Server error while fetching Terms of Service.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

router.get('/notification-alerts/active', async (req, res) => {
  try {
    let userId = null;
    let clientId = null;
    let user = null;

    // Try to extract user info from token if available
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.userId) {
          userId = decoded.userId;
          clientId = decoded.clientId;

          // Try to fetch user details if needed
          if (req.query.includeUserInfo === 'true') {
            try {
              user = await User.findById(userId).select('usertype subscription tier emailVerified');
            } catch (userError) {
              console.log('Could not fetch user details, continuing without...');
            }
          }
        }
      } catch (tokenError) {
        // Token is invalid/expired, but we still proceed without user info
        console.log('Token validation failed, proceeding as anonymous user:', tokenError.message);
      }
    }

    // Get current path from query or use default
    const currentPath = req.query.currentPath || '/';

    // Get user's viewed notifications from cookies (if any)
    const viewedNotifications = req.cookies?.viewedNotifications
      ? JSON.parse(req.cookies.viewedNotifications)
      : [];

    // Build base query for active notifications
    const baseQuery = {
      isActive: true,
      status: 'active',
      startDate: { $lte: new Date() },
      endDate: { $gte: new Date() }
    };

    // Apply page targeting if specified in query
    if (req.query.pageTargeting !== 'false') {
      // We'll filter by page targeting after fetching
    }

    // Fetch all active notifications first
    const allNotifications = await NotificationAlert.find(baseQuery)
      .sort({ priority: -1, createdAt: -1 });

    // Filter notifications based on multiple criteria
    const filteredNotifications = allNotifications.filter(notification => {
      // 1. Check if already viewed (from cookies)
      if (viewedNotifications.includes(notification._id.toString())) {
        // Check if showOncePerUser is enabled
        if (notification.showOncePerUser) {
          return false;
        }

        // Check max show count per user
        if (notification.maxShowCountPerUser > 0) {
          const viewCount = viewedNotifications.filter(id => id === notification._id.toString()).length;
          if (viewCount >= notification.maxShowCountPerUser) {
            return false;
          }
        }
      }

      // 2. Check audience targeting
      if (!checkAudienceTargeting(notification, userId, clientId, user)) {
        return false;
      }

      // 3. Check page targeting
      if (!checkPageTargeting(notification, currentPath, user)) {
        return false;
      }

      // 4. Check route conditions
      if (!checkRouteConditions(notification, user)) {
        return false;
      }

      // 5. Check show interval for authenticated users
      if (userId && notification.showInterval > 0) {
        const userEngagement = notification.userEngagements
          .filter(eng => eng.userId && eng.userId.toString() === userId.toString())
          .sort((a, b) => new Date(b.viewedAt) - new Date(a.viewedAt))[0];

        if (userEngagement?.viewedAt) {
          const timeSinceLastShow = Date.now() - new Date(userEngagement.viewedAt).getTime();
          const intervalMs = notification.showInterval * 60 * 1000; // Convert minutes to ms
          if (timeSinceLastShow < intervalMs) {
            return false;
          }
        }
      }

      // 6. Check showOncePerUser for authenticated users
      if (notification.showOncePerUser && userId) {
        const userEngagement = notification.userEngagements.find(
          eng => eng.userId && eng.userId.toString() === userId.toString()
        );
        if (userEngagement?.viewedAt) {
          return false;
        }
      }

      return true;
    });

    // Sort by priority and date
    const sortedNotifications = filteredNotifications.sort((a, b) => {
      // First by priority (critical > high > medium > low)
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      const priorityDiff = (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0);

      if (priorityDiff !== 0) return priorityDiff;

      // Then by creation date (newest first)
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    // Prepare response data (remove sensitive fields)
    const responseData = sortedNotifications.map(notification => ({
      _id: notification._id,
      title: notification.title,
      message: notification.message,
      type: notification.type,
      category: notification.category,
      priority: notification.priority,
      displayType: notification.displayType,
      position: notification.position,
      dismissible: notification.dismissible,
      autoDismiss: notification.autoDismiss,
      autoDismissDelay: notification.autoDismissDelay,
      requireAcknowledgement: notification.requireAcknowledgement,
      backgroundColor: notification.backgroundColor,
      textColor: notification.textColor,
      link: notification.link,
      startDate: notification.startDate,
      endDate: notification.endDate,
      createdAt: notification.createdAt,
      updatedAt: notification.updatedAt
    }));

    res.json({
      success: true,
      data: responseData,
      userInfo: user ? {
        isAuthenticated: true,
        userId: user._id,
        userType: user.usertype,
        hasSubscription: !!user.subscription
      } : {
        isAuthenticated: false,
        message: 'Viewing as anonymous user'
      }
    });

  } catch (error) {
    console.error('Error fetching active notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching notifications',
      data: [] // Return empty array instead of failing
    });
  }
});

// POST record impression
router.post('/notification-alerts/:id/impression', async (req, res) => {
  try {
    console.log("Imporession Route hitted")
    const notification = await NotificationAlert.findById(req.params.id);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification alert not found'
      });
    }

    // Extract user info if available
    let userId = null;
    let clientId = null;
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        userId = decoded.userId;
        clientId = decoded.clientId;
      } catch (tokenError) {
        // Invalid token, proceed without user info
      }
    }

    // Check if we should record this impression
    // For anonymous users, we might want to limit recording to prevent spam
    const shouldRecord = !userId || shouldRecordImpression(notification, userId);

    if (shouldRecord) {
      // Record impression
      notification.impressions += 1;

      // Record engagement for authenticated users
      if (userId) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const existingEngagement = notification.userEngagements.find(eng =>
          eng.userId &&
          eng.userId.toString() === userId.toString() &&
          eng.viewedAt >= today
        );

        if (!existingEngagement) {
          notification.userEngagements.push({
            userId: userId,
            clientId: clientId,
            viewedAt: new Date(),
            sessionId: req.sessionID || 'anonymous',
            deviceInfo: {
              userAgent: req.headers['user-agent'],
              ip: req.ip || 'unknown'
            }
          });
        }
      }

      // Update conversion rate
      if (notification.impressions > 0) {
        notification.conversionRate = (notification.clicks / notification.impressions) * 100;
      }

      await notification.save();
    }

    res.json({
      success: true,
      message: 'Impression recorded',
      recorded: shouldRecord
    });

  } catch (error) {
    console.error('Error recording impression:', error);
    // Don't fail the request if impression recording fails
    res.json({
      success: true,
      message: 'Request processed',
      recorded: false
    });
  }
});


// POST record click
router.post('/notification-alerts/:id/click', async (req, res) => {
  try {
    const notification = await NotificationAlert.findById(req.params.id);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification alert not found'
      });
    }

    // Extract user info if available
    let userId = null;
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        userId = decoded.userId;
      } catch (tokenError) {
        // Invalid token, proceed without user info
      }
    }

    // Record click
    notification.clicks += 1;

    // Update user engagement for authenticated users
    if (userId) {
      const engagement = notification.userEngagements.find(eng =>
        eng.userId &&
        eng.userId.toString() === userId.toString() &&
        !eng.clickedAt
      );

      if (engagement) {
        engagement.clickedAt = new Date();
      }
    }

    // Update conversion rate
    if (notification.impressions > 0) {
      notification.conversionRate = (notification.clicks / notification.impressions) * 100;
    }

    await notification.save();

    res.json({
      success: true,
      message: 'Click recorded'
    });

  } catch (error) {
    console.error('Error recording click:', error);
    // Don't fail the request if click recording fails
    res.json({
      success: true,
      message: 'Request processed'
    });
  }
});

// POST record dismissal (works with or without authentication)
router.post('/notification-alerts/:id/dismiss', async (req, res) => {
  try {
        console.log("Dismissal Route hitted")

    const notification = await NotificationAlert.findById(req.params.id);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification alert not found'
      });
    }

    // Extract user info if available
    let userId = null;
    let clientId = null;
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        userId = decoded.userId;
        clientId = decoded.clientId;
      } catch (tokenError) {
        // Invalid token, proceed without user info
      }
    }

    // Record dismissal
    notification.dismissals += 1;

    // Update user engagement for authenticated users
    if (userId) {
      const engagement = notification.userEngagements.find(eng =>
        eng.userId &&
        eng.userId.toString() === userId.toString() &&
        !eng.dismissedAt
      );

      if (engagement) {
        engagement.dismissedAt = new Date();
      }
    }

    await notification.save();

    // Add to viewed notifications in cookie (for all users)
    const viewedNotifications = req.cookies?.viewedNotifications
      ? JSON.parse(req.cookies.viewedNotifications)
      : [];

    if (!viewedNotifications.includes(req.params.id)) {
      viewedNotifications.push(req.params.id);

      // Set cookie with appropriate options
      const cookieOptions = {
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict'
      };

      res.cookie('viewedNotifications', JSON.stringify(viewedNotifications), cookieOptions);
    }

    res.json({
      success: true,
      message: 'Dismissal recorded'
    });

  } catch (error) {
    console.error('Error recording dismissal:', error);
    // Don't fail the request if dismissal recording fails
    res.json({
      success: true,
      message: 'Request processed'
    });
  }
});


// POST acknowledge notification (for required acknowledgements)
router.post('/notification-alerts/:id/acknowledge', async (req, res) => {
  try {
    const notification = await NotificationAlert.findById(req.params.id);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification alert not found'
      });
    }

    if (!notification.requireAcknowledgement) {
      return res.status(400).json({
        success: false,
        message: 'This notification does not require acknowledgement'
      });
    }

    // Extract user info if available
    let userId = null;
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        userId = decoded.userId;
      } catch (tokenError) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required to acknowledge this notification'
        });
      }
    } else {
      return res.status(401).json({
        success: false,
        message: 'Authentication required to acknowledge this notification'
      });
    }

    // Record acknowledgement for authenticated users
    const engagement = notification.userEngagements.find(eng =>
      eng.userId &&
      eng.userId.toString() === userId.toString()
    );

    if (engagement) {
      engagement.actionTaken = 'acknowledged';
      engagement.acknowledgedAt = new Date();
      await notification.save();
    }

    // Also add to dismissed/acknowledged list
    const viewedNotifications = req.cookies?.viewedNotifications
      ? JSON.parse(req.cookies.viewedNotifications)
      : [];

    if (!viewedNotifications.includes(req.params.id)) {
      viewedNotifications.push(req.params.id);
      const cookieOptions = {
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict'
      };
      res.cookie('viewedNotifications', JSON.stringify(viewedNotifications), cookieOptions);
    }

    res.json({
      success: true,
      message: 'Notification acknowledged'
    });

  } catch (error) {
    console.error('Error recording acknowledgement:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to record acknowledgement'
    });
  }
});

// GET public stats (no authentication required)
router.get('/notification-alerts/stats', async (req, res) => {
  try {
    const stats = await NotificationAlert.aggregate([
      {
        $match: {
          isActive: true,
          status: 'active',
          startDate: { $lte: new Date() },
          endDate: { $gte: new Date() }
        }
      },
      {
        $group: {
          _id: null,
          totalActive: { $sum: 1 },
          totalImpressions: { $sum: '$impressions' },
          totalClicks: { $sum: '$clicks' },
          avgCTR: { $avg: '$conversionRate' }
        }
      }
    ]);

    res.json({
      success: true,
      data: stats[0] || {
        totalActive: 0,
        totalImpressions: 0,
        totalClicks: 0,
        avgCTR: 0
      }
    });

  } catch (error) {
    console.error('Error fetching notification stats:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching stats',
      data: {
        totalActive: 0,
        totalImpressions: 0,
        totalClicks: 0,
        avgCTR: 0
      }
    });
  }
});






/* ======================================================================================================================================
 *                                🌐 Publialy Available Main Navbar's Seach Bar Apis Code Starts Here 🌐
 *                               The following section outlines the Navbar's Seach Bar Apis Code.
 *                               Please read carefully before interacting with any functionality.
 * ====================================================================================================================================== */

router.get('/nav/search', async (req, res) => {
  try {
    const { query = '' } = req.query;

    // Prepare user data for search (public user)
    const userData = {
      role: 'guest',
      userType: 'public',
      isAuthenticated: false,
      permissions: [],
      mfaEnabled: false
    };

    // Perform search
    const searchResults = await SearchConfiguration.searchAcrossConfigs(
      query.trim(),
      'public',
      'logged_out',
      userData
    );

    // Record analytics for public searches too
    try {
      await SearchAnalytics.recordSearchEvent(
        searchResults.config?._id || null,
        'search',
        {
          query: query.trim(),
          queryLength: query.trim().length,
          userType: 'public',
          role: 'guest',
          isAuthenticated: false,
          device: 'web'
        }
      );
    } catch (error) {
      console.error('Error recording search analytics:', error);
    }

    res.json({
      success: true,
      query: query,
      suggestions: searchResults.suggestions.map(suggestion => ({
        id: suggestion._id,
        text: suggestion.text,
        route: suggestion.route,
        type: suggestion.type,
        icon: suggestion.icon,
        description: suggestion.description,
        metadata: suggestion.metadata
      })),
      config: searchResults.config,
      metadata: searchResults.metadata
    });

  } catch (error) {
    console.error('Public search error:', error);
    res.status(500).json({
      success: false,
      error: 'Search failed',
      message: error.message
    });
  }
});

router.post('/nav/search/click', async (req, res) => {
  try {
    const { suggestionId, query, position } = req.body;

    if (!suggestionId) {
      return res.status(400).json({
        success: false,
        error: 'Suggestion ID is required'
      });
    }

    // Record click analytics
    try {
      await SearchAnalytics.recordSearchEvent(
        null,
        'click',
        {
          suggestionId,
          query,
          position,
          userType: 'public',
          role: 'guest'
        }
      );
    } catch (error) {
      console.error('Error recording click analytics:', error);
    }

    res.json({
      success: true,
      message: 'Click recorded'
    });

  } catch (error) {
    console.error('Record click error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to record click'
    });
  }
});

router.get('/nav/search/popular', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;

    const popularQueries = await RecentSearch.aggregate([
      {
        $match: {
          target: 'public',
          createdAt: { $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) }
        }
      },
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

    res.json({
      success: true,
      popularQueries: popularQueries.map(query => ({
        query: query.query,
        count: query.count,
        uniqueUsers: query.uniqueUsersCount,
        lastSearched: query.lastSearched,
        avgResults: query.avgResults
      }))
    });

  } catch (error) {
    console.error('Get popular queries error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get popular queries'
    });
  }
});


/* ======================================================================================================================================
 *                                🌐 Publicly Available Contact Us Page's Apis Code Starts Here 🌐
 *                               The following section outlines the Public Routes.
 *                               Please read carefully before interacting with any functionality.
 * ====================================================================================================================================== */


const enquiryValidation = [
  body('name').notEmpty().trim().withMessage('Name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('phone').optional().isLength({ max: 20 }).withMessage('Phone number too long'),
  body('category').isIn(['general', 'support', 'sales', 'billing', 'partnership', 'security', 'feedback']).withMessage('Invalid category'),
  body('subject').optional().isLength({ max: 150 }).withMessage('Subject too long'),
  body('urgency').isIn(['low', 'normal', 'high', 'critical']).withMessage('Invalid urgency level'),
  body('message').notEmpty().trim().isLength({ max: 2000 }).withMessage('Message is required and must be less than 2000 characters')
];

router.post('/enquiry', enquiryValidation, async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const {
      name,
      email,
      phone,
      category,
      subject,
      urgency,
      message
    } = req.body;

    // Rate limiting: Check if user has made more than 5 enquiries in last 24 hours
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const recentEnquiries = await PublicEnquiry.find({
      $or: [
        { email: email.toLowerCase().trim() },
        { phone: phone ? phone.trim() : '' }
      ],
      createdAt: { $gte: twentyFourHoursAgo }
    });

    if (recentEnquiries.length >= 5) {
      return res.status(429).json({
        success: false,
        message: 'Rate limit exceeded. You can only submit 5 enquiries every 24 hours. Please try again later.',
        limit: 5,
        period: '24 hours',
        nextAvailable: new Date(recentEnquiries[0].createdAt.getTime() + 24 * 60 * 60 * 1000)
      });
    }

    // Get client information
    const ipAddress = req.ip ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      (req.connection.socket ? req.connection.socket.remoteAddress : null);

    const userAgent = req.get('User-Agent') || '';

    // Generate automatic tags based on category and urgency
    const autoTags = [category, urgency];
    if (urgency === 'critical' || urgency === 'high') {
      autoTags.push('priority');
    }
    if (category === 'security') {
      autoTags.push('security_team');
    }

    // Create new enquiry with all default values
    const enquiry = new PublicEnquiry({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      phone: phone ? phone.trim() : '',
      category: category || 'general',
      subject: subject ? subject.trim() : `Enquiry from ${name.trim()}`,
      urgency: urgency || 'normal',
      message: message.trim(),
      ipAddress: ipAddress,
      userAgent: userAgent,
      // Admin management fields with defaults
      status: 'new',
      assignedTo: null,
      adminNotes: '',
      tags: autoTags,
      source: 'contact_form',
      followUpAt: null,
      responseHistory: [],
      isResolved: false,
      isDeleted: false,
      deletedAt: null,
      resolvedAt: null,
      resolvedBy: null
    });

    // Save to database
    await enquiry.save();

    // Notification logic for high urgency enquiries
    if (urgency === 'critical' || urgency === 'high') {
      console.log(`Urgent enquiry received: ${enquiry._id}`);
    }

    res.status(201).json({
      success: true,
      message: 'Enquiry submitted successfully',
      data: {
        id: enquiry._id,
        name: enquiry.name,
        email: enquiry.email,
        category: enquiry.category,
        urgency: enquiry.urgency,
        status: enquiry.status,
        referenceId: `ENQ-${enquiry._id.toString().slice(-6).toUpperCase()}`,
        rateLimitInfo: {
          remaining: 4 - recentEnquiries.length,
          resetTime: new Date(Date.now() + 24 * 60 * 60 * 1000)
        }
      }
    });

  } catch (error) {
    console.error('Error submitting enquiry:', error);

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Duplicate enquiry detected'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error while submitting enquiry',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});


router.post('/enquiry/status', [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('phone').optional().isLength({ max: 20 }).withMessage('Phone number too long')
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { email, phone } = req.body;

    // Find all enquiries for this user (using both email and phone)
    const enquiries = await PublicEnquiry.find({
      $or: [
        {
          email: email.toLowerCase().trim(),
          phone: phone ? phone.trim() : ''
        }
      ]
    })
      .select('name email phone category subject urgency status isResolved createdAt updatedAt resolvedAt adminNotes message')
      .sort({ createdAt: -1 })
      .lean();

    if (!enquiries || enquiries.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No enquiries found for the provided email and phone combination'
      });
    }

    // Calculate statistics
    const stats = {
      total: enquiries.length,
      resolved: enquiries.filter(e => e.isResolved).length,
      pending: enquiries.filter(e => !e.isResolved).length,
      byStatus: enquiries.reduce((acc, enquiry) => {
        acc[enquiry.status] = (acc[enquiry.status] || 0) + 1;
        return acc;
      }, {}),
      byCategory: enquiries.reduce((acc, enquiry) => {
        acc[enquiry.category] = (acc[enquiry.category] || 0) + 1;
        return acc;
      }, {})
    };

    res.json({
      success: true,
      data: {
        userInfo: {
          name: enquiries[0].name,
          email: enquiries[0].email,
          phone: enquiries[0].phone,
          message: enquiries[0].message
        },
        enquiries: enquiries,
        statistics: stats,
        latestEnquiry: enquiries[0]
      }
    });

  } catch (error) {
    console.error('Error fetching enquiry status:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching enquiry status',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});


router.get('/enquiry/rate-limit', async (req, res) => {
  try {
    const { email, phone } = req.query;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const recentEnquiries = await PublicEnquiry.find({
      $or: [
        { email: email.toLowerCase().trim() },
        { phone: phone ? phone.trim() : '' }
      ],
      createdAt: { $gte: twentyFourHoursAgo }
    });

    const limit = 5;
    const remaining = Math.max(0, limit - recentEnquiries.length);
    const resetTime = recentEnquiries.length > 0 ?
      new Date(recentEnquiries[0].createdAt.getTime() + 24 * 60 * 60 * 1000) :
      new Date();

    res.json({
      success: true,
      data: {
        limit,
        remaining,
        used: recentEnquiries.length,
        resetTime,
        canSubmit: remaining > 0
      }
    });

  } catch (error) {
    console.error('Error checking rate limit:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while checking rate limit',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});


router.get('/enquiry/:id/status', async (req, res) => {
  try {
    const enquiry = await PublicEnquiry.findById(req.params.id)
      .select('name email status isResolved updatedAt')
      .lean();

    if (!enquiry) {
      return res.status(404).json({
        success: false,
        message: 'Enquiry not found'
      });
    }

    res.json({
      success: true,
      data: {
        id: enquiry._id,
        name: enquiry.name,
        email: enquiry.email,
        status: enquiry.status,
        isResolved: enquiry.isResolved,
        lastUpdated: enquiry.updatedAt
      }
    });
  } catch (error) {
    console.error('Error fetching enquiry status:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching enquiry status'
    });
  }
});


module.exports = router;