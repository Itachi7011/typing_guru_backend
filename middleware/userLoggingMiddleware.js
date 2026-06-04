// middleware/userLoggingMiddleware.js
const UserActivity = require('../models/User/UserActivity');
const UserAuditLog = require('../models/User/UserAuditLog');
const User = require('../models/User/Users');

/**
 * Comprehensive User Logging Middleware
 * Handles three types of logs:
 * 1. Activity Logs (UserActivity model)
 * 2. Audit Logs (UserAuditLog model) 
 * 3. Immutable Logs (inside User model - for critical events only)
 */

class UserLoggingMiddleware {
    constructor() {
        this.criticalActions = [
            'account_deletion',
            'password_change',
            'mfa_enabled',
            'mfa_disabled',
            'email_verification',
            'phone_verification',
            'account_blocked',
            'account_unblocked',
            'permission_changed',
            'billing_updated',
            'suspicious_activity_detected'
        ];
    }

    /**
     * Main middleware function - can be used as express middleware
     */
    logUserActivity = async (req, res, next) => {
        try {
            // Store original send function
            const originalSend = res.send;
            const startTime = Date.now();

            // Override send to capture response
            res.send = async (data) => {
                res.send = originalSend;

                try {
                    if (req.user) {
                        const duration = Date.now() - startTime;

                        // Log activity based on route and method
                        await this._logRouteActivity(req, res, data, duration);
                    }
                } catch (error) {
                    console.error('Logging error:', error);
                    // Don't break the request if logging fails
                }

                return originalSend.call(res, data);
            };

            next();
        } catch (error) {
            console.error('Logging middleware error:', error);
            next();
        }
    };

    /**
     * Manual logging function for specific actions
     */
    logManualActivity = async (user, client, req, logData) => {
        try {
            const {
                action,
                status = 'success',
                severity = 'low',
                resourceType = 'user',
                resourceId,
                metadata = {},
                eventType,
                eventAction,
                eventData = {},
                critical = false
            } = logData;

            const baseLogInfo = {
                ipAddress: req?.ip || req?.connection?.remoteAddress,
                userAgent: req?.get('User-Agent'),
                timestamp: new Date()
            };

            // 1. Always create Activity Log
            await this._createActivityLog(user, client, {
                eventType: eventType || this._mapActionToEventType(action),
                eventAction: eventAction || action,
                eventData: {
                    ...eventData,
                    action,
                    status,
                    severity,
                    ...metadata
                },
                ...baseLogInfo
            });

            // 2. Always create Audit Log
            await this._createAuditLog(user, client, {
                action,
                status,
                severity,
                resourceType,
                resourceId: resourceId || user?._id,
                metadata,
                ...baseLogInfo
            });

            // 3. Create Immutable Log only for critical actions
            if (critical || this.criticalActions.includes(action)) {
                await this._createImmutableLog(user, client, {
                    actionType: action,
                    resourceType: this._mapToResourceType(resourceType),
                    resourceId: resourceId || user?._id,
                    originalData: metadata.originalData,
                    newData: metadata.newData,
                    reason: metadata.reason,
                    critical: true,
                    ...baseLogInfo
                });
            }

        } catch (error) {
            console.error('Manual logging error:', error);
        }
    };

    /**
     * Private method to create Activity Log
     */
    _createActivityLog = async (user, client, activityData) => {
        try {
            const activityLog = new UserActivity({
                user: {
                    userId: user?._id,
                    userModel: `${process.env.APP_NAME}_User`
                },
                clientId: client?._id || user?.clientId,
                eventType: activityData.eventType,
                eventAction: activityData.eventAction,
                eventData: activityData.eventData,
                location: {
                    pathname: activityData.pathname,
                    search: activityData.search,
                    hash: activityData.hash
                },
                ipAddress: activityData.ipAddress,
                userAgent: activityData.userAgent,
                sessionId: activityData.sessionId,
                ...(activityData.screenResolution && {
                    screenResolution: activityData.screenResolution
                }),
                ...(activityData.viewportSize && {
                    viewportSize: activityData.viewportSize
                }),
                ...(activityData.performance && {
                    performance: activityData.performance
                })
            });

            await activityLog.save();
        } catch (error) {
            console.error('Activity log creation error:', error);
        }
    };

