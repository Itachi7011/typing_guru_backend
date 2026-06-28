const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const UserSchema = new mongoose.Schema(
  {
    // Required identification

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      default: () => new mongoose.Types.ObjectId(),
      required: true,
      index: true,
    },
    // Basic fields
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      validate: {
        validator: function (v) {
          return /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(v);
        },
        message: "Please enter a valid email",
      },
    },
    avatar: {
      data: String,
      publicId: String,
      format: String,
      originalName: String,
      contentType: String,
    },
    password: {
      type: String,
      required: true,
      minlength: 8,
    },
    phone: {
      type: String,
      sparse: true,
    },
    usertype: {
      type: String,
      required: true,
      default: "User",
    },
    otp: {
      type: String,
      sparse: true,
    },
    customAttributes: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {},
    },
    apiKey: {
      type: String,
    },

    // Authentication status
    emailVerified: {
      type: Boolean,
      default: false,
    },
    phoneVerified: {
      type: Boolean,
      default: false,
    },

    // ============ TYPING PLATFORM SPECIFIC FIELDS ============

    // Gamification & Progression
    xp: {
      type: Number,
      default: 0,
      min: 0,
    },
    level: {
      type: Number,
      default: 1,
      min: 1,
    },
    points: {
      type: Number,
      default: 0,
      min: 0,
    },
    badges: [
      {
        name: {
          type: String,
          required: true,
        },
        earnedAt: {
          type: Date,
          default: Date.now,
        },
        icon: String,
        description: String,
      },
    ],

    // Streak tracking
    streak: {
      current: {
        type: Number,
        default: 0,
      },
      longest: {
        type: Number,
        default: 0,
      },
      lastDate: {
        type: Date,
        default: null,
      },
      lastUpdated: Date,
    },

    // Performance metrics
    bestWPM: {
      type: Number,
      default: 0,
    },
    bestAccuracy: {
      type: Number,
      default: 0,
    },
    totalTests: {
      type: Number,
      default: 0,
    },
    totalWords: {
      type: Number,
      default: 0,
    },
    totalTime: {
      type: Number, // in seconds
      default: 0,
    },
    totalCharacters: {
      type: Number,
      default: 0,
    },
    totalErrors: {
      type: Number,
      default: 0,
    },

    // Achievements system
    achievements: [
      {
        achievementId: {
          type: String,
          required: true,
        },
        name: String,
        description: String,
        earnedAt: {
          type: Date,
          default: Date.now,
        },
        progress: {
          type: Number,
          default: 0,
        },
        completed: {
          type: Boolean,
          default: false,
        },
      },
    ],

    // Weekly goals
    weeklyGoal: {
      target: {
        type: Number,
        default: 7, // tests per week
      },
      done: {
        type: Number,
        default: 0,
      },
      weekStart: {
        type: Date,
        default: () => {
          const now = new Date();
          now.setHours(0, 0, 0, 0);
          return now;
        },
      },
      completed: {
        type: Boolean,
        default: false,
      },
    },

    // Test history (limited to last 100 for performance)
    testHistory: [
      {
        date: {
          type: Date,
          default: Date.now,
        },
        wpm: Number,
        accuracy: Number,
        duration: Number, // seconds
        wordCount: Number,
        errorCount: Number,
        difficulty: {
          type: String,
          enum: ["easy", "medium", "hard", "expert"],
        },
        textType: String, // 'quote', 'paragraph', 'custom'
        xpEarned: Number,
        pointsEarned: Number,
      },
    ],

    // Error pattern analysis
    errorPatterns: {
      commonMistakes: [
        {
          wrong: String,
          correct: String,
          count: Number,
        },
      ],
      slowWords: [
        {
          word: String,
          avgTime: Number, // milliseconds per word
          attempts: Number,
        },
      ],
      problematicKeys: [
        {
          key: String,
          errorRate: Number, // percentage
        },
      ],
      lastUpdated: Date,
    },

    // Level system configuration
    levelConfig: {
      currentXpNeeded: {
        type: Number,
        default: 100,
      },
      totalXpEarned: {
        type: Number,
        default: 0,
      },
      prestige: {
        type: Number,
        default: 0,
      },
    },

    // ============ EXAM & COMPETITION FEATURES ============

    examHistory: [
      {
        examId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Exam",
        },
        examName: String,
        examType: {
          type: String,
          enum: ["ssc", "banking", "railway", "ielts", "toefl", "custom"],
        },
        score: Number,
        wpm: Number,
        accuracy: Number,
        rank: Number,
        totalParticipants: Number,
        completedAt: Date,
        certificate: {
          url: String,
          issuedAt: Date,
        },
      },
    ],

    // Daily challenges
    dailyChallenges: {
      lastChallengeDate: Date,
      currentChallenge: {
        challengeId: mongoose.Schema.Types.ObjectId,
        completed: { type: Boolean, default: false },
        progress: { type: Number, default: 0 },
        reward: { type: Number, default: 0 },
        claimed: { type: Boolean, default: false },
      },
      streak: {
        type: Number,
        default: 0,
      },
      totalCompleted: {
        type: Number,
        default: 0,
      },
    },

    // Games & practice modes
    games: {
      typingRush: {
        highScore: { type: Number, default: 0 },
        gamesPlayed: { type: Number, default: 0 },
        totalScore: { type: Number, default: 0 },
      },
      wordHunter: {
        highScore: { type: Number, default: 0 },
        gamesPlayed: { type: Number, default: 0 },
        totalScore: { type: Number, default: 0 },
      },
      speedTracer: {
        bestTime: { type: Number, default: 0 }, // milliseconds
        gamesPlayed: { type: Number, default: 0 },
        averageTime: { type: Number, default: 0 },
      },
    },

    // Drills & practice sessions
    drills: {
      basicKeys: {
        completed: { type: Boolean, default: false },
        score: { type: Number, default: 0 },
        lastAttempt: Date,
      },
      homeRow: {
        completed: { type: Boolean, default: false },
        score: { type: Number, default: 0 },
        lastAttempt: Date,
      },
      topRow: {
        completed: { type: Boolean, default: false },
        score: { type: Number, default: 0 },
        lastAttempt: Date,
      },
      bottomRow: {
        completed: { type: Boolean, default: false },
        score: { type: Number, default: 0 },
        lastAttempt: Date,
      },
      numbers: {
        completed: { type: Boolean, default: false },
        score: { type: Number, default: 0 },
        lastAttempt: Date,
      },
      symbols: {
        completed: { type: Boolean, default: false },
        score: { type: Number, default: 0 },
        lastAttempt: Date,
      },
      customDrills: [
        {
          name: String,
          completed: Boolean,
          score: Number,
          lastAttempt: Date,
        },
      ],
    },

    // Personal training plan
    personalTraining: {
      enabled: { type: Boolean, default: false },
      focusArea: {
        type: String,
        enum: ["speed", "accuracy", "both", "specificKeys"],
        default: "both",
      },
      dailyGoal: {
        minutes: { type: Number, default: 15 },
        tests: { type: Number, default: 5 },
      },
      weakPoints: [String],
      recommendedExercises: [
        {
          exercise: String,
          reason: String,
          assignedAt: Date,
          completed: Boolean,
        },
      ],
      trainingPlan: {
        type: {
          type: String,
          enum: ["beginner", "intermediate", "advanced", "professional"],
        },
        startDate: Date,
        endDate: Date,
        sessions: [
          {
            day: Number,
            exercises: [
              {
                type: String,
                duration: Number,
                completed: Boolean,
              },
            ],
          },
        ],
      },
      progress: [
        {
          date: Date,
          improvement: Number, // percentage
          notes: String,
        },
      ],
    },

    // Statistics & analytics
    stats: {
      daily: [
        {
          date: Date,
          tests: Number,
          avgWpm: Number,
          avgAccuracy: Number,
          totalTime: Number,
          xpGained: Number,
        },
      ],
      weekly: [
        {
          week: Number,
          year: Number,
          tests: Number,
          avgWpm: Number,
          avgAccuracy: Number,
          xpGained: Number,
        },
      ],
      monthly: [
        {
          month: Number,
          year: Number,
          tests: Number,
          avgWpm: Number,
          avgAccuracy: Number,
          xpGained: Number,
        },
      ],
      allTime: {
        avgWpm: { type: Number, default: 0 },
        bestWpm: { type: Number, default: 0 },
        avgAccuracy: { type: Number, default: 0 },
        bestAccuracy: { type: Number, default: 0 },
        totalTests: { type: Number, default: 0 },
        totalTimeTyped: { type: Number, default: 0 }, // hours
        consistency: { type: Number, default: 0 }, // percentage
      },
    },

    // Leaderboards & rankings
    rankings: {
      global: {
        rank: Number,
        percentile: Number,
        updatedAt: Date,
      },
      regional: {
        region: String,
        rank: Number,
        percentile: Number,
        updatedAt: Date,
      },
      friends: [
        {
          userId: mongoose.Schema.Types.ObjectId,
          rank: Number,
        },
      ],
    },

    // Social features
    friends: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: `${process.env.APP_NAME}_User`,
        },
        status: {
          type: String,
          enum: ["pending", "accepted", "blocked"],
        },
        addedAt: Date,
        lastInteraction: Date,
      },
    ],

    // Notifications & preferences
    preferences: {
      communication: {
        marketingEmails: { type: Boolean, default: false },
        securityAlerts: { type: Boolean, default: true },
        productUpdates: { type: Boolean, default: false },
        dailyReminders: { type: Boolean, default: true },
        challengeReminders: { type: Boolean, default: true },
      },
      ui: {
        theme: {
          type: String,
          enum: ["light", "dark", "auto"],
          default: "auto",
        },
        language: { type: String, default: "en" },
        soundEffects: { type: Boolean, default: true },
        keyboardSound: { type: Boolean, default: false },
        showLiveWpm: { type: Boolean, default: true },
      },
      typing: {
        fontSize: { type: Number, default: 16 },
        fontFamily: { type: String, default: "monospace" },
        showKeyboard: { type: Boolean, default: true },
        highlightErrors: { type: Boolean, default: true },
        practiceMode: {
          type: String,
          enum: ["timed", "words", "custom"],
          default: "timed",
        },
      },
    },

    gameStats: {
      type: Map,
      of: new mongoose.Schema(
        {
          bestScore: { type: Number, default: 0 },
          gamesPlayed: { type: Number, default: 0 },
          bestCombo: { type: Number, default: 0 },
          totalWordsEaten: { type: Number, default: 0 },
          lastPlayedAt: Date,
        },
        { _id: false },
      ),
      default: {},
    },

    gameSettings: {
      avatarId: { type: String, default: "chomp" },
      avatarColor: { type: String, default: null }, // hex override; null = avatar's own colour
      soundPackId: { type: String, default: "arcade" },
      masterVolume: { type: Number, default: 0.7, min: 0, max: 1 },
      soundOn: { type: Boolean, default: true },
      particlesOn: { type: Boolean, default: true },
      beaconOn: { type: Boolean, default: true },
      reduceMotion: { type: Boolean, default: false },
      difficulty: {
        type: String,
        enum: ["easy", "medium", "hard", "insane"],
        default: "medium",
      },
      sessionSeconds: { type: Number, default: 60 },
    },

    // MFA (reduced from extreme version)
    mfa: {
      enabled: { type: Boolean, default: false },
      methods: {
        totp: {
          enabled: { type: Boolean, default: false },
          secret: { type: String, select: false },
          lastUsed: Date,
        },
        backupCodes: {
          enabled: { type: Boolean, default: false },
          codes: [
            {
              code: { type: String, select: false },
              used: { type: Boolean, default: false },
              usedAt: Date,
            },
          ],
          generatedAt: Date,
        },
        sms: {
          enabled: { type: Boolean, default: false },
          phoneNumber: String,
          verified: { type: Boolean, default: false },
        },
        emailOtp: {
          enabled: { type: Boolean, default: false },
          verified: { type: Boolean, default: false },
        },
      },
      recoveryEmail: String,
      lastUsed: Date,
    },

    // Security (basic but robust)
    verificationToken: String,
    verificationTokenExpires: Date,
    passwordResetToken: String,
    passwordResetExpires: Date,

    // Social logins (popular providers)
    socialLogins: {
      google: { id: String, profile: mongoose.Schema.Types.Mixed },
      github: { id: String, profile: mongoose.Schema.Types.Mixed },
      facebook: { id: String, profile: mongoose.Schema.Types.Mixed },
      linkedin: { id: String, profile: mongoose.Schema.Types.Mixed },
    },

    // Security settings
    loginAttempts: { type: Number, default: 0 },
    lockUntil: Date,
    lastLogin: Date,
    isActive: { type: Boolean, default: true },
    isBlocked: { type: Boolean, default: false },
    blockedAt: Date,
    blockedReason: String,
    isDeleted: { type: Boolean, default: false },

    // Trusted devices (simplified)
    trustedDevices: [
      {
        deviceId: String,
        userAgent: String,
        ipAddress: String,
        addedAt: Date,
        lastUsedAt: Date,
        trusted: { type: Boolean, default: false },
      },
    ],

    // Security PIN (simple version)
    securityPin: {
      pinHash: { type: String, select: false },
      enabled: { type: Boolean, default: false },
      failedAttempts: { type: Number, default: 0 },
      lockedUntil: Date,
      lastUpdated: Date,
    },

    // Password policy & history
    passwordPolicy: {
      minLength: { type: Number, default: 8 },
      requireNumbers: { type: Boolean, default: true },
      requireSymbols: { type: Boolean, default: true },
      requireUppercase: { type: Boolean, default: true },
      requireLowercase: { type: Boolean, default: true },
      maxPasswordAge: { type: Number, default: 90 },
    },
    lastPasswordChange: Date,
    passwordHistory: [
      {
        password: String,
        changedAt: Date,
      },
    ],

    // IP & device tracking
    ipAddress: String,
    userAgent: String,
    timezone: String,
    preferredLanguage: { type: String, default: "en" },

    // Activity log (limited)
    activityLog: [
      {
        action: String,
        timestamp: Date,
        ipAddress: String,
        details: mongoose.Schema.Types.Mixed,
      },
    ],

    // Tokens
    tokens: [
      {
        token: String,
        tokenType: {
          type: String,
          enum: ["access", "refresh", "password_reset", "email_verification"],
        },
        sessionId: String,
        expiration: Date,
        createdAt: { type: Date, default: Date.now },
        isRevoked: { type: Boolean, default: false },
        deviceInfo: {
          userAgent: String,
          ipAddress: String,
        },
      },
    ],
    currentAccessToken: {
      type: String,
      select: false, // Don't return by default
    },
    lastAccessTokenAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (doc, ret) {
        delete ret.password;
        delete ret.passwordHistory;
        delete ret.verificationToken;
        delete ret.verificationTokenExpires;
        delete ret.passwordResetToken;
        delete ret.passwordResetExpires;
        delete ret.securityPin;
        delete ret.mfa?.methods?.totp?.secret;
        delete ret.mfa?.methods?.backupCodes?.codes;
        return ret;
      },
    },
  },
);

