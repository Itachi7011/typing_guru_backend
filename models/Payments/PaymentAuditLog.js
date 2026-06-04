// models/PaymentAuditLog.js
const mongoose = require('mongoose');

const AUDIT_ACTION = {
    CREATE: 'create',
    UPDATE: 'update',
    DELETE: 'delete',
    STATUS_CHANGE: 'status_change',
    REFUND: 'refund',
    DISPUTE: 'dispute',
    RETRY: 'retry',
    FRAUD_REVIEW: 'fraud_review',
    MANUAL_INTERVENTION: 'manual_intervention',
    SYSTEM_CORRECTION: 'system_correction',
    DATA_CORRECTION: 'data_correction',
    SYNC_OPERATION: 'sync_operation'
};

const AUDIT_SEVERITY = {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    CRITICAL: 'critical'
};

const AUDIT_SOURCE = {
    SYSTEM: 'system',
    USER: 'user',
    ADMIN: 'admin',
    PAYMENT_PROVIDER: 'payment_provider',
    WEBHOOK: 'webhook',
    API: 'api',
    CRON_JOB: 'cron_job',
    MANUAL: 'manual'
};

const PaymentAuditLogSchema = new mongoose.Schema({
    // ===== CORE IDENTIFIERS & RELATIONSHIPS =====
    auditId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    transactionId: {
        type: String,
        required: true,
        index: true
    },
    paymentTransactionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: `${process.env.APP_NAME}_PaymentTransaction`,
        required: true,
        index: true
    },
    clientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: `${process.env.APP_NAME}_Client`,
        required: true,
        index: true
    },
    planId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: `${process.env.APP_NAME}_SubscriptionPlan`,
        required: true,
        index: true
    },
    subscriptionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: `${process.env.APP_NAME}_Subscription`,
        index: true
    },

    // ===== AUDIT METADATA =====
    action: {
        type: String,
        enum: Object.values(AUDIT_ACTION),
        required: true,
        index: true
    },
    severity: {
        type: String,
        enum: Object.values(AUDIT_SEVERITY),
        required: true,
        default: AUDIT_SEVERITY.MEDIUM,
        index: true
    },
    source: {
        type: String,
        enum: Object.values(AUDIT_SOURCE),
        required: true,
        index: true
    },
    description: {
        type: String,
        required: true
    },
    reason: {
        type: String,
        trim: true,
        maxlength: 1000
    },

    // ===== COMPLETE TRANSACTION SNAPSHOT =====
    snapshot: {
        // Core transaction data
        transactionType: String,
        status: String,
        billingCycle: String,
        
        // Financial data
        amount: {
            grossAmount: Number,
            netAmount: Number,
            taxAmount: Number,
            discountAmount: Number,
            currency: String,
            exchangeRate: Number,
            baseCurrency: String,
            baseAmount: Number
        },
        
        // Billing period
        period: {
            startDate: Date,
            endDate: Date,
            prorated: Boolean,
            prorationFactor: Number
        },
        
        // Payment method details
        paymentMethod: {
            type: String,
            details: mongoose.Schema.Types.Mixed
        },
        
        // Provider details
        paymentProvider: {
            name: String,
            transactionId: String,
            customerId: String,
            invoiceId: String,
            subscriptionId: String,
            paymentIntentId: String,
            metadata: mongoose.Schema.Types.Mixed
        },
        
        // Invoice details
        invoice: {
            number: String,
            items: [{
                description: String,
                amount: Number,
                quantity: Number,
                type: String,
                planTier: String,
                addonName: String
            }],
            pdfUrl: String,
            receiptUrl: String
        },
        
        // Refund and dispute status
        refund: {
            refundedAmount: Number,
            refundReason: String,
            refundedAt: Date,
            refundTransactionId: String
        },
        
        dispute: {
            disputed: Boolean,
            disputeReason: String,
            disputeAmount: Number,
            disputeDate: Date,
            resolution: String,
            resolvedAt: Date,
            disputeId: String
        },
        
        // Risk assessment
        riskAssessment: {
            score: Number,
            level: String,
            factors: [String],
            reviewed: Boolean,
            reviewedBy: mongoose.Schema.Types.ObjectId,
            reviewedAt: Date
        },
        
        // Complete metadata
        metadata: mongoose.Schema.Types.Mixed,
        notes: String,
        tags: [String]
    },

    // ===== CHANGE TRACKING =====
    changes: {
        // Field-level changes
        fieldChanges: [{
            field: {
                type: String,
                required: true
            },
            path: {
                type: String, // JSON path for nested fields
                required: true
            },
            oldValue: mongoose.Schema.Types.Mixed,
            newValue: mongoose.Schema.Types.Mixed,
            dataType: {
                type: String,
                enum: ['string', 'number', 'boolean', 'date', 'object', 'array']
            },
            isSensitive: {
                type: Boolean,
                default: false
            }
        }],
        
        // Status transitions
        statusTransition: {
            from: String,
            to: String,
            trigger: String
        },
        
        // Financial changes
        financialChanges: {
            amountChange: Number,
            currencyChange: Boolean,
            refundAmount: Number
        },
        
        // Complete diff (for complex changes)
        diff: mongoose.Schema.Types.Mixed,
        
        // Hash of previous state for verification
        previousStateHash: {
            type: String,
            index: true
        },
        newStateHash: {
            type: String,
            index: true
        }
    },

    // ===== ACTOR INFORMATION =====
    actor: {
        id: {
            type: mongoose.Schema.Types.ObjectId,
            required: true
        },
        type: {
            type: String,
            required: true,
            enum: [
                `${process.env.APP_NAME}_ClientTeamMember`,
                `${process.env.APP_NAME}_Admin`,
                `${process.env.APP_NAME}_System`,
                `${process.env.APP_NAME}_PaymentProvider`
            ]
        },
        email: String,
        name: String,
        role: String,
        ipAddress: String,
        userAgent: String,
        sessionId: String
    },

    // ===== TECHNICAL & SECURITY DATA =====
    technicalContext: {
        // Application context
        service: {
            type: String,
            default: 'payment-service'
        },
        version: String,
        environment: {
            type: String,
            enum: ['development', 'staging', 'production'],
            default: 'production'
        },
        
        // Request context
        requestId: String,
        correlationId: String,
        traceId: String,
        endpoint: String,
        httpMethod: String,
        
        // Processing context
        batchId: String,
        jobId: String,
        webhookId: String,
        
        // Timestamps
        processedAt: Date,
        completedAt: Date
    },

    // ===== VERIFICATION & INTEGRITY =====
    integrity: {
        // Cryptographic verification
        dataHash: {
            type: String,
            required: true,
            index: true
        },
        signature: String, // Digital signature if needed
        encryptionKeyId: String,
        
        // Blockchain-style verification
        previousAuditHash: String, // Chain of audits
        merkleRoot: String,
        
        // Verification status
        verified: {
            type: Boolean,
            default: false
        },
        verifiedAt: Date,
        verifiedBy: mongoose.Schema.Types.ObjectId,
        verificationMethod: String
    },

    // ===== COMPLIANCE & LEGAL =====
    compliance: {
        // Regulatory requirements
        gdprCompliant: {
            type: Boolean,
            default: true
        },
        retentionPeriod: {
            type: Number, // in days
            default: 2555 // 7 years
        },
        legalHold: {
            type: Boolean,
            default: false
        },
        legalHoldReason: String,
        legalHoldUntil: Date,
        
        // Data classification
        classification: {
            type: String,
            enum: ['public', 'internal', 'confidential', 'restricted'],
            default: 'confidential'
        },
        pciCompliant: {
            type: Boolean,
            default: true
        }
    },

    // ===== ERROR & RECOVERY DATA =====
    errorContext: {
        hasError: {
            type: Boolean,
            default: false
        },
        errorCode: String,
        errorMessage: String,
        stackTrace: String,
        recoveryAction: String,
        retryCount: Number,
        resolved: {
            type: Boolean,
            default: false
        },
        resolvedAt: Date
    },

    // ===== RELATIONSHIPS WITH OTHER AUDITS =====
    relatedAudits: [{
        auditId: String,
        relationship: {
            type: String,
            enum: ['parent', 'child', 'sibling', 'correction', 'reversal']
        },
        description: String
    }],

    // ===== PERFORMANCE & MONITORING =====
    performance: {
        processingTime: Number, // milliseconds
        dataSize: Number, // bytes
        indexed: {
            type: Boolean,
            default: false
        },
        archived: {
            type: Boolean,
            default: false
        },
        compressionRatio: Number
    },

    // ===== CUSTOM METADATA =====
    customFields: mongoose.Schema.Types.Mixed,
    tags: [String],

    // ===== IMMUTABLE TIMESTAMPS =====
    createdAt: {
        type: Date,
        default: Date.now,
        immutable: true
    },
    effectiveFrom: {
        type: Date,
        default: Date.now
    },
    effectiveTo: {
        type: Date,
        default: null
    }
}, {
    // Disable versioning for true immutability
    versionKey: false,
    
    // Custom collection name
    collection: 'payment_audit_logs',
    
    // Strict mode to prevent unwanted fields
    strict: true,
    
    // Auto-index
    autoIndex: true
});

