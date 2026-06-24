const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const multer = require("multer");
const { authMiddleware } = require("../middleware/userAuthentication"); // adjust path as needed
const User = require("../models/User/Users"); // adjust path as needed
 
/* ════════════════════════════════════════════════════════════ 
   Multer setup for avatar uploads (memory storage — we store
   the image as base64 in MongoDB per the schema's avatar field:
   { data, publicId, format, originalName, contentType })
   ════════════════════════════════════════════════════════════ */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 }, // 4MB
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files are allowed"));
    }
    cb(null, true);
  },
});  
 
/* ════════════════════════════════════════════════════════════
   GET /me
   Returns the logged-in user's public profile + typing stats.
   ════════════════════════════════════════════════════════════ */
router.get("/me", authMiddleware, async (req, res) => {
  try {
    // console.log("it hitted")
    const userData = req.user.getPublicProfile();
    const typingStats = req.user.getTypingStats();
 
    return res.status(200).json({
      success: true,
      user: userData,
      stats: typingStats,
    });
  } catch (error) {
    console.error("Get profile error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch profile",
    });
  }
});

/* ════════════════════════════════════════════════════════════
   POST /change-name
   Body: { name: string }
   ════════════════════════════════════════════════════════════ */
router.post("/change-name", authMiddleware, async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Name is required",
      });
    }

    const trimmed = name.trim();

    if (trimmed.length < 2 || trimmed.length > 40) {
      return res.status(400).json({
        success: false,
        message: "Name must be between 2 and 40 characters",
      });
    }

    req.user.name = trimmed;
    await req.user.save();

    return res.status(200).json({
      success: true,
      message: "Name updated successfully",
      user: req.user.getPublicProfile(),
    });
  } catch (error) {
    console.error("Change name error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update name",
    });
  }
});

/* ════════════════════════════════════════════════════════════
   POST /change-phone
   Body: { phone: string }
   ════════════════════════════════════════════════════════════ */
router.post("/change-phone", authMiddleware, async (req, res) => {
  try {
    const { phone } = req.body;

    // Allow clearing the phone number with an empty string
    const cleaned = typeof phone === "string" ? phone.trim() : "";

    if (cleaned && !/^[+]?[\d\s()-]{6,20}$/.test(cleaned)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid phone number",
      });
    }

    // Check uniqueness if phone numbers must be unique (sparse index)
    if (cleaned) {
      const existing = await User.findOne({
        phone: cleaned,
        _id: { $ne: req.user._id },
        isDeleted: false,
      });
      if (existing) {
        return res.status(409).json({
          success: false,
          message: "This phone number is already in use",
        });
      }
    }

    req.user.phone = cleaned || undefined;
    await req.user.save();

    return res.status(200).json({
      success: true,
      message: "Phone number updated successfully",
      user: req.user.getPublicProfile(),
    });
  } catch (error) {
    console.error("Change phone error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update phone number",
    });
  }
});

/* ════════════════════════════════════════════════════════════
   POST /change-avatar
   multipart/form-data, field name: "avatar"
   Stores image as base64 data URL in user.avatar.data
   ════════════════════════════════════════════════════════════ */
router.post(
  "/change-avatar",
  authMiddleware,
  (req, res, next) => {
    upload.single("avatar")(req, res, (err) => {
      if (err) {
        return res.status(400).json({
          success: false,
          message:
            err.code === "LIMIT_FILE_SIZE"
              ? "Avatar must be under 4MB"
              : err.message || "Failed to process image",
        });
      }
      next();
    });
  },
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "No image file provided",
        });
      }

      const base64 = req.file.buffer.toString("base64");
      const dataUrl = `data:${req.file.mimetype};base64,${base64}`;
      const format = (req.file.mimetype.split("/")[1] || "").toLowerCase();

      req.user.avatar = {
        data: dataUrl,
        publicId: undefined,
        format,
        originalName: req.file.originalname,
        contentType: req.file.mimetype,
      };

      await req.user.save();

      return res.status(200).json({
        success: true,
        message: "Avatar updated successfully",
        avatar: req.user.avatar,
        user: req.user.getPublicProfile(),
      });
    } catch (error) {
      console.error("Change avatar error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to update avatar",
      });
    }
  },
);

