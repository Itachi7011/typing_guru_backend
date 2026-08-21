// routes/subscription.js
//
// A single low-cost "Pro" tier on top of a free plan, priced separately
// in USD and INR, via Stripe Checkout + the Stripe Billing Portal. See
// README.md ("Subscriptions (Stripe)") for the Stripe Dashboard setup
// this route depends on (Product, two Prices, webhook secret).
//
// Deliberately NOT built on models/Admin/SubscriptionPlans.js — see the
// comment on the `subscription` field in models/User/Users.js for why.

const express = require("express");
const router = express.Router();
const Stripe = require("stripe");
const { authMiddleware } = require("../middleware/userAuthentication");
const User = require("../models/User/Users");

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

// Every deploy needs its own two Stripe Price IDs (one USD, one INR) for
// the single Pro plan — see README.md for how to create them. Kept as
// env vars rather than hardcoded amounts so pricing can be changed from
// the Stripe Dashboard without a code deploy, and so test-mode vs
// live-mode keys naturally use different Prices.
const PRICE_IDS = {
  usd: process.env.STRIPE_PRICE_PRO_USD,
  inr: process.env.STRIPE_PRICE_PRO_INR,
};

const requireStripeConfigured = (req, res, next) => {
  if (!stripe) {
    return res.status(503).json({
      success: false,
      message: "Payments are not configured on this server.",
    });
  }
  next();
};

// @route   GET /api/subscription/plans
// @desc    Public plan catalog — deliberately hardcoded (not admin-
//          editable) since there is exactly one paid tier by design;
//          amounts shown here are display copy only, the Stripe Price
//          objects (env-configured above) are the actual source of
//          truth charged at checkout.
// @access  Public
router.get("/plans", (req, res) => {
  res.json({
    success: true,
    plans: [
      {
        id: "free",
        name: "Free",
        price: { usd: 0, inr: 0 },
        interval: null,
        features: [
          "Unlimited typing practice tests",
          "Basic accuracy & speed stats",
          "Exam calendar access",
          "Daily challenge",
        ],
      },
      {
        id: "pro",
        name: "Pro",
        // Display-only figures — deliberately kept low since this is
        // built for govt.-job aspirants, not a general SaaS audience.
        // The actual charge amount lives in the Stripe Price objects
        // referenced by STRIPE_PRICE_PRO_USD / STRIPE_PRICE_PRO_INR;
        // update both places together if the price ever changes.
        price: { usd: 2.99, inr: 149 },
        interval: "month",
        features: [
          "Everything in Free",
          "Advanced analytics & progress charts",
          "Personalized training plan",
          "Priority exam-calendar notifications",
          "Ad-free experience",
        ],
      },
    ],
  });
});

// @route   GET /api/subscription/status
// @desc    Current user's subscription state
// @access  Private
router.get("/status", authMiddleware, (req, res) => {
  res.json({
    success: true,
    subscription: req.user.subscription || { plan: "free", status: "inactive" },
  });
});

// @route   POST /api/subscription/create-checkout-session
// @desc    Start a Stripe Checkout session for the Pro plan
// @body    { currency: "usd" | "inr" }
// @access  Private
router.post(
  "/create-checkout-session",
  authMiddleware,
  requireStripeConfigured,
  async (req, res) => {
    try {
      const currency = req.body?.currency === "inr" ? "inr" : "usd";
      const priceId = PRICE_IDS[currency];

      if (!priceId) {
        return res.status(503).json({
          success: false,
          message: `Pricing for ${currency.toUpperCase()} is not configured on this server.`,
        });
      }

      if (req.user.subscription?.plan === "pro" && req.user.subscription?.status === "active") {
        return res.status(400).json({
          success: false,
          message: "You already have an active Pro subscription.",
        });
      }

      // Reuse an existing Stripe customer for this user if one already
      // exists (from a prior, possibly-canceled subscription) instead of
      // creating a duplicate customer record every time they resubscribe.
      let customerId = req.user.subscription?.stripeCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: req.user.email,
          name: req.user.name,
          metadata: { userId: String(req.user._id) },
        });
        customerId = customer.id;
        await User.updateOne(
          { _id: req.user._id },
          { $set: { "subscription.stripeCustomerId": customerId } },
        );
      }

      const frontendUrl =
        process.env.NODE_ENV === "development"
          ? process.env.DEVELOPMENT_BASE_FRONTEND_URL || "http://localhost:5173"
          : process.env.PRODUCTION_BASE_FRONTEND_URL || process.env.CLIENT_URL;

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer: customerId,
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${frontendUrl}/user/subscription?checkout=success`,
        cancel_url: `${frontendUrl}/user/subscription?checkout=cancelled`,
        // Ties the session back to this user even before any webhook
        // fires, and lets the webhook handler below resolve the correct
        // user without a DB lookup by email (emails can theoretically
        // change; the userId in metadata can't drift).
        client_reference_id: String(req.user._id),
        subscription_data: {
          metadata: { userId: String(req.user._id) },
        },
      });

      res.json({ success: true, url: session.url });
    } catch (error) {
      console.error("create-checkout-session error:", error.message);
      res.status(500).json({ success: false, message: "Could not start checkout." });
    }
  },
);

// @route   POST /api/subscription/create-portal-session
// @desc    Stripe Billing Portal — lets a user update payment method,
//          view invoices, or cancel, without building any of that UI.
// @access  Private
router.post(
  "/create-portal-session",
  authMiddleware,
  requireStripeConfigured,
  async (req, res) => {
    try {
      const customerId = req.user.subscription?.stripeCustomerId;
      if (!customerId) {
        return res.status(400).json({
          success: false,
          message: "No billing account found for this user yet.",
        });
      }

      const frontendUrl =
        process.env.NODE_ENV === "development"
          ? process.env.DEVELOPMENT_BASE_FRONTEND_URL || "http://localhost:5173"
          : process.env.PRODUCTION_BASE_FRONTEND_URL || process.env.CLIENT_URL;

      const portalSession = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${frontendUrl}/user/subscription`,
      });

      res.json({ success: true, url: portalSession.url });
    } catch (error) {
      console.error("create-portal-session error:", error.message);
      res.status(500).json({ success: false, message: "Could not open billing portal." });
    }
  },
);

