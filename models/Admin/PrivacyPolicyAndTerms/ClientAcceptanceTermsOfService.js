const mongoose = require('mongoose');

const ClientTermsAcceptanceSchema = new mongoose.Schema({
    // The Client who accepted the terms
    clientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: `${process.env.APP_NAME}_Client`,
        required: true
    },
    // The Admin user who acted on behalf of the client (if applicable)
    acceptedByAdmin: {
        type: mongoose.Schema.Types.ObjectId,
        ref: `${process.env.APP_NAME}_Admin`
    },
    // Specific document that was accepted
    documentName: {
        type: String,
        required: true // e.g., "Master Service Agreement", "Data Processing Addendum v3.0", "API Terms of Use"
    },
    documentType: {
        type: String,
        enum: ['terms_of_service', 'privacy_policy', 'service_agreement', 'data_processing_agreement', 'api_agreement', 'sla'],
        required: true
    },
    documentVersion: {
        type: String,
        required: true // e.g., "3.2", "1.0"
    },
    documentId: {
        type: String // Optional: an internal ID linking to a CMS or file storage
    },
    // Checksum or hash of the document content at the time of acceptance
    contentHash: String,
    // Legal entity information (if different from client name)
    legalEntityName: String,
    signatoryName: String,
    signatoryTitle: String,
    ipAddress: String,
    userAgent: String,
    acceptedVia: {
        type: String,
        enum: ['web_portal', 'api', 'contract_signature', 'admin_console'],
        default: 'web_portal'
    },
    // For tracking renewals or updates
    supersedesAcceptance: {
        type: mongoose.Schema.Types.ObjectId,
        ref: `${process.env.APP_NAME}_ClientTermsAcceptance`
    },
    // Metadata for compliance
    complianceMetadata: mongoose.Schema.Types.Mixed
}, {
    timestamps: true // `createdAt` is the acceptance time
});

// Indexes for querying client acceptance history
ClientTermsAcceptanceSchema.index({ clientId: 1, documentType: 1 });
ClientTermsAcceptanceSchema.index({ clientId: 1, createdAt: -1 }); // Latest acceptances for a client
ClientTermsAcceptanceSchema.index({ documentType: 1, documentVersion: 1 }); // Find clients on specific doc versions
ClientTermsAcceptanceSchema.index({ acceptedByAdmin: 1 });

// Virtual to get the most recent acceptance for a document type
ClientTermsAcceptanceSchema.virtual('isCurrent').get(function() {
    // This would typically be determined by application logic checking the latest version
    return true; // Placeholder
});

module.exports = mongoose.model(`${process.env.APP_NAME}_ClientTermsAcceptance`, ClientTermsAcceptanceSchema);