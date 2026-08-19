// routes/examCalendar.js
//
// Backs the "exam calendar ticker" (Phase 3). Originally shipped read-only
// (public GET) because the admin-auth logic needed for write access lived
// as an inline, non-reusable function inside routes/admin.js. That logic
// has since been extracted to middleware/adminAuthentication.js (see that
// file's header), which unblocks the admin write endpoints added below.
//
// NOTE FOR REVIEW: the GET endpoint was verified in the original pass
// (module loads cleanly, schema registers). The new POST/PATCH endpoints
// below are syntax-checked and require()-loaded successfully with the
// real authenticateAdmin middleware, but — same caveat as before — have
// NOT been exercised against a live admin session/DB in this sandbox.
// Please smoke-test create/deactivate against your dev environment.

const express = require("express");
const router = express.Router();
const { body, param, query, validationResult } = require("express-validator");
const { authenticateAdmin } = require("../middleware/adminAuthentication");

const ExamCalendarEvent = require("../models/Admin/ExamCalendarEvent");

// GET /api/exam-calendar?examId=ssc_chsl&limit=10
// Public. Returns only active, still-upcoming-or-recent events, soonest
// first. Returns an empty array (never fake/placeholder data) if nothing
// has been entered by an admin yet — the frontend ticker renders nothing
// in that case rather than showing a misleading empty state.
router.get(
  "/",
  [
    query("examId").optional().isString().trim(),
    query("limit").optional().isInt({ min: 1, max: 50 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: "Invalid query" });
    }

    const { examId } = req.query;
    const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);

    // Show events from 3 days in the past (so a same-day deadline doesn't
    // vanish from the ticker at midnight) onward.
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 3);

    const filter = { isActive: true, eventDate: { $gte: cutoff } };
    if (examId) filter.examId = examId;

    try {
      const events = await ExamCalendarEvent.find(filter)
        .sort({ eventDate: 1 })
        .limit(limit)
        .select("examId examName eventType eventDate description officialLink -_id");

      return res.status(200).json({ success: true, events });
    } catch (err) {
      console.error("Exam calendar fetch error:", err.message);
      return res
        .status(500)
        .json({ success: false, message: "Could not load exam calendar" });
    }
  },
);

// GET /api/exam-calendar/admin/all
// Admin-only. Unlike the public GET above, this returns every event
// (including inactive/past ones) so an admin dashboard can list, edit, or
// reactivate anything, not just what's currently shown on the ticker.
router.get("/admin/all", authenticateAdmin, async (req, res) => {
  try {
    const events = await ExamCalendarEvent.find({})
      .sort({ eventDate: -1 })
      .limit(200);
    return res.status(200).json({ success: true, events });
  } catch (err) {
    console.error("Exam calendar admin list error:", err.message);
    return res
      .status(500)
      .json({ success: false, message: "Could not load exam calendar events" });
  }
});

// POST /api/exam-calendar
// Admin-only. Creates a new calendar event. This is the actual data-entry
// path a real admin uses to publish a verified date from an exam body's
// official notification — see models/Admin/ExamCalendarEvent.js for why
// no dates are ever seeded/fabricated anywhere else in this codebase.
router.post(
  "/",
  authenticateAdmin,
  [
    body("examId").isString().trim().notEmpty().isLength({ max: 60 }),
    body("examName").isString().trim().notEmpty().isLength({ max: 120 }),
    body("eventType").isIn([
      "notification",
      "application-open",
      "application-close",
      "admit-card",
      "exam-date",
      "result",
      "other",
    ]),
    body("eventDate").isISO8601().toDate(),
    body("description").optional().isString().trim().isLength({ max: 300 }),
    body("officialLink").optional().isURL(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid event data", errors: errors.array() });
    }

    try {
      const event = await ExamCalendarEvent.create({
        examId: req.body.examId,
        examName: req.body.examName,
        eventType: req.body.eventType,
        eventDate: req.body.eventDate,
        description: req.body.description,
        officialLink: req.body.officialLink,
        isActive: true,
        createdBy: req.admin._id,
      });

      return res.status(201).json({ success: true, event });
    } catch (err) {
      console.error("Exam calendar create error:", err.message);
      return res
        .status(500)
        .json({ success: false, message: "Could not create exam calendar event" });
    }
  },
);

// PATCH /api/exam-calendar/:id
// Admin-only. Partial update — most commonly used to deactivate a stale/
// incorrect event (isActive: false) rather than hard-deleting it, so
// there's an audit trail of what was published and when it was retracted.
router.patch(
  "/:id",
  authenticateAdmin,
  [
    param("id").isMongoId(),
    body("eventDate").optional().isISO8601().toDate(),
    body("description").optional().isString().trim().isLength({ max: 300 }),
    body("officialLink").optional().isURL(),
    body("isActive").optional().isBoolean(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: "Invalid update" });
    }

    try {
      const allowedFields = ["eventDate", "description", "officialLink", "isActive"];
      const updates = {};
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) updates[field] = req.body[field];
      }

      const event = await ExamCalendarEvent.findByIdAndUpdate(req.params.id, updates, {
        new: true,
        runValidators: true,
      });

      if (!event) {
        return res.status(404).json({ success: false, message: "Event not found" });
      }

      return res.status(200).json({ success: true, event });
    } catch (err) {
      console.error("Exam calendar update error:", err.message);
      return res
        .status(500)
        .json({ success: false, message: "Could not update exam calendar event" });
    }
  },
);

module.exports = router;
