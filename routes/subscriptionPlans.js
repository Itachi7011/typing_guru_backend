// routes/subscriptionPlans.js
const express = require("express");
const router = express.Router();
const SubscriptionPlan = require("../models/Admin/SubscriptionPlans");
const { body, param, validationResult } = require("express-validator");
const { authenticateAdmin } = require("../middleware/adminAuthentication");

const PDFDocument = require("pdfkit");
const { Parser } = require("json2csv");

/* ================================================================
 * 💳 Subscription Plans Module
 *
 * This file manages logic related to subscription plans and pricing.
 * GET routes can be accessed by clients to view plans and features.
 *
 * All other routes (POST, PUT, DELETE) are restricted to admins only,
 * for creating, updating, or deleting subscription data.
 *
 * Access control is enforced to protect billing and plan details.
 * Middleware checks must be in place to secure admin operations.
 *
 * ================================================================ */

/* authenticateAdmin used to be defined inline here as an exact duplicate
   of the one in routes/admin.js — both have now been consolidated into
   middleware/adminAuthentication.js, imported above, so there's a single
   implementation instead of two copies that could silently drift apart. */


const subscriptionPlanValidation = [
  body("name").notEmpty().trim().withMessage("Plan name is required"),
  body("tier")
    .isIn(["FREE", "BASIC", "PRO", "ENTERPRISE", "CUSTOM"])
    .withMessage("Invalid tier"),
  body("description").notEmpty().trim().withMessage("Description is required"),

  // More flexible price validation
  body("price.monthly")
    .custom((value) => {
      if (value === undefined || value === null) return false;
      // Allow both objects and numbers
      return typeof value === "object" || typeof value === "number";
    })
    .withMessage(
      "Monthly price must be an object with currency keys or a number",
    ),

  body("price.annually")
    .optional()
    .custom((value) => {
      if (value === undefined || value === null) return true; // Optional field
      // Allow both objects and numbers
      return typeof value === "object" || typeof value === "number";
    })
    .withMessage(
      "Annual price must be an object with currency keys or a number",
    ),

  body("price.currency")
    .optional()
    .isLength({ min: 3, max: 3 })
    .withMessage("Currency must be 3 characters"),
];

// Helper function to convert price Maps to plain objects

const convertPlanPricesToObjects = (plan) => {
  if (plan.price && plan.price.monthly instanceof Map) {
    plan.price.monthly = Object.fromEntries(plan.price.monthly);
  }
  if (plan.price && plan.price.annually instanceof Map) {
    plan.price.annually = Object.fromEntries(plan.price.annually);
  }
  return plan;
};

/* ================================================================
 * PHASE 4 ADDITION — this file previously defined authenticateAdmin
 * and subscriptionPlanValidation above but registered ZERO actual
 * routes (the file just exported an empty router). That meant there
 * was no way to list plans or enroll into an institutional seat at
 * all. Only two routes are added here, both scoped tightly to what's
 * needed for the institutional-plan feature:
 *   - GET  /api/subscription-plans           (public, read-only)
 *   - POST /api/subscription-plans/:id/enroll-seat  (seat consumption)
 * A full admin CRUD API (create/update/delete plans) is NOT added in
 * this pass — that would mean exercising `authenticateAdmin` above
 * against a live admin session, which isn't possible in this sandbox
 * (no DB/network access), and shipping untested admin-auth code that
 * touches billing data is exactly the kind of risk worth a manual
 * review first. The validation/auth scaffolding above is left as-is,
 * ready for that follow-up.
 * ================================================================ */

// GET /api/subscription-plans
// Public. Lists active, public plans. Institutional billing details
// (billingContact, taxId, notes, allowedUserEmails) are stripped from
// the response — that's another organization's private billing/roster
// data and must never leak into a public plans listing.
router.get("/", async (req, res) => {
  try {
    const plans = await SubscriptionPlan.find({
      isActive: true,
      isDeleted: { $ne: true },
      isPublic: true,
    }).select(
      "-institutional.billingContact -institutional.taxId -institutional.notes -allowedUserEmails -allowedUsers -invitationCode",
    );

    const sanitized = plans.map((p) => convertPlanPricesToObjects(p.toObject()));
    return res.status(200).json({ success: true, plans: sanitized });
  } catch (err) {
    console.error("Subscription plans list error:", err.message);
    return res
      .status(500)
      .json({ success: false, message: "Could not load subscription plans" });
  }
});

