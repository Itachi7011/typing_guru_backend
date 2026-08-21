// queues/emailQueue.js
//
// WHY THIS EXISTS (see README.md "Scaling Beyond The Current Setup"):
// routes/userAuth.js previously called `await sendOTPEmail(...)` /
// `await sendUserRegistrationOTP(...)` directly inside the signup,
// resend-OTP, and forgot-password request handlers. That means every one
// of those HTTP requests stayed open — tying up an Express request
// handler and, transitively, an event-loop turn — for as long as
// SendGrid's API took to respond, and a SendGrid slowdown or outage
// would directly slow down or fail user signup/login. Under real load
// (a traffic spike, or SendGrid itself being slow) this is exactly the
// kind of synchronous work that should move off the request path.
//
// This module moves it into a BullMQ queue backed by Redis: the request
// handler enqueues a job and returns immediately; a separate worker
// process (workers/emailWorker.js) — which can be scaled independently
// of the API, including down to zero when idle, see the KEDA
// ScaledObject in k8s/ — actually calls SendGrid and retries on
// transient failure.
//
// GRACEFUL DEGRADATION: if REDIS_URL isn't set (e.g. running this repo
// locally without the optional scaling infrastructure), `enqueueEmail`
// falls straight through to calling the email service inline — exactly
// today's behavior — instead of throwing. Nothing about local dev or a
// small single-process deployment changes unless you opt in by setting
// REDIS_URL.

const { Queue } = require('bullmq');
const { createRedisConnection, isRedisConfigured } = require('../lib/redisClient');
const emailService = require('../services/emailService');

const QUEUE_NAME = 'email';

let emailQueue = null;
if (isRedisConfigured()) {
  emailQueue = new Queue(QUEUE_NAME, {
    connection: createRedisConnection(),
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: { age: 24 * 3600, count: 1000 },
      removeOnFail: { age: 7 * 24 * 3600 },
    },
  });
}

// type must match a case in workers/emailWorker.js's switch statement.
const enqueueEmail = async (type, email, context) => {
  if (emailQueue) {
    try {
      await emailQueue.add(type, { email, context });
      return true;
    } catch (error) {
      console.error(`Failed to enqueue "${type}" email job:`, error.message);
      return false;
    }
  }

  // No Redis configured — send inline, synchronously, same as before
  // this queue existed.
  try {
    switch (type) {
      case 'registration_otp':
        return await emailService.sendUserRegistrationOTP(email, context);
      case 'otp':
        return await emailService.sendOTPEmail(email, context);
      case 'welcome':
        return await emailService.sendWelcomeEmail(email, context);
      default:
        console.error(`enqueueEmail: unknown email type "${type}"`);
        return false;
    }
  } catch (error) {
    console.error(`Inline send for "${type}" email failed:`, error.message);
    return false;
  }
};

module.exports = { enqueueEmail, emailQueue, QUEUE_NAME };
