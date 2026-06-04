const mongoose = require('mongoose');

// Reusing the same PolicyVersionSchema
const TermsVersionSchema = new mongoose.Schema({
    content: {
        type: String,
        required: true
    },
    contentHash: {
        type: String,
        required: true
    },
    version: {
        type: String,
        required: true
    },
    changeLog: {
        type: String,
        required: true
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
    metadata: mongoose.Schema.Types.Mixed
}, {
    timestamps: true
});

const TermsOfServiceSchema = new mongoose.Schema({
    scope: {
        type: String,
        enum: ['global', 'client'],
        default: 'global'
    },
    adminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: `${process.env.APP_NAME}_Client`,
        required: function () {
            return this.scope === 'client';
        }
    },
    documentType: {
        type: String,
        enum: ['terms_of_service', 'service_agreement', 'api_agreement', 'sla'],
        default: 'terms_of_service'
    },
    currentVersion: {
        type: String,
        required: true
    },
    versions: [TermsVersionSchema],
    modificationHistory: [{
        action: {
            type: String,
            enum: ['created', 'updated', 'published', 'unpublished', 'archived'],
            required: true
        },
        targetVersion: String,
        changes: mongoose.Schema.Types.Mixed,
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
    requiresReacceptance: {
        type: Boolean,
        default: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    language: {
        type: String,
        default: 'en'
    },
    region: {
        type: String,
        default: 'global'
    },
    // Additional fields for terms-specific properties
    appliesTo: {
        users: { type: Boolean, default: true },
        clients: { type: Boolean, default: true },
        admins: { type: Boolean, default: true }
    },
    minimumAge: {
        type: Number,
        default: 13
    }
}, {
    timestamps: true
});

// Indexes
TermsOfServiceSchema.index({ scope: 1, adminId: 1, documentType: 1 }, { unique: true });
TermsOfServiceSchema.index({ documentType: 1 });
TermsOfServiceSchema.index({ 'versions.version': 1 });
TermsOfServiceSchema.index({ isActive: 1 });

TermsOfServiceSchema.index({
    scope: 1,
    adminId: 1,
    documentType: 1,
    isActive: 1
}, {
    name: 'terms_lookup_index'
});

// Index for version queries
TermsOfServiceSchema.index({
    'versions.version': 1,
    'versions.isPublished': 1
}, {
    name: 'version_status_index'
});

// Index for modification history queries
TermsOfServiceSchema.index({
    'modificationHistory.timestamp': -1
}, {
    name: 'modification_history_index'
});

// Virtuals
TermsOfServiceSchema.virtual('currentVersionDoc').get(function () {
    return this.versions.find(v => v.version === this.currentVersion);
});

TermsOfServiceSchema.virtual('previousVersions').get(function () {
    const sorted = [...this.versions].sort((a, b) => b.createdAt - a.createdAt);
    return sorted.filter(v => v.version !== this.currentVersion).slice(0, 2);
});

// Pre-save middleware to maintain version limit
TermsOfServiceSchema.pre('save', function (next) {
    if (this.versions.length > 3) {
        this.versions.sort((a, b) => b.createdAt - a.createdAt);
        this.versions = this.versions.slice(0, 3);

        if (!this.versions.find(v => v.version === this.currentVersion)) {
            this.currentVersion = this.versions[0].version;
        }
    }
    next();
});

// Methods
TermsOfServiceSchema.methods.addVersion = function (versionData, admin) {
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

    this.versions.unshift(newVersion);
    this.currentVersion = versionData.version;

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

TermsOfServiceSchema.methods.publishVersion = function (version, admin, ipAddress, userAgent) {
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

// Static method to find the applicable terms for a user/client
TermsOfServiceSchema.statics.findApplicableTerms = function (scope, adminId, documentType = 'terms_of_service') {
    const query = {
        isActive: true,
        documentType,
        'versions.isPublished': true
    };

    if (scope === 'client' && adminId) {
        query.$or = [
            { scope: 'global' },
            { scope: 'client', adminId: adminId }
        ];
    } else {
        query.scope = 'global';
    }

    return this.find(query).sort({ scope: 1 }); // Client-specific first, then global
};

TermsOfServiceSchema.statics.getTermsWithStats = function () {
    return this.aggregate([
        {
            $addFields: {
                totalVersions: { $size: "$versions" },
                publishedVersions: {
                    $size: {
                        $filter: {
                            input: "$versions",
                            cond: { $eq: ["$$this.isPublished", true] }
                        }
                    }
                },
                draftVersions: {
                    $size: {
                        $filter: {
                            input: "$versions",
                            cond: { $eq: ["$$this.isPublished", false] }
                        }
                    }
                },
                currentVersionDoc: {
                    $arrayElemAt: [
                        {
                            $filter: {
                                input: "$versions",
                                cond: { $eq: ["$$this.version", "$currentVersion"] }
                            }
                        },
                        0
                    ]
                },
                latestVersion: {
                    $arrayElemAt: [
                        {
                            $sortArray: {
                                input: "$versions",
                                sortBy: { createdAt: -1 }
                            }
                        },
                        0
                    ]
                }
            }
        },
        {
            $sort: { createdAt: -1 }
        }
    ]);
};

// Additional method to get version history with changes
TermsOfServiceSchema.methods.getVersionHistory = function () {
    return this.versions
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .map(version => ({
            version: version.version,
            effectiveDate: version.effectiveDate,
            isPublished: version.isPublished,
            publishedAt: version.publishedAt,
            changeLog: version.changeLog,
            createdBy: version.createdBy,
            contentLength: version.content.length,
            createdAt: version.createdAt
        }));
};

// Method to check if terms need user reacceptance
TermsOfServiceSchema.methods.needsReacceptance = function (userLastAcceptedVersion) {
    if (!userLastAcceptedVersion) return true;
    if (!this.requiresReacceptance) return false;

    // Check if current version is different from last accepted
    return this.currentVersion !== userLastAcceptedVersion;
};

// Method to get content diff between versions (basic implementation)
TermsOfServiceSchema.methods.getVersionDiff = function (fromVersion, toVersion) {
    const fromVersionDoc = this.versions.find(v => v.version === fromVersion);
    const toVersionDoc = this.versions.find(v => v.version === toVersion);

    if (!fromVersionDoc || !toVersionDoc) {
        return null;
    }

    return {
        fromVersion: fromVersion,
        toVersion: toVersion,
        fromContent: fromVersionDoc.content,
        toContent: toVersionDoc.content,
        changeLogs: {
            from: fromVersionDoc.changeLog,
            to: toVersionDoc.changeLog
        },
        contentLengthChange: toVersionDoc.content.length - fromVersionDoc.content.length,
        effectiveDateChange: toVersionDoc.effectiveDate - fromVersionDoc.effectiveDate
    };
};



module.exports = mongoose.model(`${process.env.APP_NAME}_TermsOfService`, TermsOfServiceSchema);