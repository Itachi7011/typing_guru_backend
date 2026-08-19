// models/Admin/ExamCalendarEvent.js
//
// Backs the homepage/exam-practice "exam calendar ticker" (Phase 3,
// competitor-parity with TypeTestPro's admit-card/exam-date banner).
//
// DELIBERATELY has no seed data anywhere in this codebase. Government exam
// dates (application windows, admit card release, exam date) are real,
// consequential facts — publishing an invented or stale date here could
// cause a real user to miss a real deadline. Every row must be entered and
// kept current by an admin from the exam body's own official notification.
// The frontend ticker simply renders whatever is active here, and renders
// nothing at all if the collection is empty — it never falls back to
// placeholder/fake dates.

const mongoose = require("mongoose");

const ExamCalendarEventSchema = new mongoose.Schema(
  {
    examId: {
      // Matches the frontend's EXAMS[].id where applicable (e.g. "ssc_chsl"),
      // so the ticker can optionally be filtered per exam-practice page.
      // Free text so it also covers exams not yet in the typing-practice
      // list (e.g. a new recruitment cycle announced before it's added).
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    examName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    eventType: {
      type: String,
      enum: [
        "notification",
        "application-open",
        "application-close",
        "admit-card",
        "exam-date",
        "result",
        "other",
      ],
      required: true,
    },
    eventDate: {
      type: Date,
      required: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 300,
    },
    officialLink: {
      // Link to the exam body's own notification — the source of truth,
      // so users can (and should) verify the date themselves.
      type: String,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // admin user who entered this
    },
  },
  { timestamps: true },
);

ExamCalendarEventSchema.index({ isActive: 1, eventDate: 1 });

module.exports = mongoose.model("ExamCalendarEvent", ExamCalendarEventSchema);
