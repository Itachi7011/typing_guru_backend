const mongoose = require('mongoose');

const PolicyVersionSchema = new mongoose.Schema({
    content: {
        type: String,
        required: true // HTML or Markdown content of the policy
    },
    contentHash: {
        type: String,
        required: true // SHA-256 hash for integrity verification
    },
    version: {
        type: String,
        required: true // Semantic versioning: e.g., "1.0.2"
    },
    changeLog: {
        type: String,
        required: true // Summary of changes in this version
    },
    effectiveDate: {
        type: Date,
        required: true
    },
    isPublished: {
        type: Boolean,
        default: false
    },
    publishedAt: Date,
    createdBy: {
        adminId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: `${process.env.APP_NAME}_Admin`,
            required: true
        },
        email: {
            type: String,
            required: true
        }
    },
    metadata: {
        templateUsed: String,
        jurisdiction: String,
        complianceFramework: [String], // e.g., ['GDPR', 'CCPA', 'PIPEDA']
        lastReviewed: Date,
        nextReviewDate: Date,
        approvedBy: {
            adminId: mongoose.Schema.Types.ObjectId,
            email: String,
            approvedAt: Date
        },
        tags: [String] // For categorization
    },
}, {
    timestamps: true // Tracks when this specific version was created/updated
});

const PrivacyPolicySchema = new mongoose.Schema({
    // Identifier for the policy scope (global, or client-specific)
    scope: {
        type: String,
        enum: ['global', 'client'],
        default: 'global'
    },
    adminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: `${process.env.APP_NAME}_Client`,
        // Required only if scope is 'client'
        required: function () {
            return this.scope === 'client';
        }
    },
    // Current active version
    currentVersion: {
        type: String,
        required: true
    },
    // All versions of this policy (limited to last 3 including current)
    versions: [PolicyVersionSchema],
    // Audit log for all modifications (not just version creations)
    modificationHistory: [{
        action: {
            type: String,
            enum: ['created', 'updated', 'published', 'unpublished', 'archived'],
            required: true
        },
        targetVersion: String, // Which version was affected
        changes: mongoose.Schema.Types.Mixed, // Specific changes made
        modifiedBy: {
            adminId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: `${process.env.APP_NAME}_Admin`,
                required: true
            },
            email: {
                type: String,
                required: true
            }
        },
        ipAddress: String,
        userAgent: String,
        timestamp: {
            type: Date,
            default: Date.now
        }
    }],
    // Settings
    requiresReacceptance: {
        type: Boolean,
        default: true // Whether users need to re-accept after updates
    },
    isActive: {
        type: Boolean,
        default: true
    },
    language: {
        type: String,
        default: 'en' // ISO language code
    },
    region: {
        type: String, // For region-specific policies (e.g., 'EU', 'California')
        default: 'global'
    }
}, {
    timestamps: true
});

// Indexes
PrivacyPolicySchema.index({ scope: 1, adminId: 1 }, { unique: true });
PrivacyPolicySchema.index({ 'versions.version': 1 });
PrivacyPolicySchema.index({ 'versions.effectiveDate': 1 });
PrivacyPolicySchema.index({ isActive: 1 });

PrivacyPolicySchema.index({ 'metadata.complianceFramework': 1 });
PrivacyPolicySchema.index({ 'metadata.nextReviewDate': 1 });
PrivacyPolicySchema.index({ 'modificationHistory.timestamp': -1 });

// Virtual to get the current version document
PrivacyPolicySchema.virtual('currentVersionDoc').get(function () {
    return this.versions.find(v => v.version === this.currentVersion);
});

// Virtual to get the previous two versions (for history)
PrivacyPolicySchema.virtual('previousVersions').get(function () {
    // Sort versions by creation date descending, exclude current
    const sorted = [...this.versions].sort((a, b) => b.createdAt - a.createdAt);
    return sorted.filter(v => v.version !== this.currentVersion).slice(0, 2);
});

// Pre-save middleware to maintain only 3 versions (current + 2 previous)
PrivacyPolicySchema.pre('save', function (next) {
    if (this.versions.length > 3) {
        // Sort by creation date, keep the newest 3
        this.versions.sort((a, b) => b.createdAt - a.createdAt);
        this.versions = this.versions.slice(0, 3);

        // Ensure current version is still in the array
        if (!this.versions.find(v => v.version === this.currentVersion)) {
            // If current was removed, set current to the newest version
            this.currentVersion = this.versions[0].version;
        }
    }
    next();
});

// Method to add a new version
PrivacyPolicySchema.methods.addVersion = function (versionData, admin) {
    const crypto = require('crypto');

    const newVersion = {
        content: versionData.content,
        contentHash: crypto.createHash('sha256').update(versionData.content).digest('hex'),
        version: versionData.version,
        changeLog: versionData.changeLog,
        effectiveDate: versionData.effectiveDate,
        createdBy: {
            adminId: admin._id,
            email: admin.email
        }
    };

    this.versions.unshift(newVersion); // Add to beginning
    this.currentVersion = versionData.version;

    // Add to modification history
    this.modificationHistory.push({
        action: 'created',
        targetVersion: versionData.version,
        changes: { changeLog: versionData.changeLog },
        modifiedBy: {
            adminId: admin._id,
            email: admin.email
        },
        ipAddress: versionData.ipAddress,
        userAgent: versionData.userAgent
    });
};

// Method to publish a version
PrivacyPolicySchema.methods.publishVersion = function (version, admin, ipAddress, userAgent) {
    const versionDoc = this.versions.find(v => v.version === version);
    if (versionDoc) {
        versionDoc.isPublished = true;
        versionDoc.publishedAt = new Date();

        this.modificationHistory.push({
            action: 'published',
            targetVersion: version,
            modifiedBy: {
                adminId: admin._id,
                email: admin.email
            },
            ipAddress,
            userAgent
        });
    }
};

module.exports = mongoose.model(`${process.env.APP_NAME}_PrivacyPolicy`, PrivacyPolicySchema);