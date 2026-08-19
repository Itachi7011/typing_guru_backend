// models/Public/LeaderboardEntry.js
//
// Stores one "best attempt" document per (user, exam) pair. Deliberately
// NOT one row per attempt — every new submission upserts the row for that
// user+exam only if it improves on the stored best, keeping the collection
// small and queries cheap (no aggregation needed at read time).
//
// This is a periodic/best-score leaderboard, not a real-time multiplayer
// race — matches the architecture note in the competitive analysis doc
// (none of the competitor sites show synchronized live-race behaviour
// either, so this is intentionally the simpler, proven shape).

const mongoose = require("mongoose");

const LeaderboardEntrySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    displayName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 60,
    },
    examId: {
      type: String,
      required: true,
      index: true,
    },
    examName: {
      type: String,
      required: true,
    },
    language: {
      type: String,
      enum: ["english", "hindi"],
      default: "english",
    },
    wpm: {
      type: Number,
      required: true,
      min: 0,
      max: 300, // sanity ceiling — anything above is rejected, not stored
    },
    accuracy: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    netWPM: {
      type: Number, // official-formula net WPM, when available (Phase 3)
      default: null,
    },
    passed: {
      type: Boolean,
      default: false,
    },
    achievedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true },
);

// One best-score row per user per exam+language combination.
LeaderboardEntrySchema.index(
  { user: 1, examId: 1, language: 1 },
  { unique: true },
);

// Fast top-N lookups for a given exam.
LeaderboardEntrySchema.index({ examId: 1, wpm: -1 });

module.exports = mongoose.model("LeaderboardEntry", LeaderboardEntrySchema);