// ============ INDEXES ============
// UserSchema.index({ email: 1}, { unique: true });
UserSchema.index({ level: -1, xp: -1 });
UserSchema.index({ bestWPM: -1 });
UserSchema.index({ "stats.allTime.bestWpm": -1 });
UserSchema.index({ createdAt: 1 });
UserSchema.index({ "streak.current": -1 });
UserSchema.index({ "dailyChallenges.lastChallengeDate": 1 });

// ============ VIRTUALS ============
UserSchema.virtual("isLocked").get(function () {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

UserSchema.virtual("nextLevelXp").get(function () {
  return this.calculateRequiredXp(this.level + 1);
});

UserSchema.virtual("xpProgress").get(function () {
  const currentLevelXp = this.calculateRequiredXp(this.level);
  const nextLevelXp = this.calculateRequiredXp(this.level + 1);
  const xpIntoLevel = this.xp - currentLevelXp;
  const xpNeeded = nextLevelXp - currentLevelXp;
  return (xpIntoLevel / xpNeeded) * 100;
});

// ============ HELPER FUNCTIONS ============
function calculateRequiredXp(level) {
  // Exponential growth: base 100, increase by 50 each level
  return Math.floor(100 + (level - 1) * 50);
}

// ============ PRE-SAVE HOOK ============
UserSchema.pre("save", async function () {
  // Initialize new user
  if (this.isNew) {
    this.userId = this._id;

    // Initialize badges with "Newbie"
    this.badges = [
      {
        name: "Newbie",
        earnedAt: new Date(),
        description: "Joined the typing platform",
      },
    ];

    // Initialize weekly goal
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    this.weeklyGoal.weekStart = now;

    // Initialize mfa structure
    if (!this.mfa.methods) {
      this.mfa.methods = {};
    }

    // Initialize error patterns
    this.errorPatterns = {
      commonMistakes: [],
      slowWords: [],
      problematicKeys: [],
      lastUpdated: new Date(),
    };
  }

  // Reset email verification on email change
  if (this.isModified("email") && this.emailVerified) {
    this.emailVerified = false;
  }

  // Normalize email
  if (this.isModified("email")) {
    this.email = this.email.toLowerCase();
  }

  // Handle password hashing
  if (this.isModified("password")) {
    const cleanPassword = this.password.trim();
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(cleanPassword, salt);

    // Update password history
    if (!this.passwordHistory) this.passwordHistory = [];
    if (this.passwordHistory.length >= 5) this.passwordHistory.shift();
    this.passwordHistory.push({
      password: this.password,
      changedAt: new Date(),
    });
    this.lastPasswordChange = new Date();
  }

  // Handle security pin hashing
  if (this.isModified("securityPin.pinHash") && this.securityPin?.pinHash) {
    if (!this.securityPin.pinHash.startsWith("$2b$")) {
      const salt = await bcrypt.genSalt(12);
      this.securityPin.pinHash = await bcrypt.hash(
        this.securityPin.pinHash,
        salt,
      );
      this.securityPin.lastUpdated = new Date();
    }
  }

  // Reset weekly goal if needed
  if (this.weeklyGoal && this.weeklyGoal.weekStart) {
    const now = new Date();
    const weekStart = new Date(this.weeklyGoal.weekStart);
    const daysDiff = Math.floor((now - weekStart) / (1000 * 60 * 60 * 24));

    if (daysDiff >= 7) {
      this.weeklyGoal = {
        target: this.weeklyGoal.target || 7,
        done: 0,
        weekStart: now,
        completed: false,
      };
    }
  }

  // Update streak
  if (this.isModified("testHistory") && this.testHistory.length > 0) {
    const lastTest = this.testHistory[this.testHistory.length - 1];
    const lastDate = this.streak.lastDate;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const testDate = new Date(lastTest.date);
    testDate.setHours(0, 0, 0, 0);

    if (!lastDate || testDate > lastDate) {
      const daysDiff = lastDate
        ? Math.floor((testDate - lastDate) / (1000 * 60 * 60 * 24))
        : 1;

      if (daysDiff === 1) {
        this.streak.current += 1;
        if (this.streak.current > this.streak.longest) {
          this.streak.longest = this.streak.current;
        }
      } else if (daysDiff > 1) {
        this.streak.current = 1;
      }

      this.streak.lastDate = testDate;
      this.streak.lastUpdated = new Date();
    }
  }
});
// ============ GAMIFICATION METHODS ============

// Add XP and handle level ups - FIXED version (remove next parameter)
UserSchema.methods.addXP = async function (amount) {
  this.xp += amount;
  this.levelConfig.totalXpEarned += amount;

  let leveledUp = false;
  let requiredXp = this.calculateRequiredXp(this.level + 1);

  while (this.xp >= requiredXp) {
    this.level++;
    leveledUp = true;
    requiredXp = this.calculateRequiredXp(this.level + 1);

    // Award points on level up
    const levelUpPoints = this.level * 50;
    this.points += levelUpPoints;

    // Check for level-based badges
    await this.checkLevelBadges();
  }

  this.levelConfig.currentXpNeeded =
    this.calculateRequiredXp(this.level + 1) -
    this.calculateRequiredXp(this.level);

  await this.save();
  return { leveledUp, newLevel: this.level, xpGained: amount };
};

// Add points
UserSchema.methods.addPoints = async function (amount) {
  this.points += amount;
  await this.save();
  return this.points;
};

// Add badge
UserSchema.methods.addBadge = async function (
  badgeName,
  description,
  icon = null,
) {
  const existingBadge = this.badges.find((b) => b.name === badgeName);
  if (!existingBadge) {
    this.badges.push({
      name: badgeName,
      earnedAt: new Date(),
      icon: icon,
      description: description,
    });
    await this.save();
    return true;
  }
  return false;
};

// Check level-based badges
UserSchema.methods.checkLevelBadges = async function () {
  const levelBadges = {
    5: "Rising Star",
    10: "Typing Enthusiast",
    25: "Speed Demon",
    50: "Typing Master",
    100: "Legendary Typist",
  };

  for (const [level, badgeName] of Object.entries(levelBadges)) {
    if (this.level >= parseInt(level)) {
      await this.addBadge(badgeName, `Reached level ${level}`);
    }
  }
};

// Add test result
UserSchema.methods.addTestResult = async function (testData) {
  // Calculate XP earned (WPM * accuracy * difficulty multiplier)
  const difficultyMultiplier =
    {
      easy: 0.5,
      medium: 1,
      hard: 1.5,
      expert: 2,
    }[testData.difficulty] || 1;

  const xpEarned = Math.floor(
    testData.wpm * (testData.accuracy / 100) * difficultyMultiplier * 10,
  );

  const pointsEarned = Math.floor(xpEarned / 5);

  // Add to test history (keep last 100)
  this.testHistory.push({
    ...testData,
    xpEarned,
    pointsEarned,
  });

  if (this.testHistory.length > 100) {
    this.testHistory = this.testHistory.slice(-100);
  }

  // Update totals
  this.totalTests += 1;
  this.totalWords += testData.wordCount;
  this.totalTime += testData.duration;
  this.totalCharacters += testData.wordCount * 5; // Approximate
  this.totalErrors += testData.errorCount || 0;

  // Update best WPM
  if (testData.wpm > this.bestWPM) {
    this.bestWPM = testData.wpm;
    await this.addBadge("Speed Record", `Achieved ${testData.wpm} WPM`);
  }

  // Update best accuracy
  if (testData.accuracy > this.bestAccuracy) {
    this.bestAccuracy = testData.accuracy;
    if (this.bestAccuracy >= 100) {
      await this.addBadge("Perfect Typist", "Achieved 100% accuracy");
    }
  }

  // Update stats
  await this.updateStats(testData);

  // Add XP and handle level ups
  await this.addXP(xpEarned);
  await this.addPoints(pointsEarned);

  // Update weekly goal
  this.weeklyGoal.done += 1;
  if (
    this.weeklyGoal.done >= this.weeklyGoal.target &&
    !this.weeklyGoal.completed
  ) {
    this.weeklyGoal.completed = true;
    await this.addPoints(100);
    await this.addBadge("Weekly Warrior", "Completed weekly goal");
  }

  // Update daily challenge if active
  if (
    this.dailyChallenges.currentChallenge &&
    !this.dailyChallenges.currentChallenge.completed
  ) {
    this.dailyChallenges.currentChallenge.progress += 1;
    if (this.dailyChallenges.currentChallenge.progress >= 5) {
      // Assuming 5 tests needed
      this.dailyChallenges.currentChallenge.completed = true;
      await this.addPoints(this.dailyChallenges.currentChallenge.reward);
      this.dailyChallenges.streak += 1;
      this.dailyChallenges.totalCompleted += 1;
    }
  }

  await this.save();

  return {
    xpEarned,
    pointsEarned,
    newLevel: this.level,
    newBadges: this.badges.slice(-1)[0], // Last added badge
  };
};

// Update statistics
UserSchema.methods.updateStats = async function (testData) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Update daily stats
  let dailyStat = this.stats.daily.find(
    (s) => s.date && s.date.toDateString() === today.toDateString(),
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
    this.stats.daily.push(dailyStat);
    if (this.stats.daily.length > 30) this.stats.daily.shift();
  }

  dailyStat.tests += 1;
  dailyStat.totalTime += testData.duration;
  dailyStat.avgWpm =
    (dailyStat.avgWpm * (dailyStat.tests - 1) + testData.wpm) / dailyStat.tests;
  dailyStat.avgAccuracy =
    (dailyStat.avgAccuracy * (dailyStat.tests - 1) + testData.accuracy) /
    dailyStat.tests;

  // Update all-time stats
  const allTime = this.stats.allTime;
  const totalTests = allTime.totalTests + 1;
  allTime.avgWpm =
    (allTime.avgWpm * allTime.totalTests + testData.wpm) / totalTests;
  allTime.avgAccuracy =
    (allTime.avgAccuracy * allTime.totalTests + testData.accuracy) / totalTests;
  allTime.bestWpm = Math.max(allTime.bestWpm, testData.wpm);
  allTime.bestAccuracy = Math.max(allTime.bestAccuracy, testData.accuracy);
  allTime.totalTests = totalTests;
  allTime.totalTimeTyped += testData.duration / 3600; // Convert to hours

  // Calculate consistency (standard deviation of recent WPMs)
  const recentWpms = this.testHistory.slice(-20).map((t) => t.wpm);
  if (recentWpms.length > 1) {
    const mean = recentWpms.reduce((a, b) => a + b, 0) / recentWpms.length;
    const variance =
      recentWpms.reduce((a, b) => a + Math.pow(b - mean, 2), 0) /
      recentWpms.length;
    const stdDev = Math.sqrt(variance);
    allTime.consistency = Math.max(0, 100 - (stdDev / mean) * 100);
  }
};

// Update error patterns
UserSchema.methods.updateErrorPatterns = async function (errors) {
  // errors should be array of { wrong: string, correct: string, key: string }
  for (const error of errors) {
    // Update common mistakes
    const mistakeIndex = this.errorPatterns.commonMistakes.findIndex(
      (m) => m.wrong === error.wrong && m.correct === error.correct,
    );

    if (mistakeIndex !== -1) {
      this.errorPatterns.commonMistakes[mistakeIndex].count += 1;
    } else {
      this.errorPatterns.commonMistakes.push({
        wrong: error.wrong,
        correct: error.correct,
        count: 1,
      });
    }

    // Update problematic keys
    const keyIndex = this.errorPatterns.problematicKeys.findIndex(
      (k) => k.key === error.key,
    );

    if (keyIndex !== -1) {
      const totalAttempts = this.totalCharacters;
      this.errorPatterns.problematicKeys[keyIndex].errorRate =
        ((this.errorPatterns.problematicKeys[keyIndex].errorCount + 1) /
          totalAttempts) *
        100;
    } else {
      this.errorPatterns.problematicKeys.push({
        key: error.key,
        errorRate: (1 / this.totalCharacters) * 100,
        errorCount: 1,
      });
    }
  }

  // Sort common mistakes by count (descending) and keep top 20
  this.errorPatterns.commonMistakes.sort((a, b) => b.count - a.count);
  if (this.errorPatterns.commonMistakes.length > 20) {
    this.errorPatterns.commonMistakes = this.errorPatterns.commonMistakes.slice(
      0,
      20,
    );
  }

  // Sort problematic keys by error rate (descending)
  this.errorPatterns.problematicKeys.sort((a, b) => b.errorRate - a.errorRate);

  this.errorPatterns.lastUpdated = new Date();
  await this.save();
};

// Complete a drill
UserSchema.methods.completeDrill = async function (drillName, score) {
  if (this.drills[drillName] && typeof this.drills[drillName] === "object") {
    this.drills[drillName].completed = true;
    this.drills[drillName].score = Math.max(
      this.drills[drillName].score || 0,
      score,
    );
    this.drills[drillName].lastAttempt = new Date();

    // Award XP for completing drill
    await this.addXP(50);

    // Check if all basic drills completed
    const basicDrills = [
      "basicKeys",
      "homeRow",
      "topRow",
      "bottomRow",
      "numbers",
      "symbols",
    ];
    const allCompleted = basicDrills.every(
      (drill) => this.drills[drill]?.completed === true,
    );

    if (allCompleted) {
      await this.addBadge("Drill Master", "Completed all basic drills");
      await this.addXP(200);
    }

    await this.save();
    return true;
  }
  return false;
};

// Start daily challenge
UserSchema.methods.startDailyChallenge = async function (challengeId, reward) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (
    !this.dailyChallenges.lastChallengeDate ||
    this.dailyChallenges.lastChallengeDate.toDateString() !==
      today.toDateString()
  ) {
    this.dailyChallenges.currentChallenge = {
      challengeId,
      completed: false,
      progress: 0,
      reward,
      claimed: false,
    };
    this.dailyChallenges.lastChallengeDate = today;
    await this.save();
    return true;
  }
  return false;
};

