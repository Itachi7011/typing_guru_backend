// workers/emailWorker.js
//
// A standalone process — NOT started by app.js, run separately (see
// package.json's "worker" script, the Dockerfile.worker, and
// docker-compose.yml). This is the piece that answers "what handles it
// when load increases beyond what the always-on setup handles": rather
// than running N worker processes 24/7 sized for peak load, this worker
// image is deployed as a Kubernetes Deployment scaled by a KEDA
// ScaledObject (k8s/keda-scaledobject-email-worker.yaml) that watches
// the BullMQ queue's depth in Redis and scales replicas from 0 up to a
// configured max as jobs pile up, then back down to 0 once the queue
// drains — genuinely idle (zero running pods, zero cost) when there's
// nothing to do, and automatically multiplying capacity when there is.
//
// Run locally with: npm run worker  (requires REDIS_URL and the same
// SendGrid/Mongo env vars the API uses, since the actual email sending
// still goes through services/emailService.js).

require('dotenv').config({ quiet: true });
const { Worker } = require('bullmq');
const { createRedisConnection, isRedisConfigured } = require('../lib/redisClient');
const emailService = require('../services/emailService');
const { QUEUE_NAME } = require('../queues/emailQueue');

if (!isRedisConfigured()) {
  console.error(
    'workers/emailWorker.js: REDIS_URL is not set. This worker has nothing ' +
      'to consume from without Redis — without it, routes/userAuth.js sends ' +
      'emails inline instead (see queues/emailQueue.js), so this process is ' +
      'not needed for that deployment. Exiting.',
  );
  process.exit(1);
}

// How many jobs this single worker PROCESS handles at once. This is
// per-process concurrency (cheap, in-process parallelism for I/O-bound
// SendGrid calls); scaling the number of worker PROCESSES/pods is the
// separate, coarser lever KEDA controls based on queue depth. Tune
// concurrency for one pod's CPU/memory budget; tune KEDA's maxReplicas
// for how many pods you're willing to run at once.
const CONCURRENCY = parseInt(process.env.EMAIL_WORKER_CONCURRENCY || '5', 10);

const processEmailJob = async (job) => {
  const { email, context } = job.data;

  switch (job.name) {
    case 'registration_otp':
      return emailService.sendUserRegistrationOTP(email, context);
    case 'otp':
      return emailService.sendOTPEmail(email, context);
    case 'welcome':
      return emailService.sendWelcomeEmail(email, context);
    default:
      throw new Error(`Unknown email job type: ${job.name}`);
  }
};

const worker = new Worker(QUEUE_NAME, processEmailJob, {
  connection: createRedisConnection(),
  concurrency: CONCURRENCY,
});

worker.on('completed', (job) => {
  console.log(`[emailWorker] sent "${job.name}" to job ${job.id}`);
});

worker.on('failed', (job, err) => {
  console.error(`[emailWorker] job ${job?.id} (${job?.name}) failed:`, err.message);
});

console.log(`[emailWorker] listening on queue "${QUEUE_NAME}" with concurrency ${CONCURRENCY}`);

// Graceful shutdown: let in-flight jobs finish instead of dropping them
// mid-send when Kubernetes sends SIGTERM during a scale-down (this is
// exactly what happens routinely once KEDA is scaling this worker up
// and down — a scale-down is a normal event, not a crash, and shouldn't
// lose an email that was already being sent).
const shutdown = async (signal) => {
  console.log(`[emailWorker] received ${signal}, closing gracefully...`);
  await worker.close();
  process.exit(0);
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = worker;