// ===== COMPOUND INDEXES =====
PaymentAuditLogSchema.index({ transactionId: 1, createdAt: -1 });
PaymentAuditLogSchema.index({ clientId: 1, createdAt: -1 });
PaymentAuditLogSchema.index({ planId: 1, action: 1 });
PaymentAuditLogSchema.index({ 'actor.id': 1, 'actor.type': 1 });
PaymentAuditLogSchema.index({ action: 1, severity: 1, createdAt: -1 });
PaymentAuditLogSchema.index({ 'integrity.dataHash': 1 });
PaymentAuditLogSchema.index({ createdAt: 1, _id: 1 });
PaymentAuditLogSchema.index({ 'technicalContext.environment': 1, createdAt: -1 });
PaymentAuditLogSchema.index({ 'compliance.legalHold': 1, createdAt: -1 });

// ===== PRE-SAVE MIDDLEWARE =====
PaymentAuditLogSchema.pre('save', function(next) {
    // Generate audit ID if not provided
    if (!this.auditId) {
        this.auditId = `AUD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    
    // Calculate data hash for integrity
    if (this.isModified('snapshot') || this.isNew) {
        this.integrity.dataHash = this.calculateDataHash();
    }
    
    // Set effective dates for temporal queries
    if (this.isNew) {
        this.effectiveFrom = new Date();
        this.effectiveTo = null;
    }
    
    // Validate that critical fields are not modified in updates
    if (!this.isNew) {
        const immutableFields = ['auditId', 'transactionId', 'paymentTransactionId', 'createdAt', 'integrity.dataHash'];
        for (const field of immutableFields) {
            if (this.isModified(field)) {
                return next(new Error(`Field ${field} is immutable`));
            }
        }
    }
    
    next();
});

// ===== INSTANCE METHODS =====

// Calculate cryptographic hash of the audit data
PaymentAuditLogSchema.methods.calculateDataHash = function() {
    const crypto = require('crypto');
    
    const dataToHash = {
        transactionId: this.transactionId,
        action: this.action,
        snapshot: this.snapshot,
        changes: this.changes,
        actor: this.actor,
        timestamp: this.createdAt
    };
    
    const dataString = JSON.stringify(dataToHash, (key, value) => {
        // Sort object keys for consistent hashing
        if (value instanceof Object && !(value instanceof Array)) {
            return Object.keys(value).sort().reduce((sorted, key) => {
                sorted[key] = value[key];
                return sorted;
            }, {});
        }
        return value;
    });
    
    return crypto.createHash('sha256').update(dataString).digest('hex');
};

// Verify data integrity
PaymentAuditLogSchema.methods.verifyIntegrity = function() {
    const currentHash = this.calculateDataHash();
    return currentHash === this.integrity.dataHash;
};

// Get human-readable change summary
PaymentAuditLogSchema.methods.getChangeSummary = function() {
    const changes = this.changes.fieldChanges || [];
    
    if (changes.length === 0) {
        return `No field changes detected for ${this.action}`;
    }
    
    const summary = changes.map(change => {
        const maskedOld = change.isSensitive ? '***' : change.oldValue;
        const maskedNew = change.isSensitive ? '***' : change.newValue;
        return `${change.field}: ${maskedOld} → ${maskedNew}`;
    });
    
    return summary.join(' | ');
};

// Check if audit is within retention period
PaymentAuditLogSchema.methods.isWithinRetention = function() {
    const retentionDays = this.compliance.retentionPeriod || 2555;
    const retentionDate = new Date(this.createdAt);
    retentionDate.setDate(retentionDate.getDate() + retentionDays);
    
    return new Date() <= retentionDate;
};

// Create a correction audit entry
PaymentAuditLogSchema.methods.createCorrectionAudit = async function(correctionData, actor) {
    const PaymentAuditLog = mongoose.model(`${process.env.APP_NAME}_PaymentAuditLog`);
    
    const correctionAudit = new PaymentAuditLog({
        ...correctionData,
        relatedAudits: [{
            auditId: this.auditId,
            relationship: 'correction',
            description: 'Correcting previous audit entry'
        }],
        integrity: {
            ...correctionData.integrity,
            previousAuditHash: this.integrity.dataHash
        }
    });
    
    await correctionAudit.save();
    
    // Update this audit to reference the correction
    this.relatedAudits.push({
        auditId: correctionAudit.auditId,
        relationship: 'corrected_by',
        description: 'Corrected by subsequent audit'
    });
    
    await this.save();
    
    return correctionAudit;
};

// ===== STATIC METHODS =====

// Find audits by transaction with full history
PaymentAuditLogSchema.statics.getTransactionAuditTrail = function(transactionId) {
    return this.find({ transactionId })
        .sort({ createdAt: 1 })
        .select('auditId action severity description createdAt actor changes.fieldChanges')
        .lean();
};

// Find suspicious activities
PaymentAuditLogSchema.statics.findSuspiciousActivities = function(startDate, endDate) {
    return this.find({
        createdAt: { $gte: startDate, $lte: endDate },
        $or: [
            { severity: { $in: [AUDIT_SEVERITY.HIGH, AUDIT_SEVERITY.CRITICAL] } },
            { 'changes.financialChanges.amountChange': { $gt: 1000 } },
            { 'changes.statusTransition.to': 'refunded' },
            { 'actor.ipAddress': { $regex: /^(?!192\.168|10\.|172\.(1[6-9]|2[0-9]|3[0-1]))/ } }
        ]
    }).sort({ createdAt: -1 });
};

// Verify audit chain integrity
PaymentAuditLogSchema.statics.verifyAuditChain = async function(transactionId) {
    const audits = await this.find({ transactionId }).sort({ createdAt: 1 });
    
    const integrityReport = {
        transactionId,
        totalAudits: audits.length,
        validChain: true,
        breaks: [],
        details: []
    };
    
    for (let i = 0; i < audits.length; i++) {
        const audit = audits[i];
        const isValid = audit.verifyIntegrity();
        
        integrityReport.details.push({
            auditId: audit.auditId,
            action: audit.action,
            timestamp: audit.createdAt,
            valid: isValid,
            dataHash: audit.integrity.dataHash
        });
        
        if (!isValid) {
            integrityReport.validChain = false;
            integrityReport.breaks.push({
                auditId: audit.auditId,
                issue: 'Data integrity violation'
            });
        }
        
        // Verify chain links for corrections
        if (audit.relatedAudits && audit.relatedAudits.length > 0) {
            for (const related of audit.relatedAudits) {
                if (related.relationship === 'correction') {
                    const relatedAudit = audits.find(a => a.auditId === related.auditId);
                    if (!relatedAudit) {
                        integrityReport.validChain = false;
                        integrityReport.breaks.push({
                            auditId: audit.auditId,
                            issue: `Missing correction audit: ${related.auditId}`
                        });
                    }
                }
            }
        }
    }
    
    return integrityReport;
};

// Bulk archive old audits
PaymentAuditLogSchema.statics.archiveOldAudits = async function(retentionDays = 2555) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    
    const result = await this.updateMany(
        {
            createdAt: { $lt: cutoffDate },
            'compliance.legalHold': { $ne: true },
            'performance.archived': { $ne: true }
        },
        {
            $set: {
                'performance.archived': true,
                effectiveTo: new Date()
            }
        }
    );
    
    return {
        matched: result.matchedCount,
        modified: result.modifiedCount,
        cutoffDate: cutoffDate
    };
};

// Get audit statistics
PaymentAuditLogSchema.statics.getAuditStatistics = async function(startDate, endDate) {
    return await this.aggregate([
        {
            $match: {
                createdAt: { $gte: startDate, $lte: endDate }
            }
        },
        {
            $group: {
                _id: null,
                totalAudits: { $sum: 1 },
                byAction: {
                    $push: {
                        action: '$action',
                        count: 1
                    }
                },
                bySeverity: {
                    $push: {
                        severity: '$severity',
                        count: 1
                    }
                },
                byActor: {
                    $push: {
                        actorType: '$actor.type',
                        count: 1
                    }
                },
                highSeverityCount: {
                    $sum: {
                        $cond: [{ $in: ['$severity', ['high', 'critical']] }, 1, 0]
                    }
                }
            }
        },
        {
            $project: {
                totalAudits: 1,
                highSeverityCount: 1,
                actionBreakdown: {
                    $arrayToObject: {
                        $map: {
                            input: '$byAction',
                            as: 'item',
                            in: {
                                k: '$$item.action',
                                v: {
                                    $sum: '$$item.count'
                                }
                            }
                        }
                    }
                },
                severityBreakdown: {
                    $arrayToObject: {
                        $map: {
                            input: '$bySeverity',
                            as: 'item',
                            in: {
                                k: '$$item.severity',
                                v: {
                                    $sum: '$$item.count'
                                }
                            }
                        }
                    }
                },
                actorBreakdown: {
                    $arrayToObject: {
                        $map: {
                            input: '$byActor',
                            as: 'item',
                            in: {
                                k: '$$item.actorType',
                                v: {
                                    $sum: '$$item.count'
                                }
                            }
                        }
                    }
                }
            }
        }
    ]);
};

// ===== HOOKS FOR AUTOMATIC AUDIT CREATION =====

// Middleware to automatically create audit logs for PaymentTransaction changes
PaymentAuditLogSchema.statics.recordPaymentTransactionChange = async function(
    paymentTransaction, 
    action, 
    actor, 
    changes = null,
    reason = ''
) {
    const PaymentAuditLog = mongoose.model(`${process.env.APP_NAME}_PaymentAuditLog`);
    
    // Extract field changes if not provided
    let fieldChanges = changes;
    if (!fieldChanges && paymentTransaction._originalData) {
        fieldChanges = this.calculateFieldChanges(paymentTransaction._originalData, paymentTransaction.toObject());
    }
    
    const auditLog = new PaymentAuditLog({
        transactionId: paymentTransaction.transactionId,
        paymentTransactionId: paymentTransaction._id,
        clientId: paymentTransaction.clientId,
        planId: paymentTransaction.planId,
        subscriptionId: paymentTransaction.subscriptionId,
        action: action,
        severity: this.calculateSeverity(action, fieldChanges),
        source: AUDIT_SOURCE.SYSTEM,
        description: this.generateDescription(action, paymentTransaction, fieldChanges),
        reason: reason,
        snapshot: this.createSnapshot(paymentTransaction),
        changes: {
            fieldChanges: fieldChanges || [],
            statusTransition: paymentTransaction._originalData ? {
                from: paymentTransaction._originalData.status,
                to: paymentTransaction.status
            } : null
        },
        actor: actor,
        technicalContext: {
            service: 'payment-service',
            version: process.env.APP_VERSION,
            environment: process.env.NODE_ENV,
            requestId: actor.requestId,
            correlationId: actor.correlationId
        }
    });
    
    await auditLog.save();
    return auditLog;
};

// Helper method to calculate field changes
PaymentAuditLogSchema.statics.calculateFieldChanges = function(oldData, newData) {
    const changes = [];
    const allKeys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);
    
    for (const key of allKeys) {
        const oldValue = oldData[key];
        const newValue = newData[key];
        
        if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
            changes.push({
                field: key,
                path: key,
                oldValue: oldValue,
                newValue: newValue,
                dataType: typeof newValue,
                isSensitive: this.isSensitiveField(key)
            });
        }
    }
    
    return changes;
};

// Helper to identify sensitive fields
PaymentAuditLogSchema.statics.isSensitiveField = function(fieldPath) {
    const sensitiveFields = [
        'paymentMethod.details.card',
        'paymentMethod.details.wallet',
        'paymentMethod.details.bank',
        'paymentMethod.details.upi',
        'actor.ipAddress',
        'integrity.signature'
    ];
    
    return sensitiveFields.some(sensitive => fieldPath.includes(sensitive));
};

// Helper to calculate severity
PaymentAuditLogSchema.statics.calculateSeverity = function(action, changes) {
    const highSeverityActions = [AUDIT_ACTION.DELETE, AUDIT_ACTION.REFUND, AUDIT_ACTION.DISPUTE, AUDIT_ACTION.FRAUD_REVIEW];
    const mediumSeverityActions = [AUDIT_ACTION.UPDATE, AUDIT_ACTION.STATUS_CHANGE, AUDIT_ACTION.MANUAL_INTERVENTION];
    
    if (highSeverityActions.includes(action)) return AUDIT_SEVERITY.HIGH;
    if (mediumSeverityActions.includes(action)) return AUDIT_SEVERITY.MEDIUM;
    
    // Check for financial changes
    if (changes && changes.some(change => 
        change.field.includes('amount') && Math.abs(change.newValue - change.oldValue) > 1000
    )) {
        return AUDIT_SEVERITY.HIGH;
    }
    
    return AUDIT_SEVERITY.LOW;
};

// Helper to generate descriptions
PaymentAuditLogSchema.statics.generateDescription = function(action, transaction, changes) {
    const baseDescriptions = {
        [AUDIT_ACTION.CREATE]: `Payment transaction created for ${transaction.amount.grossAmount} ${transaction.amount.currency}`,
        [AUDIT_ACTION.UPDATE]: `Payment transaction updated`,
        [AUDIT_ACTION.DELETE]: `Payment transaction deleted`,
        [AUDIT_ACTION.STATUS_CHANGE]: `Payment status changed from ${transaction._originalData?.status} to ${transaction.status}`,
        [AUDIT_ACTION.REFUND]: `Refund processed for ${transaction.refund?.refundedAmount} ${transaction.amount.currency}`,
        [AUDIT_ACTION.DISPUTE]: `Dispute recorded for transaction`
    };
    
    return baseDescriptions[action] || `Payment audit action: ${action}`;
};

// Helper to create complete snapshot
PaymentAuditLogSchema.statics.createSnapshot = function(transaction) {
    // Create a deep clone excluding mongoose internals
    const snapshot = JSON.parse(JSON.stringify(transaction.toObject ? transaction.toObject() : transaction));
    
    // Remove mongoose-specific fields
    delete snapshot.__v;
    delete snapshot._id;
    delete snapshot.createdAt;
    delete snapshot.updatedAt;
    
    return snapshot;
};

module.exports = mongoose.model(`${process.env.APP_NAME}_PaymentAuditLog`, PaymentAuditLogSchema);