// Claim daily challenge reward
UserSchema.methods.claimDailyReward = async function () {
  if (
    this.dailyChallenges.currentChallenge?.completed &&
    !this.dailyChallenges.currentChallenge.claimed
  ) {
    await this.addPoints(this.dailyChallenges.currentChallenge.reward);
    this.dailyChallenges.currentChallenge.claimed = true;
    await this.save();
    return true;
  }
  return false;
};

// ============ AUTHENTICATION METHODS ============

// Compare password
UserSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) return false;
  try {
    const cleanCandidate = candidatePassword.trim();
    return await bcrypt.compare(cleanCandidate, this.password);
  } catch (error) {
    console.error("Password comparison error:", error);
    return false;
  }
};

// Compare security pin
UserSchema.methods.compareSecurityPin = async function (candidatePin) {
  if (!this.securityPin?.enabled || !this.securityPin?.pinHash) return false;

  if (
    this.securityPin.lockedUntil &&
    this.securityPin.lockedUntil > Date.now()
  ) {
    return false;
  }

  try {
    const isMatch = await bcrypt.compare(
      candidatePin,
      this.securityPin.pinHash,
    );

    if (!isMatch) {
      await this.incrementPinAttempts();
    } else {
      await this.resetPinAttempts();
    }

    return isMatch;
  } catch (error) {
    console.error("PIN comparison error:", error);
    return false;
  }
};