// POST /api/subscription-plans/:id/enroll-seat
// Body: { invitationCode }
// Consumes one seat on an institutional plan, gated by the plan's own
// invitationCode (the field already existed on the schema for
// INVITE_ONLY/SPECIFIC_EMAILS access types — this reuses it rather than
// inventing a parallel mechanism). Returns a clear SEAT_LIMIT_REACHED
// error code so the frontend can show "contact your coaching center
// admin" instead of a generic failure.
router.post(
  "/:id/enroll-seat",
  [body("invitationCode").isString().trim().notEmpty().isLength({ max: 60 })],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res
        .status(400)
        .json({ success: false, message: "Invitation code is required" });
    }

    try {
      const plan = await SubscriptionPlan.findOne({
        _id: req.params.id,
        isActive: true,
        isDeleted: { $ne: true },
      });

      if (!plan) {
        return res
          .status(404)
          .json({ success: false, message: "Plan not found" });
      }

      if (!plan.institutional || !plan.institutional.isInstitutional) {
        return res.status(400).json({
          success: false,
          message: "This plan is not an institutional/seat-based plan",
        });
      }

      if (
        !plan.invitationCode ||
        plan.invitationCode !== req.body.invitationCode.toUpperCase()
      ) {
        return res
          .status(403)
          .json({ success: false, message: "Invalid invitation code" });
      }

      await plan.useSeat();

      return res.status(200).json({
        success: true,
        message: "Seat enrolled successfully",
        seatsUsed: plan.institutional.seatsUsed,
        seatLimit: plan.institutional.seatLimit,
      });
    } catch (err) {
      if (err.code === "SEAT_LIMIT_REACHED") {
        return res.status(409).json({
          success: false,
          code: "SEAT_LIMIT_REACHED",
          message:
            "This institution has used all its licensed seats. Contact your institution admin to request more.",
        });
      }
      console.error("Seat enrollment error:", err.message);
      return res
        .status(500)
        .json({ success: false, message: "Could not enroll seat" });
    }
  },
);

/* ================================================================
 * Admin institutional-plan endpoints (Phase 4 follow-up). Unblocked by
 * the authenticateAdmin extraction above — these were deliberately left
 * out of the original pass because that middleware wasn't reusable yet.
 * Scoped narrowly to what the institutional tier needs (create an
 * institutional plan, adjust its seat limit) rather than full generic
 * plan CRUD, since the existing SubscriptionPlan schema is large and
 * exercising every field blind, without a live session to test against,
 * would be a much bigger risk surface than this feature needs.
 * ================================================================ */

// POST /api/subscription-plans/admin/institutional
// Admin-only. Creates a new institutional/B2B plan. Reuses the same
// SubscriptionPlan model as individual plans — institutional-ness is a
// sub-document (see models/Admin/SubscriptionPlans.js), not a separate
// collection, so this plan is visible everywhere individual plans are.
router.post(
  "/admin/institutional",
  authenticateAdmin,
  [
    body("name").isString().trim().notEmpty().isLength({ max: 100 }),
    body("description").isString().trim().notEmpty(),
    body("organizationName").isString().trim().notEmpty().isLength({ max: 150 }),
    body("organizationType").isIn([
      "COACHING_CENTER",
      "SCHOOL",
      "COLLEGE",
      "GOVT_TRAINING_INSTITUTE",
      "CORPORATE",
      "OTHER",
    ]),
    body("seatLimit").optional({ nullable: true }).isInt({ min: 1 }),
    body("billingContact.name").optional().isString().trim(),
    body("billingContact.email").optional().isEmail(),
    body("billingContact.phone").optional().isString().trim(),
    body("invitationCode").isString().trim().notEmpty().isLength({ max: 60 }),
    body("monthlyPriceINR").isFloat({ min: 0 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid plan data", errors: errors.array() });
    }

    try {
      const plan = await SubscriptionPlan.create({
        name: req.body.name,
        tier: "ENTERPRISE",
        description: req.body.description,
        price: { monthly: new Map([["INR", req.body.monthlyPriceINR]]) },
        accessType: "SPECIFIC_EMAILS",
        invitationCode: req.body.invitationCode.toUpperCase(),
        isPublic: false, // institutional plans aren't shown in the public GET / listing
        isActive: true,
        institutional: {
          isInstitutional: true,
          organizationName: req.body.organizationName,
          organizationType: req.body.organizationType,
          billingContact: req.body.billingContact || {},
          seatLimit: req.body.seatLimit ?? null,
          seatsUsed: 0,
        },
      });

      return res.status(201).json({ success: true, plan });
    } catch (err) {
      console.error("Institutional plan creation error:", err.message);
      return res
        .status(500)
        .json({ success: false, message: "Could not create institutional plan" });
    }
  },
);

// PATCH /api/subscription-plans/admin/:id/seats
// Admin-only. Adjusts an institutional plan's seat limit (e.g. the
// coaching center upgrades from 50 to 100 licenses). Deliberately doesn't
// allow directly setting seatsUsed — that's derived from actual
// enroll-seat calls, not something an admin should hand-edit and risk
// desyncing from reality.
router.patch(
  "/admin/:id/seats",
  authenticateAdmin,
  [
    param("id").isMongoId(),
    body("seatLimit").isInt({ min: 1 }).withMessage("seatLimit must be a positive integer, or omit for unlimited"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: "Invalid seat limit" });
    }

    try {
      const plan = await SubscriptionPlan.findById(req.params.id);
      if (!plan || !plan.institutional || !plan.institutional.isInstitutional) {
        return res
          .status(404)
          .json({ success: false, message: "Institutional plan not found" });
      }

      plan.institutional.seatLimit = req.body.seatLimit;
      await plan.save();

      return res.status(200).json({
        success: true,
        seatLimit: plan.institutional.seatLimit,
        seatsUsed: plan.institutional.seatsUsed,
      });
    } catch (err) {
      console.error("Seat limit update error:", err.message);
      return res
        .status(500)
        .json({ success: false, message: "Could not update seat limit" });
    }
  },
);

module.exports = router;