/* ════════════════════════════════════════════════════════════
   POST /change-preferences
   Body: { preferences: { ui, typing, communication } }
   Only known sub-objects/keys are merged in — arbitrary keys
   are ignored to keep the schema clean.
   ════════════════════════════════════════════════════════════ */
const ALLOWED_PREF_KEYS = {
  ui: ["theme", "language", "soundEffects", "keyboardSound", "showLiveWpm"],
  typing: [
    "fontSize",
    "fontFamily",
    "showKeyboard",
    "highlightErrors",
    "practiceMode",
  ],
  communication: [
    "marketingEmails",
    "securityAlerts",
    "productUpdates",
    "dailyReminders",
    "challengeReminders",
  ],
};

const PREF_VALIDATORS = {
  "ui.theme": (v) => ["light", "dark", "auto"].includes(v),
  "typing.fontSize": (v) => typeof v === "number" && v >= 10 && v <= 32,
  "typing.practiceMode": (v) => ["timed", "words", "custom"].includes(v),
};

router.post("/change-preferences", authMiddleware, async (req, res) => {
  try {
    const { preferences } = req.body;

    if (!preferences || typeof preferences !== "object") {
      return res.status(400).json({
        success: false,
        message: "Preferences object is required",
      });
    }

    if (!req.user.preferences) {
      req.user.preferences = {};
    }

    for (const section of Object.keys(ALLOWED_PREF_KEYS)) {
      const incoming = preferences[section];
      if (!incoming || typeof incoming !== "object") continue;

      if (!req.user.preferences[section]) {
        req.user.preferences[section] = {};
      }

      for (const key of ALLOWED_PREF_KEYS[section]) {
        if (!(key in incoming)) continue;

        const validatorKey = `${section}.${key}`;
        const value = incoming[key];

        if (
          PREF_VALIDATORS[validatorKey] &&
          !PREF_VALIDATORS[validatorKey](value)
        ) {
          return res.status(400).json({
            success: false,
            message: `Invalid value for ${validatorKey}`,
          });
        }

        req.user.preferences[section][key] = value;
      }
    }

    req.user.markModified("preferences");
    await req.user.save();

    return res.status(200).json({
      success: true,
      message: "Preferences updated successfully",
      preferences: req.user.preferences,
    });
  } catch (error) {
    console.error("Change preferences error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update preferences",
    });
  }
});

/* ════════════════════════════════════════════════════════════
   POST /change-password
   Body: { currentPassword, newPassword }
   ════════════════════════════════════════════════════════════ */
router.post("/change-password", authMiddleware, async (req, res) => { 
  try { 
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) { 
      return res.status(400).json({ 
        success: false, 
        message: "Current and new password are required", 
      }); 
    } 
 
    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 8 characters",
      });
    }

    // Need the password hash to compare — req.user may have been
    // fetched without select('+password') depending on schema
    // defaults, so re-fetch with password included.
    const userWithPassword = await User.findById(req.user._id).select(
      "+password",
    );

    const isMatch = await userWithPassword.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    // Prevent reusing the current password
    const sameAsCurrent = await userWithPassword.comparePassword(newPassword);
    if (sameAsCurrent) {
      return res.status(400).json({
        success: false,
        message: "New password must be different from your current password",
      });
    }

    // Optional: check against password history
    if (userWithPassword.passwordHistory?.length) {
      for (const entry of userWithPassword.passwordHistory) {
        const reused = await bcrypt.compare(newPassword, entry.password);
        if (reused) {
          return res.status(400).json({
            success: false,
            message: "You've used this password before. Choose a new one.",
          });
        }
      }
    }

    userWithPassword.password = newPassword; // pre-save hook hashes it
    await userWithPassword.save();

    return res.status(200).json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error("Change password error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to change password",
    });
  }
});

/* ════════════════════════════════════════════════════════════
   POST /sync-local-data
   Body: { localData: object }
   Syncs local storage typing data to user's database profile
   ════════════════════════════════════════════════════════════ */
