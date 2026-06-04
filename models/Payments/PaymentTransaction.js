// models/PaymentTransaction.js
const mongoose = require('mongoose');

const PAYMENT_STATUS = {
    PENDING: 'pending',
    COMPLETED: 'completed',
    FAILED: 'failed',
    REFUNDED: 'refunded',
    PARTIALLY_REFUNDED: 'partially_refunded',
    DISPUTED: 'disputed',
    CANCELLED: 'cancelled',
    EXPIRED: 'expired'
};

const TRANSACTION_TYPES = {
    SUBSCRIPTION: 'subscription',
    RENEWAL: 'renewal',
    UPGRADE: 'upgrade',
    DOWNGRADE: 'downgrade',
    ADDON: 'addon',
    SETUP_FEE: 'setup_fee',
    OVERAGE: 'overage',
    REFUND: 'refund',
    CREDIT: 'credit',
    ADJUSTMENT: 'adjustment',
    TAX: 'tax',
    CANCELLATION: 'cancellation'
};

const BILLING_CYCLES = {
    MONTHLY: 'monthly',
    QUARTERLY: 'quarterly',
    YEARLY: 'yearly',
    BIANNUAL: 'biannual',
    ONE_TIME: 'one_time'
};

const PAYMENT_METHODS = {
    // 💳 Common Global Methods
    CREDIT_CARD: 'credit_card',
    DEBIT_CARD: 'debit_card',
    PAYPAL: 'paypal',
    STRIPE: 'stripe',
    BANK_TRANSFER: 'bank_transfer',
    MANUAL: 'manual',
    OTHER: 'other',

    // 🇮🇳 India
    RAZORPAY: 'razorpay',
    PHONEPE: 'phonepe',
    PAYTM: 'paytm',
    GOOGLE_PAY_INDIA: 'google_pay_india',
    BHIM_UPI: 'bhim_upi',
    UPI: 'upi',
    MOBIKWIK: 'mobikwik',
    AMAZON_PAY_IN: 'amazon_pay_india',

    // 🇺🇸 United States
    VENMO: 'venmo',
    SQUARE: 'square',
    CASH_APP: 'cash_app',
    ZELLE: 'zelle',
    APPLE_PAY: 'apple_pay',
    GOOGLE_PAY_US: 'google_pay_us',

    // 🇪🇺 Europe
    SEPA: 'sepa_direct_debit',
    KLARNA: 'klarna',
    SOFORT: 'sofort',
    GIROPAY: 'giropay',
    IDEAL: 'ideal',
    BANCONTACT: 'bancontact',

    // 🇧🇷 Brazil
    PIX: 'pix',
    BOLETO: 'boleto_bancario',
    MERCADOPAGO: 'mercadopago',

    // 🇨🇳 China
    ALIPAY: 'alipay',
    WECHAT_PAY: 'wechat_pay',
    UNIONPAY: 'unionpay',

    // 🇰🇷 South Korea
    KAKAOPAY: 'kakaopay',
    TOSSPAY: 'tosspay',

    // 🌍 Africa
    MPESA: 'mpesa',
    AIRTEL_MONEY: 'airtel_money',
    MTN_MOBILE_MONEY: 'mtn_money',

    // 🇷🇺 Russia
    YANDEX_MONEY: 'yandex_money',
    QIWI: 'qiwi',

    // 🌏 Southeast Asia
    GRABPAY: 'grabpay',
    GOPAY: 'gopay',
    DANA: 'dana',
    SHOPEEPAY: 'shopeepay'
};

