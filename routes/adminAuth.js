// routes/adminAuth.js
//
// The admin authentication surface that was completely missing before this
// pass (see COMPETITIVE_ANALYSIS_AND_ROADMAP.md — "no admin login or
// registration route exists anywhere"). Built deliberately security-first:
//
// - NO open/self-serve admin registration. The very first admin is created
//   via a one-time /bootstrap route that only works while zero admins
//   exist; every admin after that can only be created by an existing
//   Super Admin sending an invitation (/invite -> /register). This is the
//   standard safe pattern for privileged-account systems — anything else
//   (open registration for an admin panel) would let anyone on the
//   internet create an admin account.
// - Email verification required before an account can log in.
// - Real account lockout after repeated failed logins (reuses the Admin
//   model's own incrementLoginAttempts()/isLocked, which already existed
//   but had nothing calling them).
// - Real TOTP-based MFA (see utils/totp.js — RFC 6238, verified against
//   the official test vectors, no third-party MFA dependency) plus
//   one-time backup codes, using the Admin model's own
//   generateBackupCodes()/verifyAndUseBackupCode() methods, which also
//   already existed but had nothing calling them.
// - Short-lived admin access tokens (15 min) with a longer refresh token
//   (7 days) — deliberately much shorter than the 7-day access tokens
//   userAuth.js issues for regular users, since admin sessions carry far
//   more privilege and are worth the extra re-auth friction.
// - Tokens are set as httpOnly cookies (can't be read by page JS, unlike
//   a token a frontend would otherwise store in memory/localStorage to
//   send as a Bearer header) while the Authorization header path in
//   adminAuthentication.js still works too, for API/tooling use.
// - Every meaningful event (invite, registration, login, failed login,
//   MFA enable/disable, logout) is written to AdminAuditLog.
// - Passwords are hashed by the Admin model's own pre-save hook — this
//   file never calls bcrypt.hash on a password directly, it just assigns
//   plaintext to `.password` and lets that hook do it, so there's exactly
//   one place in the codebase that decides how admin passwords are hashed.

const express = require("express");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const { body, validationResult } = require("express-validator");

const router = express.Router();

const Admin = require("../models/Admin/Admins");
const AdminAuditLog = require("../models/Admin/AdminAuditLog");
const { authenticateAdmin } = require("../middleware/adminAuthentication");
const { generateBase32Secret, verifyTOTP, buildOtpAuthURI } = require("../utils/totp");
const { generateOTP, sendOTPEmail, sendEmail } = require("../services/emailService");

const ISSUER = "TypingGuru Admin";
const ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes — short, deliberately
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const MFA_CHALLENGE_TTL_MS = 5 * 60 * 1000; // 5 minutes to complete MFA
const INVITATION_TTL_MS = 48 * 60 * 60 * 1000; // 48 hours
const EMAIL_OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes

// ── Rate limiters ───────────────────────────────────────────────────────
const bootstrapLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: { success: false, message: "Too many attempts. Please try again later." },
});
const inviteLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: { success: false, message: "Too many invitations sent. Please slow down." },
});
const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  message: { success: false, message: "Too many attempts. Please try again later." },
});
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: "Too many login attempts. Please try again later." },
});
const otpLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 4,
  message: { success: false, message: "Too many OTP requests. Please wait before trying again." },
});
const mfaLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: "Too many verification attempts. Please try again later." },
});

// ── Shared validation ────────────────────────────────────────────────────
const passwordValidation = body("password")
  .isLength({ min: 12 })
  .withMessage("Password must be at least 12 characters long")
  .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
  .withMessage(
    "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character",
  );

const DEPARTMENTS = ["Engineering", "Sales", "Marketing", "Support", "Operations", "Finance", "HR", "Executive"];
const ROLES = ["Super Admin", "Admin", "Support", "Billing", "Read Only"];