router.post("/sync-local-data", authMiddleware, async (req, res) => {
  try {
    const { localData } = req.body;

    if (!localData || typeof localData !== "object") {
      return res.status(400).json({
        success: false,
        message: "Local data is required",
      });
    }

    const user = req.user;
    let syncedFields = [];

    // Sync testHistory
    if (
      localData.testHistory &&
      Array.isArray(localData.testHistory) &&
      localData.testHistory.length > 0
    ) {
      const existingDates = new Set(
        user.testHistory.map((t) => new Date(t.date).toISOString()),
      );
      const newTests = localData.testHistory.filter(
        (t) => !existingDates.has(new Date(t.date).toISOString()),
      );

      if (newTests.length > 0) {
        user.testHistory.push(...newTests);
        if (user.testHistory.length > 100) {
          user.testHistory = user.testHistory.slice(-100);
        }
        syncedFields.push("testHistory");
      }
    }

    // Sync totalTests
    if (localData.totalTests && localData.totalTests > user.totalTests) {
      user.totalTests = localData.totalTests;
      syncedFields.push("totalTests");
    }

    // Sync totalWords
    if (localData.totalWords && localData.totalWords > user.totalWords) {
      user.totalWords = localData.totalWords;
      syncedFields.push("totalWords");
    }

    // Sync totalTime
    if (localData.totalTime && localData.totalTime > user.totalTime) {
      user.totalTime = localData.totalTime;
      syncedFields.push("totalTime");
    }

    // Sync bestWPM
    if (localData.bestWPM && localData.bestWPM > user.bestWPM) {
      user.bestWPM = localData.bestWPM;
      syncedFields.push("bestWPM");
    }

    // Sync bestAccuracy
    if (localData.bestAccuracy && localData.bestAccuracy > user.bestAccuracy) {
      user.bestAccuracy = localData.bestAccuracy;
      syncedFields.push("bestAccuracy");
    }

    // Sync XP and level
    if (localData.xp && localData.xp > user.xp) {
      user.xp = localData.xp;
      syncedFields.push("xp");

      let newLevel = user.level;
      let requiredXp = user.calculateRequiredXp(newLevel + 1);
      while (user.xp >= requiredXp) {
        newLevel++;
        requiredXp = user.calculateRequiredXp(newLevel + 1);
      }
      if (newLevel > user.level) {
        user.level = newLevel;
        syncedFields.push("level");
      }
    }

    // Sync points
    if (localData.points && localData.points > user.points) {
      user.points = localData.points;
      syncedFields.push("points");
    }

    // Sync streak
    if (localData.streak) {
      if (localData.streak.current > user.streak.current) {
        user.streak.current = localData.streak.current;
        syncedFields.push("streak.current");
      }
      if (localData.streak.longest > user.streak.longest) {
        user.streak.longest = localData.streak.longest;
        syncedFields.push("streak.longest");
      }
      if (
        localData.streak.lastDate &&
        (!user.streak.lastDate ||
          new Date(localData.streak.lastDate) > user.streak.lastDate)
      ) {
        user.streak.lastDate = new Date(localData.streak.lastDate);
        syncedFields.push("streak.lastDate");
      }
    }

    // FIXED: Sync badges - properly format them for MongoDB
    if (
      localData.badges &&
      Array.isArray(localData.badges) &&
      localData.badges.length > 0
    ) {
      const existingBadgeNames = new Set(user.badges.map((b) => b.name));

      // Filter out badges that already exist and format them properly
      const newBadges = localData.badges
        .filter((b) => b && b.name && !existingBadgeNames.has(b.name))
        .map((b) => ({
          name: b.name,
          earnedAt: b.earnedAt ? new Date(b.earnedAt) : new Date(),
          icon: b.icon || null,
          description: b.description || `Earned ${b.name} badge`,
        }));

      if (newBadges.length > 0) {
        user.badges.push(...newBadges);
        syncedFields.push("badges");
      }
    }

    // Sync stats
    if (localData.stats) {
      if (localData.stats.allTime) {
        const allTime = user.stats.allTime;
        const localAllTime = localData.stats.allTime;

        if (localAllTime.avgWpm > allTime.avgWpm) {
          allTime.avgWpm = localAllTime.avgWpm;
          syncedFields.push("stats.allTime.avgWpm");
        }
        if (localAllTime.bestWpm > allTime.bestWpm) {
          allTime.bestWpm = localAllTime.bestWpm;
          syncedFields.push("stats.allTime.bestWpm");
        }
        if (localAllTime.avgAccuracy > allTime.avgAccuracy) {
          allTime.avgAccuracy = localAllTime.avgAccuracy;
          syncedFields.push("stats.allTime.avgAccuracy");
        }
        if (localAllTime.bestAccuracy > allTime.bestAccuracy) {
          allTime.bestAccuracy = localAllTime.bestAccuracy;
          syncedFields.push("stats.allTime.bestAccuracy");
        }
        if (localAllTime.totalTests > allTime.totalTests) {
          allTime.totalTests = localAllTime.totalTests;
          syncedFields.push("stats.allTime.totalTests");
        }
        if (localAllTime.totalTimeTyped > allTime.totalTimeTyped) {
          allTime.totalTimeTyped = localAllTime.totalTimeTyped;
          syncedFields.push("stats.allTime.totalTimeTyped");
        }
        if (localAllTime.consistency > allTime.consistency) {
          allTime.consistency = localAllTime.consistency;
          syncedFields.push("stats.allTime.consistency");
        }
      }
    }

    // Sync preferences
    if (localData.preferences && typeof localData.preferences === "object") {
      const prefs = user.preferences || {};

      if (localData.preferences.ui) {
        prefs.ui = { ...prefs.ui, ...localData.preferences.ui };
        syncedFields.push("preferences.ui");
      }
      if (localData.preferences.typing) {
        prefs.typing = { ...prefs.typing, ...localData.preferences.typing };
        syncedFields.push("preferences.typing");
      }
      if (localData.preferences.communication) {
        prefs.communication = {
          ...prefs.communication,
          ...localData.preferences.communication,
        };
        syncedFields.push("preferences.communication");
      }

      user.preferences = prefs;
    }

    await user.save();

    return res.status(200).json({
      success: true,
      message: `Successfully synced ${syncedFields.length} fields from local data`,
      syncedFields,
      user: user.getPublicProfile(),
    });
  } catch (error) {
    console.error("Sync local data error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to sync local data",
      error: error.message,
    });
  }
});

