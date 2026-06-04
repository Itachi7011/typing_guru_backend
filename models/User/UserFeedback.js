const mongoose = require('mongoose');

const UserFeedbackAttachmentSchema = new mongoose.Schema({
    filename: {
        type: String,
        required: true
    },
    originalName: String,
    mimeType: String,
    size: Number,
    key: String, // Key for S3 or file storage
    uploadedAt: {
        type: Date,
        default: Date.now
    }
});

const UserFeedbackSchema = new mongoose.Schema({
    // Link to the user who submitted the feedback (if logged in)
    submittedBy: {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            refPath: 'submittedBy.userModel'
        },
        userModel: {
            type: String,
            enum: [`${process.env.APP_NAME}_User`, `${process.env.APP_NAME}_Admin`, `${process.env.APP_NAME}_Client`]
        },
        name: String,
        email: String
    },
    // Link to the client's platform this feedback is for
    clientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: `${process.env.APP_NAME}_Client`,
        required: true
    },
    type: {
        type: String,
        enum: ['bug', 'feature_request', 'general_feedback', 'support_question', 'complaint'],
        required: true,
        default: 'general_feedback'
    },
    subject: {
        type: String,
        required: true,
        trim: true,
        maxlength: 200
    },
    message: {
        type: String,
        required: true,
        maxlength: 5000
    },
    priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical'],
        default: 'medium'
    },
    status: {
        type: String,
        enum: ['new', 'open', 'in_progress', 'resolved', 'closed', 'on_hold'],
        default: 'new'
    },
    assignedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: `${process.env.APP_NAME}_Admin`
    },
    attachments: [UserFeedbackAttachmentSchema],
    // For internal notes and updates by admins/support
    internalNotes: [{
        note: String,
        addedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: `${process.env.APP_NAME}_Admin`
        },
        addedAt: {
            type: Date,
            default: Date.now
        },
        isInternal: { // Some notes might be visible to the user
            type: Boolean,
            default: true
        }
    }],
    // For public replies to the user
    replies: [{
        message: String,
        repliedBy: {
            type: mongoose.Schema.Types.ObjectId,
            refPath: 'replies.replierModel'
        },
        replierModel: {
            type: String,
            enum: [`${process.env.APP_NAME}_Admin`, `${process.env.APP_NAME}_Client`, `${process.env.APP_NAME}_User`]
        },
        repliedAt: {
            type: Date,
            default: Date.now
        },
        attachments: [UserFeedbackAttachmentSchema]
    }],
    // Metadata for analytics and filtering
    userAgent: String,
    ipAddress: String,
    pageUrl: String, // URL where the feedback was submitted from
    customMetadata: mongoose.Schema.Types.Mixed,
    resolvedAt: Date,
    closedAt: Date,
    // Satisfaction rating after resolution
    satisfactionRating: {
        type: Number,
        min: 1,
        max: 5
    },
    feedbackOnResolution: String
}, {
    timestamps: true
});

// Indexes for efficient querying
UserFeedbackSchema.index({ clientId: 1, status: 1 });
UserFeedbackSchema.index({ type: 1, createdAt: -1 });
UserFeedbackSchema.index({ 'submittedBy.userId': 1 });
UserFeedbackSchema.index({ assignedTo: 1 });
UserFeedbackSchema.index({ priority: 1, status: 1 });

module.exports = mongoose.model(`${process.env.APP_NAME}_UserFeedback`, UserFeedbackSchema);