// Sensible default permission grants per role — an invited "Support" admin
// shouldn't quietly inherit full billing/delete access just because no one
// set permissions explicitly. Super Admin gets everything; every other
// role starts read-heavy and gets escalated deliberately by a Super Admin
// later via the (existing, separate) admin-management endpoints.
function defaultPermissionsForRole(role) {
  const allTrue = {
    users: { view: true, create: true, edit: true, delete: true },
    clients: { view: true, create: true, edit: true, delete: true, suspend: true },
    billing: { view: true, create: true, edit: true, refund: true },
    settings: { view: true, edit: true },
    analytics: { view: true, export: true },
    api: { manage: true, monitor: true },
    auditLogs: { manage: true, monitor: true, edit: true, delete: true },
    activityLogs: { manage: true, monitor: true, edit: true, delete: true },
  };
  if (role === "Super Admin") return allTrue;

  const viewOnly = {
    users: { view: true, create: false, edit: false, delete: false },
    clients: { view: true, create: false, edit: false, delete: false, suspend: false },
    billing: { view: false, create: false, edit: false, refund: false },
    settings: { view: false, edit: false },
    analytics: { view: true, export: false },
    api: { manage: false, monitor: false },
    auditLogs: { manage: false, monitor: true, edit: false, delete: false },
    activityLogs: { manage: false, monitor: true, edit: false, delete: false },
  };
  if (role === "Read Only") return viewOnly;

  if (role === "Billing") {
    return {
      ...viewOnly,
      billing: { view: true, create: true, edit: true, refund: false },
    };
  }
  if (role === "Support") {
    return {
      ...viewOnly,
      users: { view: true, create: false, edit: true, delete: false },
      clients: { view: true, create: false, edit: true, delete: false, suspend: true },
    };
  }
  // "Admin" default: view-only baseline, elevated deliberately later.
  return viewOnly;
}

async function writeAuditLog({ action, adminId, status, severity = "medium", req, metadata = {} }) {
  try {
    await AdminAuditLog.create({
      action,
      adminId,
      resourceType: "admin",
      resourceId: adminId,
      ipAddress: req?.ip,
      userAgent: req?.get ? req.get("User-Agent") || "" : "",
      status,
      severity,
      metadata,
    });
  } catch (err) {
    // Audit logging must never block the actual auth flow — log and move on.
    console.error("AdminAuditLog write failed:", err.message);
  }
}

function signAccessToken(admin) {
  return jwt.sign(
    { userId: admin._id, email: admin.email, role: admin.role },
    process.env.JWT_SECRET,
    { expiresIn: "15m" },
  );
}
function signRefreshToken(admin) {
  return jwt.sign(
    { userId: admin._id, type: "refresh" },
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    { expiresIn: "7d" },
  );
}

// Issues a fresh access+refresh token pair, records them on the admin
// document (so adminAuthentication.js's revocation check has something
// real to check against), sets httpOnly cookies, and returns the tokens
// for callers that also want to return an access token in the JSON body
// (useful for Bearer-header/API use, mirroring how the middleware accepts
// either).
async function issueSession(admin, req, res) {
  const accessToken = signAccessToken(admin);
  const refreshToken = signRefreshToken(admin);
  const deviceInfo = {
    userAgent: req.headers["user-agent"],
    ipAddress: req.ip || req.connection?.remoteAddress,
  };

  admin.tokens = admin.tokens || [];
  admin.tokens.push({
    token: accessToken,
    tokenType: "access",
    expiration: new Date(Date.now() + ACCESS_TOKEN_TTL_MS),
    isActive: true,
    isBlocked: false,
    deviceInfo,
  });
  admin.tokens.push({
    token: refreshToken,
    tokenType: "refresh",
    expiration: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    isActive: true,
    isBlocked: false,
    deviceInfo,
  });
  // Keep a bounded number of sessions rather than growing forever.
  if (admin.tokens.length > 10) {
    admin.tokens = admin.tokens.slice(-10);
  }

  admin.lastLogin = new Date();
  admin.loginAttempts = 0;
  admin.lockUntil = undefined;
  await admin.save();

  res.cookie("adminAccessToken", accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: ACCESS_TOKEN_TTL_MS,
  });
  res.cookie("adminRefreshToken", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: REFRESH_TOKEN_TTL_MS,
  });

  return { accessToken, refreshToken };
}

