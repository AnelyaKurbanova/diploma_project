## Overview

`video_worker` is a standalone Python microservice that processes math video jobs from RabbitMQ, orchestrates:

- **LLM planning & content generation** (OpenAI)
- **Manim** scene rendering
- **ffmpeg** video concatenation
- **S3** upload and presigned URL generation

It operates on a shared `jobs` table in Postgres and publishes completion/failure events back to RabbitMQ.

## Environment Variables

- **POSTGRES_DSN** (required): Async SQLAlchemy DSN, e.g. `postgresql+asyncpg://user:pass@host:5432/dbname`.
- **RABBIT_URL** (required): RabbitMQ URL, e.g. `amqp://user:pass@rabbit:5672/`.
- **OPENAI_API_KEY** (required): OpenAI API key.
- **OPENAI_MODEL** (optional, default `gpt-4.1-mini`): Chat completion model name.
- **AWS_ACCESS_KEY_ID** (required): AWS access key for S3.
- **AWS_SECRET_ACCESS_KEY** (required): AWS secret key for S3.
- **AWS_REGION** (required): AWS region, e.g. `us-east-1`.
- **S3_BUCKET** (required): Target S3 bucket name.
- **S3_PRESIGN_EXPIRES_SECONDS** (optional, default `86400`): Presigned URL TTL in seconds.
- **WORK_DIR** (optional, default `/tmp/video_jobs`): Local working directory for per-job rendering.

## RabbitMQ Contract

- **Exchange**: `video.events` (type: `topic`)
- **Queue**: `video.worker`
- **Bindings**:
  - `video.worker` queue bound with routing key `video.requested`
- **Routing keys**:
  - `video.requested`
  - `video.completed`
  - `video.failed`

### Payloads

- **video.requested**

```json
{ "job_id": "c4b5d6e7-1234-5678-9abc-def012345678" }
```

- **video.completed**

```json
{
  "job_id": "c4b5d6e7-1234-5678-9abc-def012345678",
  "s3_url": "https://your-bucket.s3.us-east-1.amazonaws.com/videos/c4b5d6e7-1234-5678-9abc-def012345678/final.mp4"
}
```

- **video.failed**

```json
{
  "job_id": "c4b5d6e7-1234-5678-9abc-def012345678",
  "error": "Description of the failure"
}
```

## Postgres Table Schema

The worker expects a `jobs` table with the following structure (Alembic is not used; create this table yourself):

```sql
CREATE TABLE jobs (
  id UUID PRIMARY KEY,
  status TEXT NOT NULL, -- queued|planning|rendering|merging|uploading|done|failed
  request_json JSONB NOT NULL,
  plan_json JSONB,
  result_json JSONB,
  error_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

You may optionally add a trigger to keep `updated_at` in sync on updates.

## Running Locally (without Docker)

1. Ensure system dependencies are installed:
   - `ffmpeg`
   - A TeX distribution with LaTeX support, e.g. `texlive-latex-base`, `texlive-latex-extra`, `texlive-fonts-recommended`, `texlive-science`
2. From the project root (where `video_worker/` lives):

```bash
pip install -r video_worker/requirements.txt
export POSTGRES_DSN="postgresql+asyncpg://user:pass@localhost:5432/dbname"
export RABBIT_URL="amqp://guest:guest@localhost:5672/"
export OPENAI_API_KEY="sk-..."
export AWS_ACCESS_KEY_ID="..."
export AWS_SECRET_ACCESS_KEY="..."
export AWS_REGION="us-east-1"
export S3_BUCKET="your-bucket-name"

python -m video_worker.app.main
```

The worker will connect to Postgres, RabbitMQ, OpenAI, and S3, then start consuming `video.requested` messages.

## Running with Docker

Build the image from the `video_worker/` directory:

```bash
docker build -t video-worker .
```

Run the container, providing environment variables:

```bash
docker run --rm \
  -e POSTGRES_DSN="postgresql+asyncpg://user:pass@postgres:5432/dbname" \
  -e RABBIT_URL="amqp://guest:guest@rabbit:5672/" \
  -e OPENAI_API_KEY="sk-..." \
  -e OPENAI_MODEL="gpt-4.1-mini" \
  -e AWS_ACCESS_KEY_ID="..." \
  -e AWS_SECRET_ACCESS_KEY="..." \
  -e AWS_REGION="us-east-1" \
  -e S3_BUCKET="your-bucket-name" \
  -e WORK_DIR="/tmp/video_jobs" \
  video-worker
```

Ensure the container can reach Postgres, RabbitMQ, and S3 (via AWS networking and IAM).

## Workflow Summary

1. **Message received**: `video.requested` with `{ "job_id": "<uuid>" }`.
2. **DB load & idempotency**: Job row is loaded from Postgres; if already `done` or in-progress (`planning`/`rendering`/`merging`/`uploading`), the message is acknowledged and ignored.
3. **Planning**:
   - Status is set to `planning`.
   - OpenAI is called to produce `plan_json` (strict JSON schema, template allowlist, max 10 scenes).
4. **Content generation**:
   - Status is set to `rendering`.
   - OpenAI is called to generate `content_json` for all scenes in one response.
   - JSON is validated (schema + custom checks); on failure, the LLM is retried up to 2 times with error feedback, then the job is marked `failed`.
5. **Rendering**:
   - A per-job working directory `WORK_DIR/{job_id}/` is created.
   - A Python script is generated that uses predefined Manim templates for each scene.
   - Manim CLI renders each scene to `scene_00.mp4`, `scene_01.mp4`, ...
6. **Merging**:
   - Status is set to `merging`.
   - `ffmpeg` concat demuxer combines scene videos into `final.mp4`.
7. **Uploading**:
   - Status is set to `uploading`.
   - `final.mp4` is uploaded to S3 at `videos/{job_id}/final.mp4`.
   - A presigned URL is generated with the configured expiration.
8. **Completion**:
   - Status is set to `done`.
   - `result_json` is updated with `s3_url`, `presigned_url`, and phase timings.
   - A `video.completed` event is published to RabbitMQ.

On any error, status is set to `failed`, `error_text` is recorded, a `video.failed` event is published, and the message is acknowledged.

## Tests

Minimal tests for JSON validation live in `video_worker/tests/test_validators.py`. To run them:

```bash
pytest -q
```

