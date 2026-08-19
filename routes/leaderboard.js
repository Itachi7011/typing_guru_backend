// routes/leaderboard.js
//
// Phase 3 competitive-parity feature ("compete with thousands nationwide" —
// see COMPETITIVE_ANALYSIS_AND_ROADMAP.md). Deliberately built as an
// *optional* layer: every endpoint degrades gracefully so the frontend's
// existing offline-first design (apiGet/apiPost with local-cache fallback)
// keeps working even if this route, the DB, or auth is unavailable.
//
// NOTE FOR REVIEW: this file follows the same structure/conventions as the
// existing routes/public.js and models/Public/* files. It has been syntax-
// checked (`node --check`) but NOT run against a live MongoDB instance in
// this environment (no DB/network access here) — please smoke-test the
// three endpoints below against your dev DB before deploying.

const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const { body, param, query, validationResult } = require("express-validator");

const User = require("../models/User/Users");
const LeaderboardEntry = require("../models/Public/LeaderboardEntry");

// ── Optional auth: identifies the user if a valid token is present, but
// never blocks the request if it's missing/invalid. Guests can still use
// the typing test — they just can't appear on the leaderboard, matching
// the app's "works without backend/login" philosophy. ──────────────────
async function optionalAuth(req, _res, next) {
  try {
    let token = req.cookies?.accessToken;
    if (!token) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith("Bearer ")) {
        token = authHeader.split(" ")[1];
      }
    }
    if (!token) return next();

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findOne({
      _id: decoded.userId,
      isDeleted: false,
      isActive: true,
    }).select("_id name email");
    if (user) req.user = user;
  } catch {
    // Invalid/expired token — proceed as guest rather than erroring out.
  }
  next();
}

// POST /api/leaderboard/submit
// Body: { examId, examName, language, wpm, accuracy, netWPM?, passed }
// Requires auth (anonymous scores aren't meaningful on a public board).
// Upserts only if this attempt beats the user's stored best for that exam.
router.post(
  "/submit",
  optionalAuth,
  [
    body("examId").isString().trim().notEmpty().isLength({ max: 60 }),
    body("examName").isString().trim().notEmpty().isLength({ max: 120 }),
    body("language").optional().isIn(["english", "hindi"]),
    body("wpm").isFloat({ min: 0, max: 300 }),
    body("accuracy").isFloat({ min: 0, max: 100 }),
    body("netWPM").optional().isFloat({ min: 0, max: 300 }),
    body("passed").optional().isBoolean(),
  ],
  async (req, res) => {
    if (!req.user) {
      // Not an error — the frontend should simply skip calling this for
      // guests. Returning 200 with submitted:false keeps the offline-safe
      // apiPost() helper's "either JSON or null" contract intact.
      return res
        .status(200)
        .json({ success: true, submitted: false, reason: "guest" });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid submission", errors: errors.array() });
    }

    const {
      examId,
      examName,
      language = "english",
      wpm,
      accuracy,
      netWPM = null,
      passed = false,
    } = req.body;

    try {
      const existing = await LeaderboardEntry.findOne({
        user: req.user._id,
        examId,
        language,
      });

      if (existing && existing.wpm >= wpm) {
        // Not a personal best — nothing to update, but not an error either.
        return res.status(200).json({
          success: true,
          submitted: false,
          reason: "not-a-new-best",
          personalBest: existing.wpm,
        });
      }

      const entry = await LeaderboardEntry.findOneAndUpdate(
        { user: req.user._id, examId, language },
        {
          user: req.user._id,
          displayName: req.user.name || "Anonymous Aspirant",
          examId,
          examName,
          language,
          wpm,
          accuracy,
          netWPM,
          passed: !!passed,
          achievedAt: new Date(),
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );

      return res.status(200).json({ success: true, submitted: true, entry });
    } catch (err) {
      console.error("Leaderboard submit error:", err.message);
      return res
        .status(500)
        .json({ success: false, message: "Could not record score" });
    }
  },
);

// GET /api/leaderboard/:examId?language=english&limit=20
// Public — top N scores for a given exam, sorted by WPM desc.
router.get(
  "/:examId",
  [
    param("examId").isString().trim().notEmpty(),
    query("language").optional().isIn(["english", "hindi"]),
    query("limit").optional().isInt({ min: 1, max: 100 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: "Invalid query" });
    }

    const { examId } = req.params;
    const language = req.query.language || "english";
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);

    try {
      const top = await LeaderboardEntry.find({ examId, language })
        .sort({ wpm: -1, accuracy: -1 })
        .limit(limit)
        .select("displayName wpm accuracy netWPM passed achievedAt -_id");

      return res.status(200).json({ success: true, examId, language, top });
    } catch (err) {
      console.error("Leaderboard fetch error:", err.message);
      return res
        .status(500)
        .json({ success: false, message: "Could not load leaderboard" });
    }
  },
);

// GET /api/leaderboard/:examId/rank  (requires auth)
// Returns the current user's rank + score for an exam, without requiring
// them to be in the top N (useful for "You're #482 — here's the top 20").
router.get("/:examId/rank", optionalAuth, async (req, res) => {
  if (!req.user) {
    return res.status(200).json({ success: true, rank: null, reason: "guest" });
  }

  const { examId } = req.params;
  const language = req.query.language || "english";

  try {
    const mine = await LeaderboardEntry.findOne({
      user: req.user._id,
      examId,
      language,
    });
    if (!mine) {
      return res.status(200).json({ success: true, rank: null, reason: "no-attempts" });
    }
    const rank =
      (await LeaderboardEntry.countDocuments({
        examId,
        language,
        wpm: { $gt: mine.wpm },
      })) + 1;

    return res.status(200).json({ success: true, rank, entry: mine });
  } catch (err) {
    console.error("Leaderboard rank error:", err.message);
    return res.status(500).json({ success: false, message: "Could not load rank" });
  }
});

module.exports = router;