/* ============================================================
 * BOOTSTRAP — creates exactly one Super Admin, only while zero
 * admins exist. This is the ONLY way to create the first admin;
 * every subsequent admin must go through the invite flow below.
 * ============================================================ */
router.post(
  "/bootstrap",
  bootstrapLimiter,
  [
    body("firstName").trim().isLength({ min: 1, max: 50 }),
    body("lastName").trim().isLength({ min: 1, max: 50 }),
    body("email").isEmail().normalizeEmail(),
    passwordValidation,
    body("profile.title").trim().isLength({ min: 1, max: 100 }),
    body("profile.department").isIn(DEPARTMENTS),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: "Invalid input", errors: errors.array() });
    }

    try {
      const existingCount = await Admin.countDocuments({});
      if (existingCount > 0) {
        return res.status(403).json({
          success: false,
          message: "Bootstrap is only available when no admin accounts exist yet. Ask an existing Super Admin for an invitation.",
        });
      }

      const { firstName, lastName, email, password, phoneNumber, profile } = req.body;

      const existing = await Admin.findOne({ email: email.toLowerCase() });
      if (existing) {
        return res.status(409).json({ success: false, message: "An account with this email already exists" });
      }

      const admin = new Admin({
        firstName,
        lastName,
        email: email.toLowerCase(),
        password, // hashed by the model's pre-save hook, not here
        phoneNumber,
        profile: { title: profile?.title, department: profile?.department },
        role: "Super Admin",
        permissions: defaultPermissionsForRole("Super Admin"),
        registerUsing: "registration",
        isActive: true,
        emailVerified: false,
      });
      await admin.save();

      await writeAuditLog({
        action: "admin_created",
        adminId: admin._id,
        status: "success",
        severity: "critical",
        req,
        metadata: { via: "bootstrap", role: "Super Admin" },
      });

      // Send email verification OTP immediately — login is blocked until
      // this is confirmed (see /login below).
      await sendVerificationOTP(admin, req);

      return res.status(201).json({
        success: true,
        message: "Super Admin account created. Check your email for a verification code before logging in.",
      });
    } catch (err) {
      console.error("Admin bootstrap error:", err.message);
      return res.status(500).json({ success: false, message: "Could not create admin account" });
    }
  },
);

/* ============================================================
 * INVITE — Super Admin only. Creates a pending admin record tied
 * to an email + role, with a single-use, time-limited, hashed
 * invitation token. The raw token is only ever emailed to the
 * invitee, never returned in the API response or logged.
 * ============================================================ */
