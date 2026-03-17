# Monitoring & Observability Guide

This document describes the observability stack added to the OrkenAI backend before production deployment, explains what data is collected, how to run the stack, and provides step-by-step incident-analysis scenarios.

---

## Stack Overview

| Concern | Tool | Port |
|---|---|---|
| Metrics scraping | **Prometheus** | 9090 |
| Alerting | **Alertmanager** | 9093 |
| Log aggregation | **Loki** | 3100 |
| Log collection | **Promtail** | 9080 |
| Distributed tracing | **Grafana Tempo** | 3200 / 4317 (OTLP gRPC) |
| Visualisation | **Grafana** | 3000 |
| Postgres metrics | postgres-exporter | 9187 |
| Redis metrics | redis-exporter | 9121 |
| Host metrics | node-exporter | 9100 |

### Architecture diagram

```
FastAPI ─── /metrics ─────────────────► Prometheus ──► Alertmanager
   │                                         │
   │  stdout JSON logs                       │  (rules, alerts)
   ▼                                         │
Docker log driver ──► Promtail ──► Loki      │
                                    │        ▼
FastAPI ── OTLP gRPC ──► Tempo      └──► Grafana
  (traces)                  │          (Prometheus + Loki + Tempo
                            └──────────  datasources, 3 dashboards)

Postgres ─► postgres-exporter ─► Prometheus
Redis    ─► redis-exporter    ─► Prometheus
Host     ─► node-exporter     ─► Prometheus
```

---

## Running the Full Stack (local)

```bash
# From the backend/ directory
docker compose up -d

# Grafana: http://localhost:3030  (admin / changeme)
# Prometheus: http://localhost:9090
# Alertmanager: http://localhost:9093
```

> Change the Grafana admin password by editing `monitoring/grafana/grafana.env`
> before deploying to production.

---

## Running on STAGING / PROD server

On the staging server the application is deployed via `compose.yaml` in
`/opt/app-staging` and the monitoring stack runs side-by-side with the API,
frontend, nginx and RabbitMQ.

### Layout on the server

- `/opt/app-staging/compose.yaml` – main docker compose for the whole stack
- `/opt/app-staging/.env` – backend environment variables
- `/opt/app-staging/monitoring/...` – all monitoring configs copied from
  `backend/monitoring` in the repository:
  - `prometheus/prometheus.yml`
  - `prometheus/rules/api_alerts.yml`
  - `alertmanager/alertmanager.yml`
  - `loki/loki.yml`
  - `promtail/promtail.yml`
  - `grafana/grafana.env`
  - `grafana/provisioning/...`
  - `grafana/dashboards/*.json`

To update monitoring on the server:

1. From local repo (backend root):

   ```bash
   cd backend
   scp -i ~/.ssh/ci_staging -r monitoring root@<staging-host>:/opt/app-staging/
   ```

2. On the server:

   ```bash
   cd /opt/app-staging
   docker compose up -d
   ```

### Accessing Grafana and Prometheus via SSH tunnel

The monitoring web UIs are not exposed directly to the internet; they are
reachable only from inside the server. To view them from your laptop, create
an SSH tunnel:

```bash
ssh -i ~/.ssh/ci_staging \
  -L 3030:localhost:3030 \
  -L 9090:localhost:9090 \
  root@<staging-host>
```

While this SSH session is open:

- Grafana: `http://localhost:3030`
- Prometheus: `http://localhost:9090`

Use the same Grafana credentials as defined in `monitoring/grafana/grafana.env`
on the server.

---

## What Is Collected

### Application logs (`app/core/logging.py`)

Every log record is emitted as **structured JSON** to stdout and picked up by
Promtail.  Each record contains:

| Field | Description |
|---|---|
| `asctime` | ISO-8601 timestamp |
| `levelname` | `DEBUG` / `INFO` / `WARNING` / `ERROR` |
| `name` | Logger name (Python module path) |
| `message` | Human-readable message |
| `request_id` | UUID hex generated per HTTP request |
| `user_id` | Authenticated user id (when available) |
| `trace_id` | OTEL trace id (when tracing is enabled) |
| `span_id` | OTEL span id (when tracing is enabled) |
| `http_method` | HTTP verb (on request-log records) |
| `http_path` | URL path |
| `http_status` | Response status code |
| `duration_ms` | Request duration in milliseconds |

The `request_id` is also returned to the client as the `X-Request-ID`
response header, making it easy to correlate a user-reported error with the
corresponding log lines.

### Prometheus metrics (`app/core/metrics.py`)

#### Auto-collected (prometheus-fastapi-instrumentator)

| Metric | Description |
|---|---|
| `http_requests_total` | Request count by handler, method, status |
| `http_request_duration_seconds` | Latency histogram |

#### Application business metrics

| Metric | Labels | Description |
|---|---|---|
| `llm_requests_total` | `model`, `operation` | LLM API calls |
| `llm_errors_total` | `model`, `operation` | Failed LLM calls |
| `llm_tokens_total` | `model`, `type` | Tokens consumed (prompt/completion) |
| `auth_events_total` | `event`, `status` | Login/register/otp/token-refresh events |
| `cache_operations_total` | `operation`, `result` | Redis hit/miss/error counts |
| `video_jobs_total` | `status` | Video-render job lifecycle |

To record a business metric from application code:

```python
from app.core.metrics import auth_events_total

auth_events_total.labels(event="login", status="success").inc()
```

### Alerts (`monitoring/prometheus/rules/api_alerts.yml`)