/* ════════════════════════════════════════════════════════════
   POST /reset-stats
   Body: { statsToReset: array } 
   Resets specific user statistics
   ════════════════════════════════════════════════════════════ */
router.post("/reset-stats", authMiddleware, async (req, res) => {
  try {
    const { statsToReset } = req.body;
    const user = req.user;
    const resetFields = [];

    // Available stats to reset
    const resetOptions = {
      typingStats: () => {
        user.totalTests = 0;
        user.totalWords = 0;
        user.totalTime = 0;
        user.totalCharacters = 0;
        user.totalErrors = 0;
        user.bestWPM = 0;
        user.bestAccuracy = 0;
        user.testHistory = [];
        user.stats = {
          daily: [],
          weekly: [],
          monthly: [],
          allTime: {
            avgWpm: 0,
            bestWpm: 0,
            avgAccuracy: 0,
            bestAccuracy: 0,
            totalTests: 0,
            totalTimeTyped: 0,
            consistency: 0,
          },
        };
        resetFields.push("typingStats");
      },
      gamification: () => {
        user.xp = 0;
        user.level = 1;
        user.points = 0;
        user.streak = { current: 0, longest: 0, lastDate: null };
        user.levelConfig = {
          currentXpNeeded: 100,
          totalXpEarned: 0,
          prestige: 0,
        };
        resetFields.push("gamification");
      },
      badges: () => {
        user.badges = user.badges.filter((b) => b.name === "Newbie");
        resetFields.push("badges");
      },
      examHistory: () => {
        user.examHistory = [];
        resetFields.push("examHistory");
      },
      gameStats: () => {
        user.games = {
          typingRush: { highScore: 0, gamesPlayed: 0, totalScore: 0 },
          wordHunter: { highScore: 0, gamesPlayed: 0, totalScore: 0 },
          speedTracer: { bestTime: 0, gamesPlayed: 0, averageTime: 0 },
        };
        resetFields.push("gameStats");
      },
      drillProgress: () => {
        user.drills = {
          basicKeys: { completed: false, score: 0 },
          homeRow: { completed: false, score: 0 },
          topRow: { completed: false, score: 0 },
          bottomRow: { completed: false, score: 0 },
          numbers: { completed: false, score: 0 },
          symbols: { completed: false, score: 0 },
          customDrills: [],
        };
        resetFields.push("drillProgress");
      },
    };

    for (const stat of statsToReset) {
      if (resetOptions[stat]) {
        resetOptions[stat]();
      }
    }

    await user.save();

    return res.status(200).json({
      success: true,
      message: `Successfully reset: ${resetFields.join(", ")}`,
      resetFields,
    });
  } catch (error) {
    console.error("Reset stats error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to reset stats",
    });
  }
});

