const jwt = require("jsonwebtoken");
const User = require("../models/User/Users"); // adjust path as needed

/* ════════════════════════════════════════════════════════════
   authMiddleware
   Reads the access token from the httpOnly "accessToken" cookie
   (set during login), falling back to the Authorization header
   for non-browser clients. Verifies the JWT, loads the user,
   and confirms the token hasn't been revoked.
   ════════════════════════════════════════════════════════════ */
const authMiddleware = async (req, res, next) => {
  try {
    // 1) Prefer the httpOnly cookie set at login
    let token = req.cookies?.accessToken;
    // 2) Fall back to Authorization: Bearer <token>
    if (!token) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith("Bearer ")) {
        token = authHeader.split(" ")[1];
      }
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Access token required",
      });
    }
        // console.log(token)

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // console.log(decoded)

    const user = await User.findOne({
      _id: decoded.userId,
      isDeleted: false,
      isActive: true,
    });


    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    // Check if this access token exists and is not revoked
    const validToken = user.tokens?.some(
      (t) => t.token === token && t.tokenType === 'access' && !t.isRevoked
    );

    if (!validToken) {
      return res.status(401).json({
        success: false,
        message: "Invalid or revoked token",
      });
    }

    // Verify the access token is still valid for this session
    if (user.tokens && user.tokens.length) {
      const tokenExists = user.tokens.some(
        (t) => t.token === token && !t.isRevoked,
      );
      if (!tokenExists && user.currentAccessToken !== token) {
        return res.status(401).json({
          success: false,
          message: "Invalid or revoked token",
        });
      }
    }

    req.user = user;
    req.token = token;
    
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
};

module.exports = { authMiddleware };