// middleware/adminAuthentication.js
//
// Extracted verbatim from routes/admin.js's inline authenticateAdmin
// function (this was flagged as a follow-up in
// COMPETITIVE_ANALYSIS_AND_ROADMAP.md — several Phase 3/4 features
// (exam-calendar event management, subscription-plan admin CRUD) were
// left read-only specifically because this logic wasn't reusable yet).
//
// Two real bugs were found and fixed on a later pass, both documented in
// COMPETITIVE_ANALYSIS_AND_ROADMAP.md in detail:
//
// 1. The original revocation check was `!t.isRevoked` — but no `isRevoked`
//    field exists anywhere on the Admin model's `tokens` sub-schema (it has
//    `isActive`/`isBlocked` instead). `undefined` is falsy, so `!undefined`
//    was always `true`: revoking a token (e.g. on logout) could never
//    actually prevent that token from continuing to authenticate requests
//    until it naturally expired. Fixed to check the fields that actually
//    exist: `t.isActive && !t.isBlocked`.
// 2. Only `Authorization: Bearer <token>` header auth was supported. Added
//    httpOnly-cookie support as a *first-checked, more secure* option
//    (cookies aren't readable by page JavaScript, unlike a token a
//    frontend would otherwise have to keep in memory/localStorage to send
//    as a header) while keeping the header path working exactly as before
//    for any existing/future API-tooling use — this is additive, nothing
//    that worked before stopped working.

const jwt = require("jsonwebtoken");
const Admin = require("../models/Admin/Admins");

const authenticateAdmin = async (req, res, next) => {
  try {
    const token =
      req.cookies?.adminAccessToken ||
      req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Access denied. No token provided.",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const admin = await Admin.findById(decoded.userId);

    if (!admin || !admin.isActive || admin.isSuspended) {
      return res.status(401).json({
        success: false,
        message: "Token is not valid or account is inactive",
      });
    }

    // Check if token is still valid (not revoked) — see fix note (1) above.
    const tokenValid =
      admin.tokens &&
      admin.tokens.some(
        (t) =>
          t.token === token &&
          t.isActive &&
          !t.isBlocked &&
          t.expiration > new Date(),
      );
    if (!tokenValid) {
      return res.status(401).json({
        success: false,
        message: "Token has been revoked or expired",
      });
    }

    // Remove sensitive data manually before attaching to request
    const adminData = admin.toObject();
    delete adminData.password;
    delete adminData.tokens;
    delete adminData.mfa?.secret;
    delete adminData.security?.passwordHistory;

    req.admin = adminData;
    req.token = token;
    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    res.status(401).json({
      success: false,
      message: "Token is not valid",
    });
  }
};

module.exports = { authenticateAdmin };