// @route   POST /api/subscription/webhook
// @desc    Stripe webhook receiver. MUST receive the raw request body
//          (see app.js — this route is wired up with
//          express.raw({type:'application/json'}) BEFORE the global
//          express.json() parser, since Stripe's signature verification
//          needs the exact bytes Stripe sent, not a re-serialized JSON
//          object).
// @access  Public (authenticated via Stripe-Signature header instead of
//          a user session — this is a server-to-server callback from
//          Stripe, not a browser request)
const handleWebhook = async (req, res) => {
  if (!stripe) return res.status(503).send("Stripe not configured");

  const signature = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (error) {
    console.error("Stripe webhook signature verification failed:", error.message);
    return res.status(400).send(`Webhook Error: ${error.message}`);
  }

  try {
    switch (event.type) {
      // Checkout completed — the subscription now exists in Stripe, but
      // subscribe the fuller status fields (currentPeriodEnd etc.) get
      // filled in by the customer.subscription.* events below, which
      // Stripe also fires around the same time. This event is mainly
      // useful for tying the new stripeSubscriptionId back to the user
      // via client_reference_id.
      case "checkout.session.completed": {
        const session = event.data.object;
        const userId = session.client_reference_id;
        if (userId) {
          await User.updateOne(
            { _id: userId },
            {
              $set: {
                "subscription.plan": "pro",
                "subscription.stripeSubscriptionId": session.subscription,
                "subscription.stripeCustomerId": session.customer,
              },
            },
          );
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object;
        const userId = sub.metadata?.userId;
        const filter = userId ? { _id: userId } : { "subscription.stripeSubscriptionId": sub.id };

        // A subscription counts as the paid "pro" plan only while
        // Stripe considers it active/trialing; any other status (e.g.
        // past_due, canceled, unpaid) should NOT keep advanced features
        // unlocked, so `plan` is derived from `status` rather than set
        // unconditionally to "pro" here.
        const isEntitled = ["active", "trialing"].includes(sub.status);

        await User.updateOne(filter, {
          $set: {
            "subscription.plan": isEntitled ? "pro" : "free",
            "subscription.status": sub.status,
            "subscription.stripeSubscriptionId": sub.id,
            "subscription.stripePriceId": sub.items?.data?.[0]?.price?.id,
            "subscription.currency": sub.currency,
            "subscription.currentPeriodEnd": sub.current_period_end
              ? new Date(sub.current_period_end * 1000)
              : null,
            "subscription.cancelAtPeriodEnd": !!sub.cancel_at_period_end,
          },
        });
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object;
        const userId = sub.metadata?.userId;
        const filter = userId ? { _id: userId } : { "subscription.stripeSubscriptionId": sub.id };

        await User.updateOne(filter, {
          $set: {
            "subscription.plan": "free",
            "subscription.status": "canceled",
            "subscription.cancelAtPeriodEnd": false,
          },
        });
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object;
        const customerId = invoice.customer;
        // Don't immediately revoke access on a single failed payment —
        // Stripe's own retry schedule (Smart Retries) will keep trying,
        // and `customer.subscription.updated` will fire with
        // status "past_due"/"unpaid" if it keeps failing, which the
        // handler above already reacts to. Logged for visibility only.
        console.warn("Stripe invoice payment failed for customer:", customerId);
        break;
      }

      default:
        // Unhandled event types are expected and fine to ignore — Stripe
        // sends many more event types than this app needs to react to.
        break;
    }

    res.json({ received: true });
  } catch (error) {
    console.error("Stripe webhook handler error:", error.message);
    // Respond 200 anyway once signature verification has already
    // succeeded above: a 5xx here would make Stripe retry the same
    // event repeatedly, but the failure is in this app's own DB write,
    // not something a retry of the *same* payload is likely to fix.
    // The error is logged for manual follow-up instead.
    res.json({ received: true, warning: "processing error, see server logs" });
  }
};

module.exports = { router, handleWebhook };
