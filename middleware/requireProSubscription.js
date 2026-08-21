// middleware/requireProSubscription.js
//
// Gates advanced features behind an active Pro subscription. Must run
// AFTER authMiddleware (needs req.user). Usage:
//   router.get('/advanced-analytics', authMiddleware, requireProSubscription, handler)

const requireProSubscription = (req, res, next) => {
  const sub = req.user?.subscription;
  const isEntitled = sub?.plan === "pro" && ["active", "trialing"].includes(sub?.status);

  if (!isEntitled) {
    return res.status(402).json({
      success: false,
      message: "This feature requires a Pro subscription.",
      upgradeUrl: "/user/subscription",
    });
  }

  next();
};

module.exports = { requireProSubscription };
