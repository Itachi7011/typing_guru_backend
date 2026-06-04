// middleware/paymentAuditMiddleware.js
const mongoose = require('mongoose');

const setupPaymentAuditMiddleware = () => {
    const PaymentTransaction = mongoose.model(`${process.env.APP_NAME}_PaymentTransaction`);
    const PaymentAuditLog = mongoose.model(`${process.env.APP_NAME}_PaymentAuditLog`);

    // Store original data before changes
    PaymentTransaction.schema.pre('save', function (next) {
        if (this.isModified() && !this.isNew) {
            this._originalData = this._originalData || this.constructor.findById(this._id).lean();
        }
        next();
    });

    // Create audit log after changes
    PaymentTransaction.schema.post('save', async function (doc) {
        try {
            const action = this.isNew ? 'create' : 'update';

            // Get actor information from context (you might need to set this in your request context)
            const actor = {
                id: doc.createdBy || 'system',
                type: doc.createdByModel || `${process.env.APP_NAME}_System`,
                ipAddress: this._context?.ipAddress || 'unknown',
                userAgent: this._context?.userAgent || 'unknown'
            };

            await PaymentAuditLog.recordPaymentTransactionChange(
                doc,
                action,
                actor,
                null, // changes will be calculated automatically
                this.isNew ? 'New payment transaction' : 'Payment transaction updated'
            );
        } catch (error) {
            // Don't let audit failures break the main transaction
            console.error('Failed to create audit log:', error);
        }
    });

    // Handle deletions
    PaymentTransaction.schema.post('remove', async function (doc) {
        try {
            const actor = {
                id: 'system',
                type: `${process.env.APP_NAME}_System`,
                ipAddress: 'unknown',
                userAgent: 'unknown'
            };

            await PaymentAuditLog.recordPaymentTransactionChange(
                doc,
                'delete',
                actor,
                null,
                'Payment transaction deleted'
            );
        } catch (error) {
            console.error('Failed to create deletion audit log:', error);
        }
    });
};

module.exports = { setupPaymentAuditMiddleware };