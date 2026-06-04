const mongoose = require('mongoose');

const ContactEnquirySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100
    },
    email: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
        maxlength: 100
    },
    phone: {
        type: String,
        trim: true,
        maxlength: 20
    },
    category: {
        type: String,
        enum: [
            'general',
            'support',
            'sales',
            'billing',
            'partnership',
            'security',
            'feedback'
        ],
        default: 'general'
    },
    subject: {
        type: String,
        trim: true,
        maxlength: 150
    },
    urgency: {
        type: String,
        enum: ['low', 'normal', 'high', 'critical'],
        default: 'normal'
    },
    message: {
        type: String,
        required: true,
        trim: true,
        maxlength: 2000
    },
    ipAddress: {
        type: String,
        trim: true
    },
    userAgent: {
        type: String,
        trim: true
    },
    status: {
        type: String,
        enum: ['new', 'open', 'in_progress', 'on_hold', 'resolved', 'closed'],
        default: 'new'
    }
    ,

    assignedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: `${process.env.APP_NAME}_Admin`
    }

    ,


    adminNotes: {
        type: String,
        trim: true,
        maxlength: 2000
    }

    ,

    tags: [{
        type: String,
        trim: true,
        lowercase: true
    }]
    ,
    source: {
        type: String,
        enum: ['contact_form', 'chatbot', 'manual_entry', 'api'],
        default: 'contact_form'
    }
    ,
    followUpAt: Date
    ,
    responseHistory: [{
        respondedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: `${process.env.APP_NAME}_Admin`
        },
        respondedAt: Date,
        message: {
            type: String,
            maxlength: 2000
        }
    }]
    ,

    isResolved: {
        type: Boolean,
        default: false
    },

    isDeleted: {
        type: Boolean,
        default: false
    },
    deletedAt: {
        type: Date,
    },
    resolvedAt: Date,
    resolvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: `${process.env.APP_NAME}_Admin`
    }
}, {
    timestamps: true
});

ContactEnquirySchema.index({ email: 1, createdAt: -1 });

module.exports = mongoose.model(`${process.env.APP_NAME}_ContactEnquiry`, ContactEnquirySchema);