router.post(
  "/invite",
  authenticateAdmin,
  inviteLimiter,
  [
    body("email").isEmail().normalizeEmail(),
    body("role").isIn(ROLES),
    body("profile.department").isIn(DEPARTMENTS),
    body("profile.title").optional().trim().isLength({ max: 100 }),
  ],
  async (req, res) => {
    if (req.admin.role !== "Super Admin") {
      return res.status(403).json({ success: false, message: "Only a Super Admin can invite new admins" });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: "Invalid input", errors: errors.array() });
    }

    try {
      const { email, role, profile } = req.body;
      const normalizedEmail = email.toLowerCase();

      const existing = await Admin.findOne({ email: normalizedEmail });
      if (existing) {
        return res.status(409).json({ success: false, message: "An account with this email already exists" });
      }

      const rawToken = crypto.randomBytes(32).toString("hex");
      const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");
      // Schema requires a password unless OAuth ids are set — this random
      // value is never communicated anywhere and is fully overwritten when
      // the invitee completes registration below.
      const placeholderPassword = crypto.randomBytes(32).toString("hex") + "Aa1!";

      const pendingAdmin = new Admin({
        firstName: "Pending",
        lastName: "Invitation",
        email: normalizedEmail,
        password: placeholderPassword,
        role,
        permissions: defaultPermissionsForRole(role),
        profile: { title: profile?.title || "", department: profile?.department },
        registerUsing: "invitation",
        invitedBy: req.admin._id,
        invitationToken: hashedToken,
        invitationExpires: new Date(Date.now() + INVITATION_TTL_MS),
        invitationAccepted: false,
        isActive: false, // cannot log in until registration is completed
        emailVerified: false,
      });
      await pendingAdmin.save();

      const acceptUrl = `${process.env.ADMIN_PANEL_URL || ""}/admin/accept-invite?token=${rawToken}`;
      await sendEmail(
        normalizedEmail,
        `You've been invited to ${ISSUER}`,
        `<p>You've been invited to join ${ISSUER} as <strong>${role}</strong>.</p>
         <p>This invitation expires in 48 hours. To accept it, use this link (or the token below) in the admin panel:</p>
         <p><a href="${acceptUrl}">${acceptUrl}</a></p>
         <p>Invitation token: <code>${rawToken}</code></p>
         <p>If you weren't expecting this, you can ignore this email.</p>`,
      ).catch((e) => console.error("Invite email send failed:", e.message));

      await writeAuditLog({
        action: "admin_invited",
        adminId: req.admin._id,
        status: "success",
        severity: "high",
        req,
        metadata: { invitedEmail: normalizedEmail, role },
      });

      return res.status(201).json({
        success: true,
        message: "Invitation sent",
        invitation: { email: normalizedEmail, role, expiresAt: pendingAdmin.invitationExpires },
      });
    } catch (err) {
      console.error("Admin invite error:", err.message);
      return res.status(500).json({ success: false, message: "Could not send invitation" });
    }
  },
);

/* ============================================================
 * REGISTER (via invitation) — the ONLY other way an admin
 * account can become usable, besides /bootstrap above.
 * ============================================================ */
router.post(
  "/register",
  registerLimiter,
  [
    body("invitationToken").isString().trim().notEmpty(),
    body("firstName").trim().isLength({ min: 1, max: 50 }),
    body("lastName").trim().isLength({ min: 1, max: 50 }),
    passwordValidation,
    body("phoneNumber").optional().matches(/^\+?[1-9]\d{1,14}$/),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: "Invalid input", errors: errors.array() });
    }

    try {
      const { invitationToken, firstName, lastName, password, phoneNumber } = req.body;
      const hashedToken = crypto.createHash("sha256").update(invitationToken).digest("hex");

      const admin = await Admin.findOne({
        invitationToken: hashedToken,
        invitationAccepted: false,
      });

      if (!admin || !admin.invitationExpires || admin.invitationExpires < new Date()) {
        return res.status(400).json({ success: false, message: "Invitation is invalid or has expired" });
      }

      admin.firstName = firstName;
      admin.lastName = lastName;
      admin.password = password; // hashed by pre-save hook
      if (phoneNumber) admin.phoneNumber = phoneNumber;
      admin.isActive = true;
      admin.invitationAccepted = true;
      admin.invitationToken = undefined;
      admin.invitationExpires = undefined;
      await admin.save();

      await writeAuditLog({
        action: "admin_invitation_accepted",
        adminId: admin._id,
        status: "success",
        severity: "high",
        req,
      });

      await sendVerificationOTP(admin, req);

      return res.status(200).json({
        success: true,
        message: "Registration complete. Check your email for a verification code before logging in.",
      });
    } catch (err) {
      console.error("Admin register error:", err.message);
      return res.status(500).json({ success: false, message: "Could not complete registration" });
    }
  },
);

/* ============================================================
 * EMAIL VERIFICATION
 * ============================================================ */
