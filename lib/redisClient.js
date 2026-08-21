// lib/redisClient.js
//
// One shared Redis connection story for everything that wants Redis
// (BullMQ queues, the Socket.IO cross-instance adapter, the distributed
// rate limiter). Every consumer of this module is written to degrade
// gracefully — not crash — when REDIS_URL isn't set, so a small/local
// deployment (a single API process, no separate workers) keeps working
// exactly as it did before any of this existed. Redis only becomes
// load-bearing once you actually run more than one process, which is
// the point where you need it anyway. See README.md ("Scaling Beyond
// The Current Setup") for the full reasoning.

const IORedis = require('ioredis');

let client = null;
let connectionAttempted = false;

const isRedisConfigured = () => !!process.env.REDIS_URL;

// BullMQ requires `maxRetriesPerRequest: null` on the connection it's
// given (documented BullMQ requirement — without it, BullMQ's internal
// blocking commands can be silently truncated/retried in a way that
// breaks job processing). Every consumer in this app gets connections
// from this one factory so that requirement is met everywhere
// automatically, instead of every call site needing to remember it.
const getRedisClient = () => {
  if (!isRedisConfigured()) return null;
  if (client) return client;

  connectionAttempted = true;
  client = new IORedis(process.env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    lazyConnect: false,
  });

  client.on('error', (err) => {
    console.error('Redis connection error:', err.message);
  });

  return client;
};

// Creates a fresh connection rather than reusing the shared one — BullMQ
// Workers/QueueEvents each want their own dedicated connection (they use
// blocking Redis commands that would otherwise starve other consumers
// sharing the same connection).
const createRedisConnection = () => {
  if (!isRedisConfigured()) return null;
  return new IORedis(process.env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  });
};

const pingRedis = async () => {
  if (!isRedisConfigured()) return { configured: false, ok: null };
  try {
    const c = getRedisClient();
    const result = await c.ping();
    return { configured: true, ok: result === 'PONG' };
  } catch (error) {
    return { configured: true, ok: false, error: error.message };
  }
};

module.exports = {
  getRedisClient,
  createRedisConnection,
  isRedisConfigured,
  pingRedis,
};