/* ════════════════════════════════════════════════════════════
   POST /deactivate-account
   Soft deletes user account (sets isDeleted=true and isActive=false)
   ════════════════════════════════════════════════════════════ */
router.post("/deactivate-account", authMiddleware, async (req, res) => {
  try {
    const user = req.user;

    if (user.isDeleted) {
      return res.status(400).json({
        success: false,
        message: "Account is already deactivated",
      });
    }

    user.isDeleted = true;
    user.isActive = false;
    user.deletedAt = new Date();

    // Revoke all tokens
    if (user.tokens) {
      user.tokens.forEach((token) => {
        token.isRevoked = true;
      });
    }

    await user.save();

    return res.status(200).json({
      success: true,
      message:
        "Account deactivated successfully. You have 30 days to reactivate before permanent deletion.",
      deletedAt: user.deletedAt,
    });
  } catch (error) {
    console.error("Deactivate account error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to deactivate account",
    });
  }
});

/* ════════════════════════════════════════════════════════════
   POST /reactivate-account
   Reactivates a soft-deleted account
   ════════════════════════════════════════════════════════════ */
router.post("/reactivate-account", authMiddleware, async (req, res) => {
  try {
    const user = req.user;

    if (!user.isDeleted) {
      return res.status(400).json({
        success: false,
        message: "Account is already active",
      });
    }

    const daysDeleted = Math.floor(
      (Date.now() - new Date(user.deletedAt)) / (1000 * 60 * 60 * 24),
    );

    if (daysDeleted > 30) {
      return res.status(400).json({
        success: false,
        message:
          "Account has been permanently deleted and cannot be reactivated",
      });
    }

    user.isDeleted = false;
    user.isActive = true;
    user.deletedAt = null;

    await user.save();

    return res.status(200).json({
      success: true,
      message: "Account reactivated successfully. Welcome back!",
    });
  } catch (error) {
    console.error("Reactivate account error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to reactivate account",
    });
  }
});

/* ════════════════════════════════════════════════════════════
   GET /export-data
   Exports all user data in JSON/CSV format
   ════════════════════════════════════════════════════════════ */
router.get("/export-data", authMiddleware, async (req, res) => {
  try {
    const { format = "json" } = req.query;
    const user = req.user;

    // Prepare export data
    const exportData = {
      exportDate: new Date().toISOString(),
      userInfo: {
        name: user.name,
        email: user.email,
        phone: user.phone,
        usertype: user.usertype,
        memberSince: user.createdAt,
        emailVerified: user.emailVerified,
        phoneVerified: user.phoneVerified,
      },
      typingStats: {
        totalTests: user.totalTests,
        totalWords: user.totalWords,
        totalTime: user.totalTime,
        totalCharacters: user.totalCharacters,
        bestWPM: user.bestWPM,
        bestAccuracy: user.bestAccuracy,
        xp: user.xp,
        level: user.level,
        points: user.points,
        streak: user.streak,
      },
      testHistory: user.testHistory,
      badges: user.badges,
      achievements: user.achievements,
      examHistory: user.examHistory,
      games: user.games,
      drills: user.drills,
      preferences: user.preferences,
      stats: user.stats,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    if (format === "csv") {
      // Convert to CSV
      const flattenObject = (obj, prefix = "") => {
        const result = {};
        for (const key in obj) {
          const value = obj[key];
          const newKey = prefix ? `${prefix}.${key}` : key;
          if (value && typeof value === "object" && !Array.isArray(value)) {
            Object.assign(result, flattenObject(value, newKey));
          } else {
            result[newKey] = Array.isArray(value)
              ? JSON.stringify(value)
              : value;
          }
        }
        return result;
      };

      const flatData = flattenObject(exportData);
      const headers = Object.keys(flatData);
      const csvRows = [headers.join(",")];
      const values = headers.map((header) => {
        const value = flatData[header] || "";
        return `"${String(value).replace(/"/g, '""')}"`;
      });
      csvRows.push(values.join(","));

      const csv = csvRows.join("\n");

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=user_data_${user._id}.csv`,
      );
      return res.send(csv);
    } else {
      // Default to JSON
      res.setHeader("Content-Type", "application/json");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=user_data_${user._id}.json`,
      );
      return res.json(exportData);
    }
  } catch (error) {
    console.error("Export data error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to export data",
    });
  }
});