async function sendVerificationOTP(admin, req) {
  const otp = generateOTP();
  const hashedOtp = await require("bcryptjs").hash(otp, 10);

  admin.tokens = (admin.tokens || []).filter((t) => t.tokenType !== "email_verification");
  admin.tokens.push({
    token: hashedOtp,
    tokenType: "email_verification",
    expiration: new Date(Date.now() + EMAIL_OTP_TTL_MS),
    isActive: true,
    isBlocked: false,
  });
  await admin.save();

  await sendOTPEmail(admin.email, {
    name: admin.firstName,
    otp,
    website: ISSUER,
    company: ISSUER,
    expiration: 10,
    purpose: "email_verification",
  }).catch((e) => console.error("Verification OTP email send failed:", e.message));
}

router.post(
  "/send-email-otp",
  otpLimiter,
  [body("email").isEmail().normalizeEmail()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: "Valid email required" });
    }
    try {
      const admin = await Admin.findOne({ email: req.body.email.toLowerCase() });
      // Generic response either way — don't reveal whether the account exists.
      if (admin && !admin.emailVerified) {
        await sendVerificationOTP(admin, req);
      }
      return res.status(200).json({
        success: true,
        message: "If an account needs verification, a code has been sent.",
      });
    } catch (err) {
      console.error("Send email OTP error:", err.message);
      return res.status(500).json({ success: false, message: "Could not send verification code" });
    }
  },
);

router.post(
  "/verify-email",
  otpLimiter,
  [body("email").isEmail().normalizeEmail(), body("otp").isString().trim().isLength({ min: 6, max: 6 })],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: "Invalid input" });
    }
    try {
      const bcrypt = require("bcryptjs");
      const admin = await Admin.findOne({ email: req.body.email.toLowerCase() }).select("+tokens");
      if (!admin) {
        return res.status(400).json({ success: false, message: "Invalid or expired code" });
      }

      const candidates = (admin.tokens || []).filter(
        (t) => t.tokenType === "email_verification" && t.isActive && !t.isBlocked && t.expiration > new Date(),
      );

      let matched = null;
      for (const candidate of candidates) {
        if (await bcrypt.compare(req.body.otp, candidate.token)) {
          matched = candidate;
          break;
        }
      }

      if (!matched) {
        await writeAuditLog({ action: "failed_login", adminId: admin._id, status: "failure", severity: "medium", req, metadata: { step: "email_verification" } });
        return res.status(400).json({ success: false, message: "Invalid or expired code" });
      }

      matched.isActive = false; // consume it, single use
      admin.emailVerified = true;
      await admin.save();

      await writeAuditLog({ action: "email_verification", adminId: admin._id, status: "success", severity: "low", req });

      return res.status(200).json({ success: true, message: "Email verified. You can now log in." });
    } catch (err) {
      console.error("Verify email error:", err.message);
      return res.status(500).json({ success: false, message: "Could not verify email" });
    }
  },
);

/* ============================================================
 * LOGIN
 * ============================================================ */