// Increment login attempts
UserSchema.methods.incrementLoginAttempts = async function () {
  const MAX_ATTEMPTS = 5;
  const LOCKOUT_DURATION = 2 * 60 * 60 * 1000; // 2 hours

  if (this.lockUntil && this.lockUntil < Date.now()) {
    this.loginAttempts = 1;
    this.lockUntil = undefined;
    return this.save();
  }

  this.loginAttempts += 1;

  if (this.loginAttempts >= MAX_ATTEMPTS && !this.isLocked) {
    this.lockUntil = Date.now() + LOCKOUT_DURATION;
  }

  return this.save();
};

// Reset login attempts - FIXED version
UserSchema.methods.resetLoginAttempts = async function () {
  this.loginAttempts = 0;
  this.lockUntil = undefined;
  await this.save();
};

// Increment pin attempts - FIXED version
UserSchema.methods.incrementPinAttempts = async function () {
  const MAX_PIN_ATTEMPTS = 5;
  const PIN_LOCKOUT_DURATION = 30 * 60 * 1000; // 30 minutes

  if (!this.securityPin) return;

  if (
    this.securityPin.lockedUntil &&
    this.securityPin.lockedUntil < Date.now()
  ) {
    this.securityPin.failedAttempts = 1;
    this.securityPin.lockedUntil = undefined;
    await this.save();
    return;
  }

  this.securityPin.failedAttempts += 1;

  if (this.securityPin.failedAttempts >= MAX_PIN_ATTEMPTS) {
    this.securityPin.lockedUntil = Date.now() + PIN_LOCKOUT_DURATION;
  }

  await this.save();
};

