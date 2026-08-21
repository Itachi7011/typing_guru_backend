// app.js
const express = require('express');
const app = express();
require('dotenv').config({ quiet: true });
const http = require('http');
const mongoose = require('mongoose');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const hpp = require('hpp');
const compression = require('compression');
const passport = require('passport');
const cookieParser = require('cookie-parser');
const { initSocket } = require('./sockets');
const { isRedisConfigured, getRedisClient, pingRedis } = require('./lib/redisClient');

const PORT = process.env.PORT || 5000;

require("./scheduler/cleanupAccounts");

const UserAuthRoutes = require('./routes/userAuth');
const UserProfileRoutes = require('./routes/userProfile');
const LeaderboardRoutes = require('./routes/leaderboard');
const ExamCalendarRoutes = require('./routes/examCalendar');
const SubscriptionPlansRoutes = require('./routes/subscriptionPlans');
const { router: SubscriptionRoutes, handleWebhook: stripeWebhookHandler } = require('./routes/subscription');
const AdminAuthRoutes = require('./routes/adminAuth');
// NOTE: routes/admin.js is intentionally NOT required/mounted here. It's a
// ~1,000-line file covering system stats, file-watching (chokidar), and
// several child_process.exec() calls (process list, npm audit, log
// tailing, `who`) that haven't been reviewed line-by-line for production
// exposure. It was fixed (a real duplicate-identifier SyntaxError that
// prevented it from loading at all was found and corrected — see
// COMPETITIVE_ANALYSIS_AND_ROADMAP.md) and verified to require() cleanly
// in isolation, but fixing a blocking bug isn't the same thing as a
// security review, and there's currently no working admin login route
// anyway (see the same doc) — so mounting it wouldn't expose anything
// reachable yet regardless. Deliberately left unmounted pending a proper
// review + the admin-auth design decision.

// ============ CORS Configuration ============
const isDevelopment = process.env.NODE_ENV === 'development';

// Get frontend URL based on environment
const getFrontendURL = () => {
  if (isDevelopment) {
    return process.env.DEVELOPMENT_BASE_FRONTEND_URL || 'http://localhost:5173';
  } else {
    return process.env.PRODUCTION_BASE_FRONTEND_URL || process.env.CLIENT_URL || 'https://typingexamhub.netlify.';
  }
};

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, or server-to-server)
    if (!origin) {
      return callback(null, true);
    }
    
    const allowedOrigin = getFrontendURL();
    
    // In development, allow any localhost for convenience
    if (isDevelopment) {
      const isLocalhost = origin.match(/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/);
      if (isLocalhost || origin === allowedOrigin) {
        return callback(null, true);
      }
    }
    
    // In production, only allow specific origin
    if (origin === allowedOrigin) {
      return callback(null, true);
    }
    
    console.log('CORS blocked origin:', origin);
    callback(new Error(`Origin ${origin} not allowed by CORS`));
  },
  credentials: true, // Allow cookies to be sent
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Set-Cookie'],
  maxAge: 86400 // 24 hours
};

// Apply CORS middleware
app.use(cors(corsOptions));

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" }
}));

app.use(cookieParser());
app.use(passport.initialize());

// Stripe webhook — MUST be mounted with express.raw() and BEFORE
// express.json() below. Stripe's signature verification
// (stripe.webhooks.constructEvent in routes/subscription.js) needs the
// exact raw bytes of the request body; once express.json() has parsed
// and re-serialized it, the signature no longer matches. Also mounted
// ahead of the rate limiter — this is a server-to-server callback from
// Stripe (which retries aggressively on failure), not end-user traffic,
// so it shouldn't share a budget with the public API.
app.post(
  '/api/subscription/webhook',
  express.raw({ type: 'application/json' }),
  stripeWebhookHandler,
);

// Prometheus metrics setup — the timing middleware below must be
// mounted BEFORE the API routes so it actually wraps them (Express
// middleware only applies to routes registered after it). The /metrics
// scrape endpoint itself is registered further down with the other
// simple routes; only the collection wiring needs to live here.
const promClient = require('prom-client');
const metricsRegistry = new promClient.Registry();
promClient.collectDefaultMetrics({ register: metricsRegistry });

const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  registers: [metricsRegistry],
});

app.use((req, res, next) => {
  const end = httpRequestDuration.startTimer();
  res.on('finish', () => {
    // req.route?.path gives the matched route pattern (e.g.
    // "/api/user/:id") rather than the raw URL, so metrics don't
    // explode into one series per unique id/value.
    end({
      method: req.method,
      route: req.route?.path || req.baseUrl || 'unmatched',
      status_code: res.statusCode,
    });
  });
  next();
});

// Rate limiting
//
// WHY REDIS-BACKED: express-rate-limit's default store is in-memory,
// scoped to a single Node process. Run more than one API replica behind
// a load balancer and each replica independently allows 100 req/15min
// per IP — so the EFFECTIVE limit becomes 100 × (number of replicas),
// silently, since nothing errors. That's exactly backwards for a limit
// meant to survive a traffic spike: it gets weaker the more you scale
// out to handle one. Backing the store with Redis makes the limit a
// single shared counter across every replica regardless of which one an
// individual request lands on. Falls back to the in-memory store
// (today's exact behavior) when REDIS_URL isn't set.
const rateLimitStore = (() => {
  if (!isRedisConfigured()) return undefined;
  const RedisStore = require('rate-limit-redis').default;
  return new RedisStore({
    sendCommand: (...args) => getRedisClient().call(...args),
  });
})();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  ...(rateLimitStore ? { store: rateLimitStore } : {}),
});

app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Prevent parameter pollution
app.use(hpp());

// Compression
app.use(compression());