router.post(
  "/login",
  loginLimiter,
  [body("email").isEmail().normalizeEmail(), body("password").isString().notEmpty()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: "Email and password are required" });
    }

    try {
      const { email, password } = req.body;
      const admin = await Admin.findOne({ email: email.toLowerCase() });

      // Same generic message whether the account doesn't exist or the
      // password is wrong — avoids leaking which emails have accounts.
      const genericFail = () =>
        res.status(401).json({ success: false, message: "Invalid email or password" });

      if (!admin) return genericFail();

      if (!admin.isActive || admin.isSuspended) {
        return res.status(401).json({ success: false, message: "This account is not active. Contact a Super Admin." });
      }

      if (admin.registerUsing === "invitation" && !admin.invitationAccepted) {
        return res.status(401).json({ success: false, message: "Registration is not yet complete for this account" });
      }

      if (admin.isLocked) {
        return res.status(423).json({
          success: false,
          message: "Account temporarily locked due to repeated failed login attempts. Try again later.",
        });
      }

      const isPasswordValid = await admin.comparePassword(password);
      if (!isPasswordValid) {
        await admin.incrementLoginAttempts();
        await writeAuditLog({ action: "failed_login", adminId: admin._id, status: "failure", severity: "medium", req });
        if (admin.isLocked) {
          await writeAuditLog({ action: "account_locked", adminId: admin._id, status: "success", severity: "high", req });
        }
        return genericFail();
      }

      if (!admin.emailVerified) {
        return res.status(403).json({
          success: false,
          code: "EMAIL_NOT_VERIFIED",
          message: "Please verify your email before logging in.",
        });
      }

      const mfaEnabled = !!(admin.mfa?.enabled && admin.mfa?.methods?.totp?.enabled);
      if (mfaEnabled) {
        const mfaChallengeToken = jwt.sign(
          { userId: admin._id, mfaPending: true },
          process.env.JWT_SECRET,
          { expiresIn: "5m" },
        );
        return res.status(200).json({
          success: true,
          mfaRequired: true,
          mfaChallengeToken,
          message: "Enter your authenticator code to complete login",
        });
      }

      const { accessToken } = await issueSession(admin, req, res);
      await writeAuditLog({ action: "login", adminId: admin._id, status: "success", severity: "medium", req });

      return res.status(200).json({
        success: true,
        message: "Login successful",
        admin: admin.getPublicProfile(),
        accessToken,
      });
    } catch (err) {
      console.error("Admin login error:", err.message);
      return res.status(500).json({ success: false, message: "Login failed. Please try again." });
    }
  },
);

/* ============================================================
 * MFA — verify login challenge (TOTP code or backup code)
 * ============================================================ */
router.post(
  "/mfa/verify-login",
  mfaLimiter,
  [body("mfaChallengeToken").isString().notEmpty(), body("code").isString().trim().notEmpty()],
  async (req, res) => {
    try {
      const { mfaChallengeToken, code } = req.body;
      let decoded;
      try {
        decoded = jwt.verify(mfaChallengeToken, process.env.JWT_SECRET);
      } catch {
        return res.status(401).json({ success: false, message: "MFA challenge expired. Please log in again." });
      }
      if (!decoded.mfaPending) {
        return res.status(401).json({ success: false, message: "Invalid MFA challenge" });
      }

      const admin = await Admin.findById(decoded.userId).select("+mfa.methods.totp.secret +mfa.methods.backupCodes.codes");
      if (!admin || !admin.isActive || admin.isSuspended) {
        return res.status(401).json({ success: false, message: "Account is not available" });
      }

      let verified = false;
      if (admin.mfa?.methods?.totp?.secret) {
        verified = verifyTOTP(admin.mfa.methods.totp.secret, code);
      }
      if (!verified && admin.mfa?.methods?.backupCodes?.enabled) {
        verified = await admin.verifyAndUseBackupCode(code);
      }

      if (!verified) {
        await admin.incrementLoginAttempts();
        await writeAuditLog({ action: "failed_login", adminId: admin._id, status: "failure", severity: "high", req, metadata: { step: "mfa" } });
        return res.status(401).json({ success: false, message: "Invalid or expired code" });
      }

      admin.mfa.methods.totp.lastUsed = new Date();
      admin.mfa.lastUsed = new Date();

      const { accessToken } = await issueSession(admin, req, res);
      await writeAuditLog({ action: "login", adminId: admin._id, status: "success", severity: "medium", req, metadata: { mfa: true } });

      return res.status(200).json({
        success: true,
        message: "Login successful",
        admin: admin.getPublicProfile(),
        accessToken,
      });
    } catch (err) {
      console.error("MFA verify-login error:", err.message);
      return res.status(500).json({ success: false, message: "Could not verify code" });
    }
  },
);

/* ============================================================
 * MFA — setup / confirm / disable (requires an active session)
 * ============================================================ */