// Reset pin attempts - FIXED version
UserSchema.methods.resetPinAttempts = async function () {
  if (this.securityPin) {
    this.securityPin.failedAttempts = 0;
    this.securityPin.lockedUntil = undefined;
    await this.save();
  }
};

// Generate backup codes for MFA - FIXED version
UserSchema.methods.generateBackupCodes = async function () {
  const NUM_CODES = 10;
  const CODE_LENGTH = 10;
  const rawCodes = [];
  const hashedCodes = [];

  for (let i = 0; i < NUM_CODES; i++) {
    const rawCode = crypto
      .randomBytes(CODE_LENGTH / 2)
      .toString("hex")
      .toUpperCase();
    const hashedCode = await bcrypt.hash(rawCode, 12);

    rawCodes.push(rawCode);
    hashedCodes.push({
      code: hashedCode,
      used: false,
      createdAt: new Date(),
    });
  }

  if (!this.mfa.methods.backupCodes) {
    this.mfa.methods.backupCodes = { enabled: false, codes: [] };
  }

  this.mfa.methods.backupCodes.codes = hashedCodes;
  this.mfa.methods.backupCodes.generatedAt = new Date();
  this.mfa.methods.backupCodes.enabled = true;

  await this.save();
  return rawCodes;
};

// Verify backup code - FIXED version
UserSchema.methods.verifyBackupCode = async function (candidateCode) {
  if (!this.mfa.methods.backupCodes?.codes) return false;

  for (let codeEntry of this.mfa.methods.backupCodes.codes) {
    if (
      !codeEntry.used &&
      (await bcrypt.compare(candidateCode, codeEntry.code))
    ) {
      codeEntry.used = true;
      codeEntry.usedAt = new Date();
      this.mfa.methods.backupCodes.lastUsed = new Date();
      await this.save();
      return true;
    }
  }
  return false;
};