const PaymentTransactionSchema = new mongoose.Schema({
    // ===== CORE TRANSACTION IDENTIFIERS =====
    transactionId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    internalReference: {
        type: String,
        unique: true,
        sparse: true
    },
    
    // ===== CLIENT & PLAN REFERENCES =====
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
    
    // ===== TRANSACTION DETAILS =====
    transactionType: {
        type: String,
        enum: Object.values(TRANSACTION_TYPES),
        required: true,
        index: true
    },
    status: {
        type: String,
        enum: Object.values(PAYMENT_STATUS),
        required: true,
        default: PAYMENT_STATUS.PENDING,
        index: true
    },
    
    // ===== FINANCIAL DETAILS =====
    amount: {
        grossAmount: {
            type: Number,
            required: true,
            min: 0
        },
        netAmount: {
            type: Number,
            required: true,
            min: 0
        },
        taxAmount: {
            type: Number,
            default: 0,
            min: 0
        },
        discountAmount: {
            type: Number,
            default: 0,
            min: 0
        },
        currency: {
            type: String,
            required: true,
            default: 'USD',
            uppercase: true
        },
        exchangeRate: {
            type: Number,
            default: 1
        },
        baseCurrency: {
            type: String,
            default: 'USD',
            uppercase: true
        },
        baseAmount: {
            type: Number, // Amount in base currency
            required: true
        }
    },
    
    // ===== BILLING & SUBSCRIPTION DETAILS =====
    billingCycle: {
        type: String,
        enum: Object.values(BILLING_CYCLES),
        required: true
    },
    period: {
        startDate: {
            type: Date,
            required: true
        },
        endDate: {
            type: Date,
            required: true
        },
        prorated: {
            type: Boolean,
            default: false
        },
        prorationFactor: {
            type: Number, // 0-1, percentage of full period
            default: 1
        }
    },
    
    // ===== PAYMENT METHOD DETAILS =====
    paymentMethod: {
        type: {
            type: String,
            enum: Object.values(PAYMENT_METHODS),
            required: true
        },
        details: {
            // Credit/Debit Card
            card: {
                lastFour: String,
                brand: String,
                expiryMonth: Number,
                expiryYear: Number,
                country: String,
                funding: String, // credit, debit, prepaid
                fingerprint: String // For fraud detection
            },
            // Digital Wallets
            wallet: {
                email: String,
                phone: String,
                accountId: String
            },
            // Bank Transfer
            bank: {
                lastFour: String,
                bankName: String,
                accountType: String, // checking, savings
                routingNumber: String
            },
            // UPI
            upi: {
                vpa: String, // Virtual Payment Address
                provider: String
            }
        },
        paymentMethodId: String, // External payment method ID
        saveForFuture: {
            type: Boolean,
            default: false
        }
    },
    
    // ===== EXTERNAL PROVIDER DETAILS =====
    paymentProvider: {
        name: {
            type: String,
            required: true,
            enum: ['stripe', 'paypal', 'razorpay', 'manual', 'other']
        },
        transactionId: String, // External transaction ID
        customerId: String, // External customer ID
        invoiceId: String, // External invoice ID
        subscriptionId: String, // External subscription ID
        paymentIntentId: String, // For Stripe
        metadata: mongoose.Schema.Types.Mixed // Raw response from provider
    },
    
    // ===== INVOICE & RECEIPT DETAILS =====
    invoice: {
        number: {
            type: String,
            unique: true,
            sparse: true
        },
        items: [{
            description: String,
            amount: Number,
            quantity: {
                type: Number,
                default: 1
            },
            type: {
                type: String,
                enum: ['subscription', 'addon', 'setup', 'overage', 'tax', 'discount']
            },
            planTier: String,
            addonName: String
        }],
        pdfUrl: String,
        receiptUrl: String,
        sentAt: Date,
        viewedAt: Date
    },
    
    // ===== REFUND & DISPUTE DETAILS =====
    refund: {
        refundedAmount: {
            type: Number,
            default: 0
        },
        refundReason: String,
        refundedAt: Date,
        refundTransactionId: String, // Link to refund transaction
        refundedBy: {
            type: mongoose.Schema.Types.ObjectId,
            refPath: 'refund.refundedByModel'
        },
        refundedByModel: {
            type: String,
            enum: [`${process.env.APP_NAME}_ClientTeamMember`, `${process.env.APP_NAME}_Admin`]
        }
    },
    
    dispute: {
        disputed: {
            type: Boolean,
            default: false
        },
        disputeReason: String,
        disputeAmount: Number,
        disputeDate: Date,
        resolution: {
            type: String,
            enum: ['won', 'lost', 'pending']
        },
        resolvedAt: Date,
        disputeId: String // External dispute ID
    },
    
    // ===== FRAUD & RISK ANALYSIS =====
    riskAssessment: {
        score: {
            type: Number,
            min: 0,
            max: 100,
            default: 0
        },
        level: {
            type: String,
            enum: ['low', 'medium', 'high', 'very_high'],
            default: 'low'
        },
        factors: [{
            type: String,
            enum: [
                'high_value',
                'new_customer',
                'unusual_location',
                'velocity_check',
                'ip_reputation',
                'device_fingerprint',
                'billing_address_mismatch'
            ]
        }],
        reviewed: {
            type: Boolean,
            default: false
        },
        reviewedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: `${process.env.APP_NAME}_Admin`
        },
        reviewedAt: Date
    },
    
    // ===== GEOGRAPHIC & DEVICE INFORMATION =====
    geoLocation: {
        ipAddress: String,
        country: String,
        region: String,
        city: String,
        timezone: String,
        coordinates: {
            latitude: Number,
            longitude: Number
        },
        isp: String
    },
    
    deviceInfo: {
        userAgent: String,
        browser: String,
        os: String,
        deviceType: String,
        deviceId: String,
        screenResolution: String,
        language: String
    },
    
    // ===== TAX & COMPLIANCE =====
    tax: {
        taxId: String, // VAT/GST number
        taxRate: Number,
        taxJurisdiction: String,
        taxCertificate: String // URL to tax certificate
    },
    
    compliance: {
        gdprConsent: Boolean,
        termsAccepted: Boolean,
        termsVersion: String,
        privacyPolicyVersion: String
    },
    
    // ===== FAILURE & RETRY DETAILS =====
    failure: {
        reason: String,
        code: String,
        message: String,
        declineCode: String, // Card decline code
        retryCount: {
            type: Number,
            default: 0
        },
        lastRetryAt: Date,
        nextRetryAt: Date
    },
    
    // ===== RELATED TRANSACTIONS =====
    relatedTransactions: [{
        transactionId: String,
        relationType: {
            type: String,
            enum: ['refund', 'parent', 'child', 'reversal', 'adjustment']
        },
        amount: Number
    }],
    
    // ===== AUDIT & METADATA =====
    metadata: mongoose.Schema.Types.Mixed,
    notes: String,
    tags: [String],
    
    // ===== TIMESTAMPS =====
    processedAt: Date,
    completedAt: Date,
    failedAt: Date,
    refundedAt: Date,
    disputedAt: Date,
    
    // ===== CREATED BY =====
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        refPath: 'createdByModel',
        required: true
    },
    createdByModel: {
        type: String,
        required: true,
        enum: [`${process.env.APP_NAME}_ClientTeamMember`, `${process.env.APP_NAME}_Admin`]
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// ===== INDEXES =====
PaymentTransactionSchema.index({ transactionId: 1 });
PaymentTransactionSchema.index({ clientId: 1, createdAt: -1 });
PaymentTransactionSchema.index({ planId: 1, status: 1 });
PaymentTransactionSchema.index({ status: 1, createdAt: -1 });
PaymentTransactionSchema.index({ 'paymentProvider.transactionId': 1 });
PaymentTransactionSchema.index({ 'invoice.number': 1 });
PaymentTransactionSchema.index({ createdAt: 1 });
PaymentTransactionSchema.index({ 'period.endDate': 1 });
PaymentTransactionSchema.index({ 'geoLocation.country': 1 });
PaymentTransactionSchema.index({ 'riskAssessment.level': 1 });

// ===== VIRTUAL FIELDS =====
PaymentTransactionSchema.virtual('isSuccessful').get(function() {
    return this.status === PAYMENT_STATUS.COMPLETED;
});

PaymentTransactionSchema.virtual('isRefundable').get(function() {
    return this.status === PAYMENT_STATUS.COMPLETED && 
           this.refund.refundedAmount < this.amount.grossAmount &&
           this.dispute.disputed !== true;
});

PaymentTransactionSchema.virtual('daysUntilDue').get(function() {
    if (this.status !== PAYMENT_STATUS.PENDING) return 0;
    const dueDate = this.period.startDate;
    const now = new Date();
    return Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24));
});