    /**
     * Private method to create Audit Log
     */
    _createAuditLog = async (user, client, auditData) => {
        try {
            const userAgent = auditData.userAgent;
            const userAgentDetails = this._parseUserAgent(userAgent);

            const auditLog = new UserAuditLog({
                action: auditData.action,
                userId: user?._id,
                clientId: client?._id || user?.clientId,
                ipAddress: auditData.ipAddress,
                userAgent: userAgent,
                userAgentDetails,
                location: await this._getLocationData(auditData.ipAddress),
                metadata: auditData.metadata,
                status: auditData.status,
                severity: auditData.severity,
                resourceType: auditData.resourceType,
                resourceId: auditData.resourceId,
                duration: auditData.duration || 0,
                sessionId: auditData.sessionId,
                deviceId: auditData.deviceId,
                correlationId: auditData.correlationId,
                riskScore: auditData.riskScore || 0,
                isSuspicious: auditData.isSuspicious || false
            });

            await auditLog.save();
        } catch (error) {
            console.error('Audit log creation error:', error);
        }
    };

    /**
     * Private method to create Immutable Log (inside User model)
     */
    _createImmutableLog = async (user, client, immutableData) => {
        try {
            if (!user) return;

            const immutableLogEntry = {
                actionType: immutableData.actionType,
                resourceType: immutableData.resourceType,
                resourceId: immutableData.resourceId,
                performedBy: {
                    id: user._id,
                    model: `${process.env.APP_NAME}_User`
                },
                performedAt: immutableData.timestamp || new Date(),
                originalData: immutableData.originalData,
                newData: immutableData.newData,
                reason: immutableData.reason,
                critical: immutableData.critical
            };

            // Add to user's immutableAuditLog array
            await User.findByIdAndUpdate(
                user._id,
                {
                    $push: {
                        immutableAuditLog: {
                            $each: [immutableLogEntry],
                            $slice: -1000 // Keep last 1000 entries
                        }
                    }
                }
            );
        } catch (error) {
            console.error('Immutable log creation error:', error);
        }
    };

    /**
     * Route-based automatic logging
     */
    _logRouteActivity = async (req, res, responseData, duration) => {
        const user = req.user;
        const client = req.client;

        if (!user) return;

        const routeConfig = this._getRouteConfig(req.method, req.route?.path || req.originalUrl);

        if (routeConfig) {
            await this.logManualActivity(user, client, req, {
                action: routeConfig.action,
                status: res.statusCode < 400 ? 'success' : 'failure',
                severity: routeConfig.severity,
                resourceType: routeConfig.resourceType,
                resourceId: this._extractResourceId(req, responseData),
                metadata: {
                    method: req.method,
                    path: req.originalUrl,
                    statusCode: res.statusCode,
                    duration,
                    responseSize: JSON.stringify(responseData)?.length,
                    ...this._extractChanges(req, responseData)
                },
                eventType: routeConfig.eventType,
                eventAction: routeConfig.eventAction,
                critical: routeConfig.critical
            });
        }
    };

    /**
     * Helper methods
     */
    _mapActionToEventType = (action) => {
        const eventTypeMap = {
            // Authentication events
            'login': 'authentication',
            'logout': 'authentication',
            'register': 'authentication',
            'password_change': 'security',
            'failed_login': 'security',

            // Profile events
            'update_profile': 'profile',
            'delete_account': 'account',

            // Security events
            'mfa_enabled': 'security',
            'mfa_disabled': 'security',

            // Default
            'default': 'system'
        };

        return eventTypeMap[action] || eventTypeMap.default;
    };