/* ════════════════════════════════════════════════════════════
   POST /clear-history
   Clears test history while keeping stats
   ════════════════════════════════════════════════════════════ */
router.post("/clear-history", authMiddleware, async (req, res) => {
  try {
    const user = req.user;
    user.testHistory = [];
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Test history cleared successfully",
    });
  } catch (error) {
    console.error("Clear history error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to clear history",
    });
  }
});

// Add to your UserProfileRoutes.js

/* ════════════════════════════════════════════════════════════
   GET /user-data
   Fetches complete user data for logged-in users
   ════════════════════════════════════════════════════════════ */
router.get("/user-data", authMiddleware, async (req, res) => {
  try {
    console.log("it hitted")
    const user = req.user;

    const userData = {
      userId: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      usertype: user.usertype,
      xp: user.xp,
      level: user.level,
      points: user.points,
      badges: user.badges,
      streak: user.streak,
      bestWPM: user.bestWPM,
      bestAccuracy: user.bestAccuracy,
      totalTests: user.totalTests,
      totalWords: user.totalWords,
      totalTime: user.totalTime,
      totalCharacters: user.totalCharacters,
      totalErrors: user.totalErrors,
      achievements: user.achievements,
      testHistory: user.testHistory,
      stats: user.stats,
      preferences: user.preferences,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    return res.status(200).json({
      success: true,
      userData,
    });
  } catch (error) {
    console.error("Get user data error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch user data",
    });
  }
});

/* ════════════════════════════════════════════════════════════
   POST /sync-user-data
   Syncs local storage data to logged-in user's profile
   ════════════════════════════════════════════════════════════ */
router.post("/sync-user-data", authMiddleware, async (req, res) => {
  try {
    const { localData } = req.body;
    const user = req.user;

    if (!localData) {
      return res.status(400).json({
        success: false,
        message: "Local data is required",
      });
    }

    let syncedFields = [];

    // Sync typing stats (keep highest values)
    if (localData.bestWPM && localData.bestWPM > user.bestWPM) {
      user.bestWPM = localData.bestWPM;
      syncedFields.push("bestWPM");
    }

    if (localData.bestAccuracy && localData.bestAccuracy > user.bestAccuracy) {
      user.bestAccuracy = localData.bestAccuracy;
      syncedFields.push("bestAccuracy");
    }

    if (localData.totalTests) {
      user.totalTests += localData.totalTests;
      syncedFields.push("totalTests");
    }

    if (localData.totalWords) {
      user.totalWords += localData.totalWords;
      syncedFields.push("totalWords");
    }

    if (localData.totalTime) {
      user.totalTime += localData.totalTime;
      syncedFields.push("totalTime");
    }

    // Sync gamification (keep highest)
    if (localData.xp && localData.xp > user.xp) {
      user.xp = localData.xp;
      syncedFields.push("xp");

      // Recalculate level
      let newLevel = user.level;
      let requiredXp = user.calculateRequiredXp(newLevel + 1);
      while (user.xp >= requiredXp) {
        newLevel++;
        requiredXp = user.calculateRequiredXp(newLevel + 1);
      }
      if (newLevel > user.level) {
        user.level = newLevel;
        syncedFields.push("level");
      }
    }

    if (localData.points && localData.points > user.points) {
      user.points = localData.points;
      syncedFields.push("points");
    }

    // Sync streak
    if (localData.streak) {
      if (localData.streak.current > user.streak.current) {
        user.streak.current = localData.streak.current;
        syncedFields.push("streak.current");
      }
      if (localData.streak.longest > user.streak.longest) {
        user.streak.longest = localData.streak.longest;
        syncedFields.push("streak.longest");
      }
    }

    // Sync badges (avoid duplicates)
    if (localData.badges && Array.isArray(localData.badges)) {
      const existingBadges = new Set(user.badges.map((b) => b.name));
      const newBadges = localData.badges
        .filter((b) => b && b.name && !existingBadges.has(b.name))
        .map((b) => ({
          name: b.name,
          earnedAt: b.earnedAt ? new Date(b.earnedAt) : new Date(),
          icon: b.icon || null,
          description: b.description || `Earned ${b.name} badge`,
        }));

      if (newBadges.length > 0) {
        user.badges.push(...newBadges);
        syncedFields.push("badges");
      }
    }

    // Sync test history (avoid duplicates by date)
    if (localData.testHistory && Array.isArray(localData.testHistory)) {
      const existingDates = new Set(
        user.testHistory.map(
          (t) => new Date(t.date).toISOString().split("T")[0],
        ),
      );
      const newTests = localData.testHistory.filter(
        (t) => !existingDates.has(new Date(t.date).toISOString().split("T")[0]),
      );

      if (newTests.length > 0) {
        user.testHistory.push(...newTests);
        user.testHistory.sort((a, b) => new Date(b.date) - new Date(a.date));
        if (user.testHistory.length > 100) {
          user.testHistory = user.testHistory.slice(0, 100);
        }
        syncedFields.push("testHistory");
      }
    }

    await user.save();

    return res.status(200).json({
      success: true,
      message: `Synced ${syncedFields.length} fields from local data`,
      syncedFields,
    });
  } catch (error) {
    console.error("Sync user data error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to sync data",
    });
  }
});

