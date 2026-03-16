"use client";

import { useCallback, useRef, useState } from "react";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  is_hint: boolean;
  created_at: string;
};

type StreamEvent =
  | { token: string }
  | { done: true; message_id: string }
  | { message: string }; // error

export function useChatStream(accessToken: string | null) {
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (
      conversationId: string,
      content: string,
      onComplete: (msg: ChatMessage) => void,
    ) => {
      if (!accessToken || isStreaming) return;
      setIsStreaming(true);
      setStreamingContent("");
      setError(null);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const response = await fetch(
          `${API_BASE_URL}/chat/conversations/${conversationId}/messages`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({ content }),
            signal: controller.signal,
          },
        );

        if (!response.ok) {
          const body = await response.json().catch(() => null);
          throw new Error(body?.message || body?.detail || `Error ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let accumulated = "";
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (line.startsWith("event: error")) {
              // Next data line has the error
              continue;
            }
            if (!line.startsWith("data: ")) continue;

            const json = line.slice(6);
            try {
              const event = JSON.parse(json) as StreamEvent;

              if ("token" in event) {
                accumulated += event.token;
                setStreamingContent(accumulated);
              } else if ("done" in event && event.done) {
                const msg: ChatMessage = {
                  id: event.message_id,
                  role: "assistant",
                  content: accumulated,
                  is_hint: false,
                  created_at: new Date().toISOString(),
                };
                onComplete(msg);
              } else if ("message" in event) {
                setError(event.message);
              }
            } catch {
              // skip malformed JSON
            }
          }
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setError(err instanceof Error ? err.message : "Stream failed");
        }
      } finally {
        setIsStreaming(false);
        setStreamingContent("");
        abortRef.current = null;
      }
    },
    [accessToken, isStreaming],
  );

  const sendHint = useCallback(
    async (
      conversationId: string,
      onComplete: (msg: ChatMessage) => void,
    ) => {
      if (!accessToken || isStreaming) return;
      setIsStreaming(true);
      setStreamingContent("");
      setError(null);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const response = await fetch(
          `${API_BASE_URL}/chat/conversations/${conversationId}/hint`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
            signal: controller.signal,
          },
        );

        if (!response.ok) {
          const body = await response.json().catch(() => null);
          throw new Error(body?.message || body?.detail || `Error ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let accumulated = "";
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (line.startsWith("event: error")) continue;
            if (!line.startsWith("data: ")) continue;

            const json = line.slice(6);
            try {
              const event = JSON.parse(json) as StreamEvent;

              if ("token" in event) {
                accumulated += event.token;
                setStreamingContent(accumulated);
              } else if ("done" in event && event.done) {
                const msg: ChatMessage = {
                  id: event.message_id,
                  role: "assistant",
                  content: accumulated,
                  is_hint: true,
                  created_at: new Date().toISOString(),
                };
                onComplete(msg);
              } else if ("message" in event) {
                setError(event.message);
              }
            } catch {
              // skip
            }
          }
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setError(err instanceof Error ? err.message : "Hint stream failed");
        }
      } finally {
        setIsStreaming(false);
        setStreamingContent("");
        abortRef.current = null;
      }
    },
    [accessToken, isStreaming],
  );

  const abort = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { isStreaming, streamingContent, error, sendMessage, sendHint, abort };
}