router.post("/mfa/setup", authenticateAdmin, async (req, res) => {
  try {
    const admin = await Admin.findById(req.admin._id);
    const secret = generateBase32Secret();

    admin.mfa = admin.mfa || {};
    admin.mfa.methods = admin.mfa.methods || {};
    admin.mfa.methods.totp = admin.mfa.methods.totp || {};
    admin.mfa.methods.totp.secret = secret; // pending — not enabled until confirmed below
    admin.mfa.methods.totp.enabled = false;
    await admin.save();

    return res.status(200).json({
      success: true,
      secret,
      otpauthUri: buildOtpAuthURI(admin.email, ISSUER, secret),
      message: "Scan this into your authenticator app, then confirm with a code to enable MFA.",
    });
  } catch (err) {
    console.error("MFA setup error:", err.message);
    return res.status(500).json({ success: false, message: "Could not start MFA setup" });
  }
});

router.post(
  "/mfa/confirm-setup",
  authenticateAdmin,
  [body("code").isString().trim().isLength({ min: 6, max: 6 })],
  async (req, res) => {
    try {
      const admin = await Admin.findById(req.admin._id).select("+mfa.methods.totp.secret");
      if (!admin?.mfa?.methods?.totp?.secret) {
        return res.status(400).json({ success: false, message: "No MFA setup in progress. Call /mfa/setup first." });
      }

      const valid = verifyTOTP(admin.mfa.methods.totp.secret, req.body.code);
      if (!valid) {
        return res.status(400).json({ success: false, message: "Invalid code. Please try again." });
      }

      admin.mfa.methods.totp.enabled = true;
      admin.mfa.enabled = true;
      const rawBackupCodes = await admin.generateBackupCodes();
      await admin.save();

      await writeAuditLog({ action: "mfa_enabled", adminId: admin._id, status: "success", severity: "high", req });

      return res.status(200).json({
        success: true,
        message: "MFA enabled. Save these backup codes somewhere safe — they will not be shown again.",
        backupCodes: rawBackupCodes,
      });
    } catch (err) {
      console.error("MFA confirm-setup error:", err.message);
      return res.status(500).json({ success: false, message: "Could not enable MFA" });
    }
  },
);

router.post(
  "/mfa/disable",
  authenticateAdmin,
  [body("password").isString().notEmpty(), body("code").isString().trim().notEmpty()],
  async (req, res) => {
    try {
      const admin = await Admin.findById(req.admin._id).select(
        "+mfa.methods.totp.secret +mfa.methods.backupCodes.codes",
      );

      const passwordOk = await admin.comparePassword(req.body.password);
      if (!passwordOk) {
        return res.status(401).json({ success: false, message: "Incorrect password" });
      }

      let codeOk = false;
      if (admin.mfa?.methods?.totp?.secret) {
        codeOk = verifyTOTP(admin.mfa.methods.totp.secret, req.body.code);
      }
      if (!codeOk && admin.mfa?.methods?.backupCodes?.enabled) {
        codeOk = await admin.verifyAndUseBackupCode(req.body.code);
      }
      if (!codeOk) {
        return res.status(401).json({ success: false, message: "Invalid authentication code" });
      }

      admin.mfa.enabled = false;
      admin.mfa.methods.totp.enabled = false;
      admin.mfa.methods.totp.secret = undefined;
      admin.mfa.methods.backupCodes.enabled = false;
      admin.mfa.methods.backupCodes.codes = [];
      await admin.save();

      await writeAuditLog({ action: "mfa_disabled", adminId: admin._id, status: "success", severity: "critical", req });

      return res.status(200).json({ success: true, message: "MFA disabled" });
    } catch (err) {
      console.error("MFA disable error:", err.message);
      return res.status(500).json({ success: false, message: "Could not disable MFA" });
    }
  },
);

/* ============================================================
 * SESSION — refresh / logout / me
 * ============================================================ */