    _mapToResourceType = (resourceType) => {
        const resourceMap = {
            'user': 'User',
            'profile': 'User',
            'security': 'System',
            'account': 'User',
            'default': 'Custom'
        };

        return resourceMap[resourceType] || resourceMap.default;
    };

    _parseUserAgent = (userAgent) => {
        // Simplified user agent parsing - you might want to use a library like 'ua-parser-js'
        return {
            browser: this._extractBrowser(userAgent),
            os: this._extractOS(userAgent),
            device: this._extractDevice(userAgent),
            platform: 'web',
            isMobile: /mobile/i.test(userAgent),
            isTablet: /tablet/i.test(userAgent),
            isDesktop: !/mobile|tablet/i.test(userAgent)
        };
    };

    _extractBrowser = (ua) => {
        if (/chrome/i.test(ua)) return 'Chrome';
        if (/firefox/i.test(ua)) return 'Firefox';
        if (/safari/i.test(ua)) return 'Safari';
        if (/edge/i.test(ua)) return 'Edge';
        return 'Unknown';
    };

    _extractOS = (ua) => {
        if (/windows/i.test(ua)) return 'Windows';
        if (/macintosh|mac os/i.test(ua)) return 'macOS';
        if (/linux/i.test(ua)) return 'Linux';
        if (/android/i.test(ua)) return 'Android';
        if (/ios|iphone|ipad/i.test(ua)) return 'iOS';
        return 'Unknown';
    };

    _extractDevice = (ua) => {
        if (/mobile/i.test(ua)) return 'Mobile';
        if (/tablet/i.test(ua)) return 'Tablet';
        return 'Desktop';
    };

    _getLocationData = async (ipAddress) => {
        // Implement IP to location service
        // You can use services like ipapi, ipstack, or maxmind
        try {
            // Mock implementation - replace with actual service
            return {
                country: 'Unknown',
                region: 'Unknown',
                city: 'Unknown',
                timezone: 'UTC'
            };
        } catch (error) {
            return {
                country: 'Unknown',
                region: 'Unknown',
                city: 'Unknown',
                timezone: 'UTC'
            };
        }
    };

    _getRouteConfig = (method, path) => {
        const routeConfigs = {
            'POST': {
                '/auth/login': {
                    action: 'login',
                    resourceType: 'security',
                    severity: 'medium',
                    eventType: 'authentication',
                    eventAction: 'user_login',
                    critical: false
                },
                '/profile/change-password': {
                    action: 'password_change',
                    resourceType: 'security',
                    severity: 'high',
                    eventType: 'security',
                    eventAction: 'password_changed',
                    critical: true
                }
            },
            'PUT': {
                '/profile': {
                    action: 'update_profile',
                    resourceType: 'profile',
                    severity: 'low',
                    eventType: 'profile',
                    eventAction: 'profile_updated',
                    critical: false
                }
            },
            'DELETE': {
                '/profile': {
                    action: 'delete_account',
                    resourceType: 'account',
                    severity: 'critical',
                    eventType: 'account',
                    eventAction: 'account_deleted',
                    critical: true
                }
            },
            'GET': {
                '/profile': {
                    action: 'view_profile',
                    resourceType: 'profile',
                    severity: 'low',
                    eventType: 'profile',
                    eventAction: 'profile_viewed',
                    critical: false
                }
            }
        };

        return routeConfigs[method]?.[path];
    };

    _extractResourceId = (req, responseData) => {
        // Extract resource ID from request or response
        return req.params.id || req.body.id || responseData?.data?.user?._id;
    };

    _extractChanges = (req, responseData) => {
        if (req.method === 'PUT' || req.method === 'PATCH') {
            return {
                changes: req.body,
                updatedFields: Object.keys(req.body)
            };
        }
        return {};
    };
}

// Create singleton instance
const userLoggingMiddleware = new UserLoggingMiddleware();

// Export both class and middleware functions
module.exports = {
    UserLoggingMiddleware,
    logUserActivity: userLoggingMiddleware.logUserActivity,
    logManualActivity: userLoggingMiddleware.logManualActivity
};