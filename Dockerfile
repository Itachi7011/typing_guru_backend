# typing_guru_backend/Dockerfile
#
# Builds the API server image. See workers/Dockerfile.worker for the
# separate email-worker image — they're built from the same source tree
# but run different entrypoints and are scaled completely independently
# (see README.md "Scaling Beyond The Current Setup").

FROM node:20-alpine AS base
WORKDIR /app

# Install dependencies in their own layer so `docker build` doesn't
# reinstall ~250 packages on every source change, only when
# package*.json actually changes.
COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

# Runs as a non-root user inside the container — a compromised
# dependency or an RCE in this app shouldn't hand an attacker root
# inside the container it's running in.
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 5000

# Used by Kubernetes' own probe config (k8s/deployment-api.yaml) as the
# canonical liveness check, and useful for `docker run --health-cmd`
# too.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://localhost:'+(process.env.PORT||5000)+'/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "app.js"]