/* ════════════════════════════════════════════════════════════
   POST /save-test-result
   Saves a typing test result to the user's profile
   ════════════════════════════════════════════════════════════ */
router.post("/save-test-result", authMiddleware, async (req, res) => {
  try {
    const { 
      wpm, 
      accuracy, 
      mistakes, 
      duration, 
      mode, 
      lang,
      wordsTyped,
      charsTyped,
      consistency,
      rawWpm,
      difficulty 
    } = req.body;

    const user = req.user;

    // Create test result object
    const testResult = {
      date: new Date(),
      wpm: wpm || 0,
      accuracy: accuracy || 0,
      duration: duration || 0,
      wordCount: wordsTyped || 0,
      errorCount: mistakes || 0,
      difficulty: difficulty || "medium",
      textType: mode || "words",
      xpEarned: Math.round((wpm * accuracy) / 100) || 0,
      pointsEarned: Math.round(((wpm * accuracy) / 100) / 5) || 0,
    };

    // Add to test history
    user.testHistory.push(testResult);
    if (user.testHistory.length > 100) {
      user.testHistory = user.testHistory.slice(-100);
    }

    // Update totals
    user.totalTests = (user.totalTests || 0) + 1;
    user.totalWords = (user.totalWords || 0) + (wordsTyped || 0);
    user.totalTime = (user.totalTime || 0) + (duration || 0);
    user.totalCharacters = (user.totalCharacters || 0) + (charsTyped || 0);
    user.totalErrors = (user.totalErrors || 0) + (mistakes || 0);

    // Update best WPM
    if (wpm > user.bestWPM) {
      user.bestWPM = wpm;
      // Check if should add badge
      if (wpm >= 50) {
        const hasBadge = user.badges.some(b => b.name === "Speed Record");
        if (!hasBadge) {
          user.badges.push({
            name: "Speed Record",
            earnedAt: new Date(),
            description: `Achieved ${wpm} WPM`
          });
        }
      }
    }

    // Update best accuracy
    if (accuracy > user.bestAccuracy) {
      user.bestAccuracy = accuracy;
      if (accuracy >= 100) {
        const hasBadge = user.badges.some(b => b.name === "Perfect Typist");
        if (!hasBadge) {
          user.badges.push({
            name: "Perfect Typist",
            earnedAt: new Date(),
            description: "Achieved 100% accuracy"
          });
        }
      }
    }

    // Update XP and level
    const xpEarned = Math.round((wpm * accuracy) / 100);
    user.xp = (user.xp || 0) + xpEarned;
    
    // Recalculate level
    let newLevel = user.level || 1;
    let requiredXp = calculateRequiredXp(newLevel + 1);
    while (user.xp >= requiredXp) {
      newLevel++;
      requiredXp = calculateRequiredXp(newLevel + 1);
      // Award points on level up
      user.points = (user.points || 0) + newLevel * 50;
      
      // Check for level badges
      const levelBadges = {
        5: "Rising Star",
        10: "Typing Enthusiast",
        25: "Speed Demon",
        50: "Typing Master",
        100: "Legendary Typist",
      };
      if (levelBadges[newLevel]) {
        const hasBadge = user.badges.some(b => b.name === levelBadges[newLevel]);
        if (!hasBadge) {
          user.badges.push({
            name: levelBadges[newLevel],
            earnedAt: new Date(),
            description: `Reached level ${newLevel}`
          });
        }
      }
    }
    user.level = newLevel;

    // Update points
    const pointsEarned = Math.round(xpEarned / 5);
    user.points = (user.points || 0) + pointsEarned;

    // Update stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let dailyStat = user.stats.daily.find(
      (s) => s.date && new Date(s.date).toDateString() === today.toDateString()
    );
    if (!dailyStat) {
      dailyStat = {
        date: today,
        tests: 0,
        avgWpm: 0,
        avgAccuracy: 0,
        totalTime: 0,
        xpGained: 0,
      };
      user.stats.daily.push(dailyStat);
      if (user.stats.daily.length > 30) user.stats.daily.shift();
    }
    dailyStat.tests += 1;
    dailyStat.totalTime += duration || 0;
    dailyStat.avgWpm = (dailyStat.avgWpm * (dailyStat.tests - 1) + (wpm || 0)) / dailyStat.tests;
    dailyStat.avgAccuracy = (dailyStat.avgAccuracy * (dailyStat.tests - 1) + (accuracy || 0)) / dailyStat.tests;
    dailyStat.xpGained = (dailyStat.xpGained || 0) + xpEarned;

    // Update all-time stats
    const allTime = user.stats.allTime;
    const totalTests = allTime.totalTests + 1;
    allTime.avgWpm = (allTime.avgWpm * allTime.totalTests + (wpm || 0)) / totalTests;
    allTime.avgAccuracy = (allTime.avgAccuracy * allTime.totalTests + (accuracy || 0)) / totalTests;
    allTime.bestWpm = Math.max(allTime.bestWpm || 0, wpm || 0);
    allTime.bestAccuracy = Math.max(allTime.bestAccuracy || 0, accuracy || 0);
    allTime.totalTests = totalTests;
    allTime.totalTimeTyped = (allTime.totalTimeTyped || 0) + (duration || 0) / 3600;

    // Update streak
    const lastDate = user.streak?.lastDate;
    const todayStr = today.toDateString();
    if (!lastDate || new Date(lastDate).toDateString() !== todayStr) {
      const daysDiff = lastDate 
        ? Math.floor((today - new Date(lastDate)) / (1000 * 60 * 60 * 24))
        : 2;
      
      user.streak = user.streak || { current: 0, longest: 0, lastDate: null };
      if (daysDiff === 1) {
        user.streak.current = (user.streak.current || 0) + 1;
        user.streak.longest = Math.max(user.streak.longest || 0, user.streak.current);
      } else if (daysDiff > 1) {
        user.streak.current = 1;
      }
      user.streak.lastDate = today;
      user.streak.lastUpdated = new Date();
    }

    // Update weekly goal
    const weekStart = user.weeklyGoal?.weekStart;
    if (!weekStart || Math.floor((today - new Date(weekStart)) / (1000 * 60 * 60 * 24)) >= 7) {
      user.weeklyGoal = {
        target: 7,
        done: 1,
        weekStart: today,
        completed: false,
      };
    } else {
      user.weeklyGoal.done = (user.weeklyGoal.done || 0) + 1;
      if (user.weeklyGoal.done >= user.weeklyGoal.target && !user.weeklyGoal.completed) {
        user.weeklyGoal.completed = true;
        user.points = (user.points || 0) + 100;
        const hasBadge = user.badges.some(b => b.name === "Weekly Warrior");
        if (!hasBadge) {
          user.badges.push({
            name: "Weekly Warrior",
            earnedAt: new Date(),
            description: "Completed weekly goal"
          });
        }
      }
    }

    await user.save();

    // Get updated user data
    const userData = user.getPublicProfile();
    const typingStats = user.getTypingStats();

    return res.status(200).json({
      success: true,
      message: "Test result saved successfully",
      user: userData,
      stats: typingStats,
      xpEarned,
      pointsEarned,
    }); 

  } catch (error) {
    console.error("Save test result error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to save test result",
      error: error.message,
    });
  }
}); 

// Helper function for XP calculation 
function calculateRequiredXp(level) {
  return Math.floor(100 + (level - 1) * 50); 
} 
 
module.exports = router;
