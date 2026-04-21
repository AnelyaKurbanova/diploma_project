"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { apiGet } from "@/lib/api";

/**
 * Unified status payload shape used by both `/video-jobs/{id}` and
 * `/generation-jobs/{id}`. The backend normalizes stage/progress fields so
 * this one type fits both.
 */
export type GenerationJobSnapshot = {
  job_id: string;
  status: string;
  stage: string | null;
  stage_message: string | null;
  progress_percent: number;
  started_at: string | null;
  finished_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  elapsed_ms: number;
  error: string | null;
  // Video-specific:
  s3_url?: string | null;
  presigned_url?: string | null;
  // Generation-job specific:
  kind?: string;
  target_kind?: string | null;
  target_id?: string | null;
  result?: Record<string, unknown> | null;
};

export type GenerationEndpoint = "video" | "generation";

const TERMINAL_STATUSES = new Set(["done", "failed"]);

export function isTerminal(snapshot: GenerationJobSnapshot | null): boolean {
  if (!snapshot) return false;
  return TERMINAL_STATUSES.has(snapshot.status);
}

function endpointPath(endpoint: GenerationEndpoint, jobId: string): string {
  // Use server long-polling (wait=true&timeout_sec=20) so the UI reacts to
  // stage transitions almost instantly without hammering the API: most of
  // the time a single in-flight request is enough.
  if (endpoint === "video") {
    return `/video-jobs/${jobId}?wait=true&timeout_sec=20`;
  }
  return `/generation-jobs/${jobId}?wait=true&timeout_sec=20`;
}

/**
 * React hook that subscribes to a generation job and reports live status.
 *
 * Features:
 *  - Long-poll (20s) against the backend so stage transitions appear within
 *    ~1s without frequent client-side polling.
 *  - Automatically stops when the job reaches a terminal state.
 *  - Invokes `onDone` / `onFailed` once when the terminal transition happens.
 *  - Cleans up pending requests on unmount / when the job id changes.
 */
export function useGenerationJob(options: {
  jobId: string | null;
  endpoint: GenerationEndpoint;
  accessToken: string;
  onDone?: (snapshot: GenerationJobSnapshot) => void;
  onFailed?: (snapshot: GenerationJobSnapshot) => void;
}): {
  snapshot: GenerationJobSnapshot | null;
  loading: boolean;
  elapsedMs: number;
  refresh: () => void;
} {
  const { jobId, endpoint, accessToken, onDone, onFailed } = options;
  const [snapshot, setSnapshot] = useState<GenerationJobSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [localElapsed, setLocalElapsed] = useState(0);

  const cancelledRef = useRef(false);
  const doneFiredRef = useRef(false);
  const failedFiredRef = useRef(false);
  const onDoneRef = useRef(onDone);
  const onFailedRef = useRef(onFailed);

  onDoneRef.current = onDone;
  onFailedRef.current = onFailed;

  const pollOnce = useCallback(async () => {
    if (!jobId) return;
    setLoading(true);
    try {
      const next = await apiGet<GenerationJobSnapshot>(
        endpointPath(endpoint, jobId),
        accessToken,
      );
      if (cancelledRef.current) return;
      setSnapshot(next);

      if (next.status === "done" && !doneFiredRef.current) {
        doneFiredRef.current = true;
        onDoneRef.current?.(next);
      }
      if (next.status === "failed" && !failedFiredRef.current) {
        failedFiredRef.current = true;
        onFailedRef.current?.(next);
      }
    } catch {
      // Swallow transient errors and let the outer poll loop retry.
    } finally {
      if (!cancelledRef.current) {
        setLoading(false);
      }
    }
  }, [accessToken, endpoint, jobId]);

  // Main polling loop. We chain long-poll requests sequentially so each
  // request begins immediately after the previous resolves.
  useEffect(() => {
    if (!jobId) {
      setSnapshot(null);
      return;
    }

    cancelledRef.current = false;
    doneFiredRef.current = false;
    failedFiredRef.current = false;

    let stop = false;

    const loop = async () => {
      while (!stop) {
        try {
          const next = await apiGet<GenerationJobSnapshot>(
            endpointPath(endpoint, jobId),
            accessToken,
          );
          if (stop) return;
          setSnapshot(next);

          if (next.status === "done" && !doneFiredRef.current) {
            doneFiredRef.current = true;
            onDoneRef.current?.(next);
          }
          if (next.status === "failed" && !failedFiredRef.current) {
            failedFiredRef.current = true;
            onFailedRef.current?.(next);
          }

          if (TERMINAL_STATUSES.has(next.status)) {
            return;
          }

          // Brief breather before the next long-poll so we don't hammer the
          // server if the request returns quickly (e.g. immediate failure).
          await new Promise((r) => setTimeout(r, 150));
        } catch {
          // Back off slightly on errors before retrying.
          await new Promise((r) => setTimeout(r, 1500));
        }
      }
    };

    void loop();

    return () => {
      stop = true;
      cancelledRef.current = true;
    };
  }, [accessToken, endpoint, jobId]);

  // Locally tick elapsed time every second while the job is active so the
  // timer in the UI doesn't appear frozen between snapshots.
  useEffect(() => {
    if (!snapshot || TERMINAL_STATUSES.has(snapshot.status)) {
      setLocalElapsed(snapshot?.elapsed_ms ?? 0);
      return;
    }

    setLocalElapsed(snapshot.elapsed_ms);
    const startedAt = Date.now() - snapshot.elapsed_ms;
    const id = window.setInterval(() => {
      setLocalElapsed(Math.max(0, Date.now() - startedAt));
    }, 1000);
    return () => window.clearInterval(id);
  }, [snapshot]);

  return {
    snapshot,
    loading,
    elapsedMs: localElapsed,
    refresh: pollOnce,
  };
}

export function formatElapsed(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "0 сек";
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min === 0) return `${sec} сек`;
  return `${min} мин ${sec.toString().padStart(2, "0")} сек`;
}

// -------------------------------------------------------------------------
// LocalStorage helpers so that active job ids survive a page reload. Keyed
// by a caller-provided scope (e.g. "lesson:<uuid>:video") so different
// generation targets never conflict.
// -------------------------------------------------------------------------
export const GENERATION_LS_PREFIX = "gen-job:";

export function loadStoredJobId(scope: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(GENERATION_LS_PREFIX + scope);
  } catch {
    return null;
  }
}

export function saveStoredJobId(scope: string, jobId: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (jobId) {
      window.localStorage.setItem(GENERATION_LS_PREFIX + scope, jobId);
    } else {
      window.localStorage.removeItem(GENERATION_LS_PREFIX + scope);
    }
  } catch {
    // Ignore quota / permission errors silently.
  }
}
