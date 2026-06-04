const mongoose = require('mongoose');

const UserUserTermsOfServiceAcceptanceSchema = new mongoose.Schema({
    // The user who accepted the terms
    user: {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            refPath: 'user.userModel'
        },
        userModel: {
            type: String,
            required: true,
            enum: [`${process.env.APP_NAME}_User`, `${process.env.APP_NAME}_Admin`, `${process.env.APP_NAME}_Client`]
        }
    },
    // The client/tenant context for the terms
    clientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: `${process.env.APP_NAME}_Client`
    },
    // Specific document that was accepted
    documentName: {
        type: String,
        required: true // e.g., "Terms of Service v2.1", "Privacy Policy v1.5"
    },
    documentVersion: {
        type: String,
        required: true // e.g., "2.1", "1.5"
    },
    documentId: {
        type: String // Optional: an internal ID linking to a CMS or file storage
    },
    // Checksum or hash of the document content at the time of acceptance
    contentHash: String,
    ipAddress: {
        type: String,
        required: true
    },
    userAgent: String,
    acceptedVia: {
        type: String,
        enum: ['web', 'api', 'mobile', 'cli'],
        default: 'web'
    }
}, {
    timestamps: true // `createdAt` is the acceptance time
});

// Indexes for querying acceptance history
UserTermsOfServiceAcceptanceSchema.index({ 'user.userId': 1, documentName: 1 });
UserTermsOfServiceAcceptanceSchema.index({ clientId: 1, documentVersion: 1 });
UserTermsOfServiceAcceptanceSchema.index({ documentName: 1, createdAt: -1 }); // Find latest acceptances for a doc

module.exports = mongoose.model(`${process.env.APP_NAME}_UserTermsAcceptance`, UserTermsOfServiceAcceptanceSchema);