router.post("/refresh-token", async (req, res) => {
  try {
    const refreshToken = req.cookies?.adminRefreshToken || req.body?.refreshToken;
    if (!refreshToken) {
      return res.status(401).json({ success: false, message: "No refresh token provided" });
    }

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ success: false, message: "Refresh token is invalid or expired" });
    }

    const admin = await Admin.findById(decoded.userId);
    if (!admin || !admin.isActive || admin.isSuspended) {
      return res.status(401).json({ success: false, message: "Account is not available" });
    }

    const tokenRecord = (admin.tokens || []).find(
      (t) => t.token === refreshToken && t.tokenType === "refresh" && t.isActive && !t.isBlocked && t.expiration > new Date(),
    );
    if (!tokenRecord) {
      return res.status(401).json({ success: false, message: "Refresh token has been revoked or expired" });
    }

    const newAccessToken = signAccessToken(admin);
    admin.tokens.push({
      token: newAccessToken,
      tokenType: "access",
      expiration: new Date(Date.now() + ACCESS_TOKEN_TTL_MS),
      isActive: true,
      isBlocked: false,
      deviceInfo: {
        userAgent: req.headers["user-agent"],
        ipAddress: req.ip || req.connection?.remoteAddress,
      },
    });
    if (admin.tokens.length > 10) admin.tokens = admin.tokens.slice(-10);
    await admin.save();

    res.cookie("adminAccessToken", newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: ACCESS_TOKEN_TTL_MS,
    });

    return res.status(200).json({ success: true, accessToken: newAccessToken });
  } catch (err) {
    console.error("Admin refresh-token error:", err.message);
    return res.status(500).json({ success: false, message: "Could not refresh session" });
  }
});

router.post("/logout", authenticateAdmin, async (req, res) => {
  try {
    const admin = await Admin.findById(req.admin._id);
    if (admin) {
      const current = admin.tokens.find((t) => t.token === req.token);
      if (current) current.isBlocked = true; // actually revoked now (see middleware fix note)
      await admin.save();
      await writeAuditLog({ action: "logout", adminId: admin._id, status: "success", severity: "low", req });
    }
    res.clearCookie("adminAccessToken");
    res.clearCookie("adminRefreshToken");
    return res.status(200).json({ success: true, message: "Logged out" });
  } catch (err) {
    console.error("Admin logout error:", err.message);
    return res.status(500).json({ success: false, message: "Logout failed" });
  }
});

router.get("/me", authenticateAdmin, async (req, res) => {
  return res.status(200).json({ success: true, admin: req.admin });
});

/* ============================================================
 * INVITATION MANAGEMENT (Super Admin only)
 * ============================================================ */
router.get("/invitations", authenticateAdmin, async (req, res) => {
  if (req.admin.role !== "Super Admin") {
    return res.status(403).json({ success: false, message: "Only a Super Admin can view invitations" });
  }
  try {
    const pending = await Admin.find({
      invitationAccepted: false,
      invitationExpires: { $gt: new Date() },
    }).select("email role profile.department invitationExpires createdAt invitedBy");
    return res.status(200).json({ success: true, invitations: pending });
  } catch (err) {
    console.error("List invitations error:", err.message);
    return res.status(500).json({ success: false, message: "Could not load invitations" });
  }
});

router.post("/invitations/:id/revoke", authenticateAdmin, async (req, res) => {
  if (req.admin.role !== "Super Admin") {
    return res.status(403).json({ success: false, message: "Only a Super Admin can revoke invitations" });
  }
  try {
    const pending = await Admin.findOne({ _id: req.params.id, invitationAccepted: false });
    if (!pending) {
      return res.status(404).json({ success: false, message: "Pending invitation not found" });
    }
    await Admin.deleteOne({ _id: pending._id });
    await writeAuditLog({
      action: "admin_deleted",
      adminId: req.admin._id,
      status: "success",
      severity: "medium",
      req,
      metadata: { revokedInvitationEmail: pending.email },
    });
    return res.status(200).json({ success: true, message: "Invitation revoked" });
  } catch (err) {
    console.error("Revoke invitation error:", err.message);
    return res.status(500).json({ success: false, message: "Could not revoke invitation" });
  }
});

module.exports = router;