// Routes
app.use('/api/user/auth', UserAuthRoutes);
app.use('/api/user/profile', UserProfileRoutes);
app.use('/api/leaderboard', LeaderboardRoutes);
app.use('/api/exam-calendar', ExamCalendarRoutes);
app.use('/api/subscription-plans', SubscriptionPlansRoutes);
app.use('/api/subscription', SubscriptionRoutes);
app.use('/api/admin/auth', AdminAuthRoutes);

// Test route to check CORS
app.get('/api/test-cors', (req, res) => {
  console.log('✅ CORS TEST: Request reached the server');
  res.json({
    success: true,
    message: 'CORS is working correctly',
    origin: req.headers.origin,
    environment: process.env.NODE_ENV,
    cookies: req.cookies ? 'Cookies received' : 'No cookies'
  });
});

app.get('/api/test', (req, res) => {
  res.send("Successfully reaches");
});

// Health check endpoint (liveness — "is the process up at all", no
// dependency checks; keep this cheap and dependency-free since it's
// polled frequently)
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});

// Readiness check — checks the dependencies this process actually needs
// to serve real traffic correctly (MongoDB, and Redis if configured).
// Distinct from /health above on purpose: in Kubernetes, a liveness
// probe failing restarts the pod; a readiness probe failing just pulls
// it out of the load-balancer rotation without restarting it. A pod
// whose Mongo connection dropped shouldn't be killed and restarted
// (that wouldn't fix a network partition) — it should stop receiving
// new traffic until the connection recovers, which is exactly what a
// readiness probe hitting this route does. See k8s/deployment-api.yaml.
app.get('/health/ready', async (req, res) => {
  const mongoState = mongoose.connection.readyState; // 1 = connected
  const mongoOk = mongoState === 1;
  const redis = await pingRedis();
  // Redis is optional infrastructure (see lib/redisClient.js) — only
  // fail readiness on Redis if it's actually configured for this
  // deployment and unreachable, not merely because it's unset.
  const redisOk = !redis.configured || redis.ok;

  const ready = mongoOk && redisOk;
  res.status(ready ? 200 : 503).json({
    status: ready ? 'ready' : 'not_ready',
    mongo: { connected: mongoOk, readyState: mongoState },
    redis,
    timestamp: new Date().toISOString(),
  });
});

// Prometheus metrics — scraped by Prometheus/Grafana Cloud/whatever's
// collecting metrics in your deployment, and is also what a Kubernetes
// HPA using custom metrics (rather than plain CPU%) or KEDA's Prometheus
// scaler would read from. See README.md "Scaling Beyond The Current
// Setup" and k8s/ for how this plugs into autoscaling decisions.
// (Collection wiring — the Registry, default metrics, and the timing
// middleware — lives earlier in this file, mounted before the API
// routes so it actually captures them; see the comment there.)
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', metricsRegistry.contentType);
  res.end(await metricsRegistry.metrics());
});

// Request logger middleware (place after CORS)
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url} - Origin: ${req.headers.origin || 'No origin'}`);
  next();
});

// // 404 handler
// app.use('*', (req, res) => {
//   res.status(404).json({
//     status: 'error',
//     message: `Can't find ${req.originalUrl} on this server!`
//   });
// });

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({
      success: false,
      message: 'CORS error: Origin not allowed'
    });
  }
  
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI, {
}).then(() => {
  console.log('Connected to MongoDB');
}).catch(err => {
  console.error('MongoDB connection error:', err);
  process.exit(1);
});

// Start server
const server = http.createServer(app);

// Real-time layer (see sockets/index.js). Reuses the same CORS origin
// resolution as the REST API's `corsOptions.origin` above, but Socket.IO
// wants a plain string/array/function rather than the `(origin, cb)`
// verifier shape `cors()` expects, so it's simplest to just pass the
// resolved origin through directly.
initSocket(server, {
  origin: isDevelopment
    ? [getFrontendURL(), /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/]
    : getFrontendURL(),
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
//   console.log(`Environment: ${process.env.NODE_ENV}`);
//   console.log(`CORS allowed origin: ${getFrontendURL()}`);
});

// Graceful shutdown — matters once this runs in Kubernetes/behind an
// autoscaler (see README.md "Scaling Beyond The Current Setup"): a
// normal scale-down or rolling deploy sends SIGTERM and then waits
// (Kubernetes' default terminationGracePeriodSeconds is 30s) before
// force-killing the process. Without a SIGTERM handler, Node's default
// behavior on SIGTERM is to exit immediately — dropping any in-flight
// HTTP request or open WebSocket connection mid-response. This instead:
// stops accepting new connections, lets existing ones finish/close, and
// only then exits, so a scale-down event (which will become routine
// once autoscaling is in place) doesn't look like an outage to users.
let shuttingDown = false;
const shutdown = async (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received: closing HTTP server and connections gracefully...`);

  const forceExitTimer = setTimeout(() => {
    console.error('Graceful shutdown timed out after 25s, forcing exit.');
    process.exit(1);
  }, 25000);
  forceExitTimer.unref();

  server.close(async () => {
    try {
      // Only wait on closing an actually-live connection (readyState 1).
      // A connection stuck in "connecting" (2) — which happens if Mongo
      // was unreachable at startup — can otherwise leave close() waiting
      // on the driver's server-selection timeout (default up to 30s)
      // before resolving, needlessly eating into the grace period below
      // for a connection that was never doing useful work anyway.
      if (mongoose.connection.readyState === 1) {
        await mongoose.connection.close(false);
      }
    } catch (error) {
      console.error('Error closing MongoDB connection:', error.message);
    }
    clearTimeout(forceExitTimer);
    console.log('Shutdown complete.');
    process.exit(0);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = app;