// Get remaining backup codes count
UserSchema.methods.getRemainingBackupCodes = function () {
  if (!this.mfa.methods.backupCodes?.codes) return 0;
  return this.mfa.methods.backupCodes.codes.filter((code) => !code.used).length;
};

// ============ UTILITY METHODS ============

// Get public profile
UserSchema.methods.getPublicProfile = function () {
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    avatar: this.avatar,
    usertype: this.usertype,
    createdAt: this.createdAt, // Add this line
    lastLogin: this.lastLogin, // Add this line (if not already there)

    // Gamification stats
    level: this.level,
    xp: this.xp,
    points: this.points,
    badges: this.badges,
    streak: this.streak,
    bestWPM: this.bestWPM,
    totalTests: this.totalTests,

    // Stats
    stats: this.stats.allTime,

    // Preferences
    preferences: this.preferences,

    // Status
    isActive: this.isActive,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

// Get typing statistics
UserSchema.methods.getTypingStats = function () {
  return {
    overall: {
      totalTests: this.totalTests,
      totalWords: this.totalWords,
      totalTime: this.totalTime,
      bestWPM: this.bestWPM,
      bestAccuracy: this.bestAccuracy,
      averageWPM: this.stats.allTime.avgWpm,
      averageAccuracy: this.stats.allTime.avgAccuracy,
      consistency: this.stats.allTime.consistency,
    },
    recent: this.testHistory.slice(-10),
    dailyStats: this.stats.daily.slice(-7),
    errorPatterns: {
      commonMistakes: this.errorPatterns.commonMistakes.slice(0, 5),
      problematicKeys: this.errorPatterns.problematicKeys.slice(0, 5),
    },
    achievements: {
      level: this.level,
      nextLevelXpNeeded: this.levelConfig.currentXpNeeded,
      badges: this.badges,
      weeklyGoal: this.weeklyGoal,
      dailyChallenge: this.dailyChallenges,
    },
  };
};

// Calculate required XP for a level
UserSchema.methods.calculateRequiredXp = function (level) {
  return calculateRequiredXp(level);
};

module.exports = mongoose.model(`${process.env.APP_NAME}_User`, UserSchema);