| Alert | Condition | Severity |
|---|---|---|
| `HighHttp5xxRate` | > 1% of requests return 5xx over 5 min | critical |
| `HighApiLatency` | p95 latency > 2 s over 5 min | warning |
| `ApiDown` | FastAPI scrape target unreachable > 1 min | critical |
| `PostgresDown` | Postgres exporter unreachable > 1 min | critical |
| `RedisDown` | Redis exporter unreachable > 1 min | critical |
| `HighMemoryUsage` | Host memory > 80% for 5 min | warning |
| `HighCpuUsage` | Host CPU > 80% for 5 min | warning |
| `DiskNearlyFull` | Filesystem > 85% full for 5 min | warning |
| `HighLlmErrorRate` | > 10% of LLM calls failing over 5 min | warning |

To wire up notifications (Telegram/Slack/email) edit
`monitoring/alertmanager/alertmanager.yml` and fill in the receiver block.

---

## Grafana Dashboards

Three dashboards are auto-provisioned at startup:

| Dashboard | UID | What it shows |
|---|---|---|
| **FastAPI Overview** | `fastapi-overview` | RPS, error rate, latency percentiles, top endpoints, LLM calls, auth events |
| **Infrastructure** | `infrastructure` | Host CPU/memory/network, Postgres TPS/cache-hit/deadlocks, Redis clients/memory/hit-rate |
| **Application Logs** | `app-logs` | Full Loki log stream with level filter and log-volume chart |

All dashboards live in `monitoring/grafana/dashboards/` as JSON and are
version-controlled so they are reproducible across environments.

---

## Distributed Tracing (OpenTelemetry)

When the environment variable `OTEL_EXPORTER_OTLP_ENDPOINT` is set, the
application instruments itself with OpenTelemetry:

- **FastAPI** HTTP spans are auto-created via `FastAPIInstrumentor`.
- **SQLAlchemy** queries are instrumented via `SQLAlchemyInstrumentor`.
- **Redis** calls are instrumented via `RedisInstrumentor`.
- The `trace_id` of the active span is injected into every log record,
  allowing you to jump from a Loki log line directly to the corresponding
  Tempo trace in Grafana.

In the Docker Compose stack the OTLP endpoint is `http://tempo:4317` and the
service name is `fastapi-backend`.  To disable tracing locally, simply unset
or remove `OTEL_EXPORTER_OTLP_ENDPOINT`.

---

## Incident Analysis Scenarios

### Scenario 1 — Investigating a spike of 500 errors

1. Open **Grafana → FastAPI Overview**.
2. Look at the *Error Rate (5xx)* stat panel and the *Request Rate by Status*
   chart to identify when the spike started and which endpoints are affected.
3. Note the time range of the spike.
4. Switch to **Application Logs** dashboard, filter
   `{job="docker"} |= "ERROR"` in the Loki query, and narrow the time range.
5. Expand an error record — copy the `request_id`.
6. Search Loki for `{job="docker"} |= "<request_id>"` to see the full
   request trace (all log lines sharing the same `request_id`).
7. If tracing is enabled, copy the `trace_id` from the log record and open
   Grafana → Explore → Tempo to see the full distributed trace with span
   timings for each DB query and Redis call.

### Scenario 2 — Slow API responses

1. Open **FastAPI Overview** → *p95 Latency* stat and *Latency Percentiles*
   chart.
2. Note which endpoints are slow via *Top Endpoints by RPS* (sort by latency
   in Prometheus or switch to a table panel).
3. Open **Infrastructure** → *Postgres — Transactions per Second* and *Cache
   Hit Ratio* to check whether the database is under pressure.
4. Check *Redis — Commands per Second* and *App Cache Operations* to see
   whether cache is being used effectively.
5. If tracing is enabled, find a slow trace in Tempo (filter by
   `duration > 1s`) and inspect which span (DB query, Redis call, LLM call)
   takes the longest.

### Scenario 3 — Database/Redis outage

1. Alertmanager fires `PostgresDown` or `RedisDown`.
2. Open **Infrastructure** dashboard and check the *Service Up* indicators.
3. Check Prometheus → Targets (`/targets` page) to confirm the exporter is
   unreachable.
4. SSH to the host, run `docker compose ps` to see container status.
5. Run `docker compose logs db` or `docker compose logs redis` to inspect
   container logs for crash reasons.
6. After restoring the service, confirm metrics resume in Grafana and the
   alert resolves.

### Scenario 4 — LLM cost runaway

1. Open **FastAPI Overview** → *LLM Requests by Operation* chart.
2. Check `llm_tokens_total` metric in Prometheus to see token consumption
   per model per type (prompt vs completion).
3. If `HighLlmErrorRate` alert fired, check Application Logs for
   `"operation": "..."` records at ERROR level to understand which LLM
   operation is failing and why (quota exceeded, timeout, etc.).

---

## Configuration Reference

| File | Purpose |
|---|---|
| `monitoring/prometheus/prometheus.yml` | Scrape targets and alerting |
| `monitoring/prometheus/rules/api_alerts.yml` | Alert rules |
| `monitoring/alertmanager/alertmanager.yml` | Notification routing |
| `monitoring/loki/loki.yml` | Loki storage and schema config |
| `monitoring/promtail/promtail.yml` | Log collection from Docker containers |
| `monitoring/grafana/grafana.env` | Grafana admin credentials and settings |
| `monitoring/grafana/provisioning/datasources/` | Auto-provisioned datasources |
| `monitoring/grafana/provisioning/dashboards/` | Dashboard provider config |
| `monitoring/grafana/dashboards/*.json` | Dashboard definitions |
| `app/core/logging.py` | JSON logging setup, request context vars |
| `app/core/metrics.py` | Prometheus metrics definitions |
| `app/core/tracing.py` | OpenTelemetry tracing setup |
| `app/main.py` | `RequestLoggingMiddleware`, wiring of metrics and tracing |
