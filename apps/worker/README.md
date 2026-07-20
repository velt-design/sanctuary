# Sanctuary Background Worker

This Node 22 application is the server-owned runtime for durable technical background jobs. It communicates with Supabase only through the explicit background-job RPC allowlist. It does not import portal or marketing application code, and its logs and health responses contain safe operational metadata only.

JOB-02 installs the runtime dark by default. A repository build does not enable a producer, a handler, a shared database migration, or a rollout.

The JOB-02 handler registry is intentionally empty. `active`, `once`, and `drain` fail before claiming while handler coverage is incomplete; only `dark`, `reconcile`, and aggregate health inspection are runnable until later checkpoints migrate domain handlers and their producers together.

## Commands

Run commands from the repository root:

```bash
npm run dev:worker
npm run test:worker
npm run build:worker
npm run start:worker
npm run worker:once
npm run worker:drain
npm run worker:reconcile
npm run worker:queue-health
```

`once` processes at most one claimed batch. `drain` continues claiming already accepted work and remains alive across delayed retries until the queued, retrying, and active backlog is terminal or needs attention; the enqueue kill switch is owned at producer command boundaries. `reconcile` repairs queue/ledger drift without dispatching domain effects. `queue-health` prints only aggregate safe metrics. `SIGTERM` and `SIGINT` stop new claims and allow active work to finish within the configured grace period.

## Environment contract

Required for every database-backed command:

- `SUPABASE_URL`: server-side Supabase project or local-stack URL.
- `SUPABASE_SERVICE_ROLE_KEY`: service-role credential. Keep it in the hosting secret store; never pass it as a CLI argument or write it to logs.

Safety and identity:

- `BACKGROUND_JOBS_WORKER_MODE`: `dark` (default), `active`, `once`, `drain`, or `reconcile`.
- `BACKGROUND_JOBS_WORKER_ACTIVE_ENABLED`: must be exactly `true` before `active`, `once`, or `drain` may execute jobs. It defaults to `false`.
- `BACKGROUND_JOBS_WORKER_ID`: optional safe worker/replica prefix of at most 91 characters. The process always appends a random per-boot UUID so restarted or overlapping workers have distinct health and lease-owner identities; without a prefix it derives one from host and PID.
- `BACKGROUND_JOBS_WORKER_BUILD_VERSION`: safe deployment identifier; defaults to `local`. Prefix commit hashes (for example `git-<sha>`) so a bare long hex value is not mistaken for secret material.

Runtime bounds:

- `BACKGROUND_JOBS_WORKER_GLOBAL_CONCURRENCY` (default `4`, range `1..100`).
- `BACKGROUND_JOBS_WORKER_CONCURRENCY_BY_CLASS`: comma-separated limits such as `email=2,documents=1`.
- `BACKGROUND_JOBS_WORKER_CONCURRENCY_BY_KIND`: comma-separated limits such as `quote_send=2,job_pack_generate=1`.
- `BACKGROUND_JOBS_WORKER_CLAIM_BATCH_SIZE` (default: global concurrency, range `1..100`).
- `BACKGROUND_JOBS_WORKER_VISIBILITY_TIMEOUT_SECONDS` (default `120`, range `15..3600`).
- `BACKGROUND_JOBS_WORKER_HEARTBEAT_INTERVAL_MS` (default `30000`; cannot exceed one third of visibility timeout).
- `BACKGROUND_JOBS_WORKER_RECORD_HEARTBEAT_INTERVAL_MS` (default `15000`, range `1000..60000`).
- `BACKGROUND_JOBS_WORKER_POLL_INTERVAL_MS` (default `1000`, range `100..60000`).
- `BACKGROUND_JOBS_WORKER_RECONCILIATION_INTERVAL_MS` (default `60000`, range `1000..3600000`).
- `BACKGROUND_JOBS_WORKER_RECONCILIATION_LIMIT` (default `500`, range `1..5000`).
- `BACKGROUND_JOBS_WORKER_SHUTDOWN_GRACE_MS` (default `30000`, range `1000..300000`).
- `BACKGROUND_JOBS_WORKER_ABORT_SETTLE_GRACE_MS` (default `5000`, range `100..60000`) bounds how long an aborted handler may settle before the worker reports unhealthy and exits for lease-based recovery.
- `BACKGROUND_JOBS_WORKER_RPC_TIMEOUT_MS` (default `15000`, range `1000..60000`).

The visibility timeout must be strictly greater than the job-heartbeat interval plus RPC timeout plus abort-settlement grace plus a fixed five-second termination margin. This keeps a heartbeat-loss hard exit ahead of lease and PGMQ visibility expiry; unsafe low-visibility combinations fail during startup.

The worker-record heartbeat also reserves two RPC timeouts and the same five-second margin inside the database's two-minute stale-worker threshold. Configurations that could report a live process as stale fail before startup.

On confirmed lease-heartbeat loss the runtime stops claiming and aborts the handler. If the handler ignores abort past the settlement grace, the CLI emits only a fixed safe error code and terminates the process immediately; it never leaves an unhealthy health-server-only process alive until another worker can reclaim the lease. The production supervisor must restart non-zero exits.

Health server:

- `BACKGROUND_JOBS_WORKER_HEALTH_HOST` (default `0.0.0.0`).
- `BACKGROUND_JOBS_WORKER_HEALTH_PORT` (default `8080`).
- `GET /livez` reports that the process is serving.
- `GET /readyz` reports cached runtime/database readiness and returns `503` until ready. Health requests never query Supabase or trigger work.

## Local development

Use only an isolated local Supabase/PGMQ stack with the ordered background-job migrations applied. Keep the worker in `dark` mode while checking connectivity and aggregate metrics. Set the active gate only when intentionally exercising test jobs whose handlers and payloads are safe for that isolated environment. Repository tests do not send real email.

## Container and production hosting

Build from the repository root so the worker and shared `@sp/jobs` source are present:

```bash
docker build -f apps/worker/Dockerfile -t sanctuary-background-worker .
```

The final image contains the bundled worker artifact, runs as the non-root `node` user, and exposes port `8080`. A production host must provide durable process supervision, the two required Supabase secrets, an immutable build version, and HTTP liveness/readiness checks. Its termination window must exceed shutdown grace plus abort-settlement grace plus two RPC timeouts and the five-second safety margin (70 seconds with defaults), leaving time for cooperative handler settlement and final heartbeat/state writes. An abort-ignoring handler causes the worker to exit after the settlement grace; the supervisor's termination deadline remains a backstop, and recovery must still wait for lease expiry plus provider-idempotency policy. Deploy dark first and verify migrations, RPC reachability, worker heartbeats, queue metrics, and zero claims before any separately reviewed rollout change.