// ===== PRE-SAVE MIDDLEWARE =====
PaymentTransactionSchema.pre('save', function(next) {
    // Generate internal reference if not exists
    if (!this.internalReference) {
        this.internalReference = `TX-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    
    // Generate invoice number if not exists and transaction is completed
    if (!this.invoice.number && this.status === PAYMENT_STATUS.COMPLETED) {
        const date = new Date();
        this.invoice.number = `INV-${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}-${Math.random().toString(36).substr(2, 8).toUpperCase()}`;
    }
    
    // Set timestamps based on status changes
    if (this.isModified('status')) {
        const now = new Date();
        switch (this.status) {
            case PAYMENT_STATUS.COMPLETED:
                this.completedAt = this.completedAt || now;
                break;
            case PAYMENT_STATUS.FAILED:
                this.failedAt = this.failedAt || now;
                break;
            case PAYMENT_STATUS.REFUNDED:
            case PAYMENT_STATUS.PARTIALLY_REFUNDED:
                this.refundedAt = this.refundedAt || now;
                break;
            case PAYMENT_STATUS.DISPUTED:
                this.disputedAt = this.disputedAt || now;
                break;
        }
    }
    
    next();
});

// ===== INSTANCE METHODS =====

// Method to process refund
PaymentTransactionSchema.methods.processRefund = async function(amount, reason, refundedBy, refundedByModel) {
    if (!this.isRefundable) {
        throw new Error('Transaction is not refundable');
    }
    
    const refundAmount = amount || (this.amount.grossAmount - this.refund.refundedAmount);
    
    if (refundAmount > (this.amount.grossAmount - this.refund.refundedAmount)) {
        throw new Error('Refund amount exceeds available amount');
    }
    
    this.refund.refundedAmount += refundAmount;
    this.refund.refundReason = reason;
    this.refund.refundedAt = new Date();
    this.refund.refundedBy = refundedBy;
    this.refund.refundedByModel = refundedByModel;
    
    // Update status
    if (this.refund.refundedAmount >= this.amount.grossAmount) {
        this.status = PAYMENT_STATUS.REFUNDED;
    } else {
        this.status = PAYMENT_STATUS.PARTIALLY_REFUNDED;
    }
    
    await this.save();
    
    // Create refund transaction record
    const PaymentTransaction = mongoose.model(`${process.env.APP_NAME}_PaymentTransaction`);
    const refundTransaction = new PaymentTransaction({
        transactionId: `REF-${this.transactionId}-${Date.now()}`,
        clientId: this.clientId,
        planId: this.planId,
        subscriptionId: this.subscriptionId,
        transactionType: TRANSACTION_TYPES.REFUND,
        status: PAYMENT_STATUS.COMPLETED,
        amount: {
            grossAmount: -refundAmount,
            netAmount: -refundAmount,
            currency: this.amount.currency,
            baseAmount: -refundAmount
        },
        paymentMethod: this.paymentMethod,
        paymentProvider: this.paymentProvider,
        createdBy: refundedBy,
        createdByModel: refundedByModel,
        relatedTransactions: [{
            transactionId: this.transactionId,
            relationType: 'parent',
            amount: refundAmount
        }]
    });
    
    await refundTransaction.save();
    
    // Update original transaction with refund reference
    this.relatedTransactions.push({
        transactionId: refundTransaction.transactionId,
        relationType: 'refund',
        amount: refundAmount
    });
    
    await this.save();
    
    return refundTransaction;
};

// Method to mark as disputed
PaymentTransactionSchema.methods.markAsDisputed = async function(reason, amount = null) {
    this.dispute.disputed = true;
    this.dispute.disputeReason = reason;
    this.dispute.disputeAmount = amount || this.amount.grossAmount;
    this.dispute.disputeDate = new Date();
    this.status = PAYMENT_STATUS.DISPUTED;
    
    await this.save();
    return this;
};

// Method to retry failed payment
PaymentTransactionSchema.methods.retryPayment = async function() {
    if (this.status !== PAYMENT_STATUS.FAILED) {
        throw new Error('Can only retry failed payments');
    }
    
    if (this.failure.retryCount >= 3) {
        throw new Error('Maximum retry attempts reached');
    }
    
    this.status = PAYMENT_STATUS.PENDING;
    this.failure.retryCount += 1;
    this.failure.lastRetryAt = new Date();
    this.failure.nextRetryAt = new Date(Date.now() + (24 * 60 * 60 * 1000)); // 24 hours later
    
    await this.save();
    return this;
};

// ===== STATIC METHODS =====

// Get revenue statistics
PaymentTransactionSchema.statics.getRevenueStats = async function(startDate, endDate, currency = 'USD') {
    const matchStage = {
        status: PAYMENT_STATUS.COMPLETED,
        createdAt: { $gte: startDate, $lte: endDate },
        'amount.currency': currency
    };
    
    const stats = await this.aggregate([
        { $match: matchStage },
        {
            $group: {
                _id: null,
                totalRevenue: { $sum: '$amount.grossAmount' },
                totalTransactions: { $sum: 1 },
                averageTransaction: { $avg: '$amount.grossAmount' },
                minTransaction: { $min: '$amount.grossAmount' },
                maxTransaction: { $max: '$amount.grossAmount' }
            }
        }
    ]);
    
    return stats[0] || {
        totalRevenue: 0,
        totalTransactions: 0,
        averageTransaction: 0,
        minTransaction: 0,
        maxTransaction: 0
    };
};

// Get payment method distribution
PaymentTransactionSchema.statics.getPaymentMethodDistribution = async function(startDate, endDate) {
    return await this.aggregate([
        {
            $match: {
                status: PAYMENT_STATUS.COMPLETED,
                createdAt: { $gte: startDate, $lte: endDate }
            }
        },
        {
            $group: {
                _id: '$paymentMethod.type',
                count: { $sum: 1 },
                totalAmount: { $sum: '$amount.grossAmount' },
                averageAmount: { $avg: '$amount.grossAmount' }
            }
        },
        { $sort: { totalAmount: -1 } }
    ]);
};

// Find failed payments for retry
PaymentTransactionSchema.statics.findFailedPaymentsForRetry = function() {
    const now = new Date();
    return this.find({
        status: PAYMENT_STATUS.FAILED,
        'failure.retryCount': { $lt: 3 },
        $or: [
            { 'failure.nextRetryAt': { $lte: now } },
            { 'failure.nextRetryAt': { $exists: false } }
        ]
    });
};

// Get client payment history
PaymentTransactionSchema.statics.getClientPaymentHistory = function(clientId, limit = 50) {
    return this.find({ clientId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate('planId', 'name tier')
        .populate('createdBy', 'name email');
};

// ===== EXPIRATION CLEANUP =====
PaymentTransactionSchema.statics.cleanupExpiredPending = async function() {
    const expiryTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
    
    const result = await this.updateMany(
        {
            status: PAYMENT_STATUS.PENDING,
            createdAt: { $lt: expiryTime }
        },
        {
            $set: {
                status: PAYMENT_STATUS.EXPIRED,
                failure: {
                    reason: 'Payment expired',
                    code: 'EXPIRED'
                }
            }
        }
    );
    
    return result.modifiedCount;
};

module.exports = mongoose.model(`${process.env.APP_NAME}_PaymentTransaction`, PaymentTransactionSchema);