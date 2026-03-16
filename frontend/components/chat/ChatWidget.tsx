"use client";

import { useCallback, useEffect, useState } from "react";
import useSWR from "swr";
import { useAuth } from "@/lib/auth-context";
import { apiGet, apiPost } from "@/lib/api";
import { ChatMessages } from "./ChatMessages";
import { ChatInput } from "./ChatInput";
import { useChatStream, type ChatMessage } from "./useChatStream";

type ChatWidgetProps = {
  contextType: "lesson" | "problem";
  lessonId?: string;
  problemId?: string;
};

type ConversationResponse = {
  id: string;
  context_type: string;
};

type UsageResponse = {
  lesson: { used: number; limit: number };
  hint: { used: number; limit: number };
  resets_at: string;
};

const STORAGE_KEY = "chat_widget_open";

export function ChatWidget({ contextType, lessonId, problemId }: ChatWidgetProps) {
  const { accessToken } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const { isStreaming, streamingContent, error, sendMessage, sendHint } =
    useChatStream(accessToken);

  // Restore open state from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "true") setIsOpen(true);
  }, []);

  const toggleOpen = useCallback(() => {
    setIsOpen((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  }, []);

  // Fetch or create conversation when widget opens
  useEffect(() => {
    if (!isOpen || !accessToken || conversationId) return;

    (async () => {
      try {
        const conv = await apiPost<ConversationResponse>(
          "/chat/conversations",
          {
            context_type: contextType,
            lesson_id: contextType === "lesson" ? lessonId : null,
            problem_id: contextType === "problem" ? problemId : null,
          },
          accessToken,
        );
        setConversationId(conv.id);
      } catch {
        // ignore
      }
    })();
  }, [isOpen, accessToken, contextType, lessonId, problemId, conversationId]);

  // Load message history when conversation is set
  useEffect(() => {
    if (!conversationId || !accessToken) return;

    (async () => {
      try {
        const msgs = await apiGet<ChatMessage[]>(
          `/chat/conversations/${conversationId}/messages`,
          accessToken,
        );
        setMessages(msgs);
      } catch {
        // ignore
      }
    })();
  }, [conversationId, accessToken]);

  // Usage
  const { data: usage } = useSWR<UsageResponse>(
    accessToken && isOpen ? ["/chat/usage", accessToken] : null,
    ([path, token]: [string, string]) => apiGet<UsageResponse>(path, token),
    { revalidateOnFocus: false, dedupingInterval: 30_000 },
  );

  const limitReached =
    usage &&
    ((contextType === "lesson" && usage.lesson.used >= usage.lesson.limit) ||
      (contextType === "problem" && usage.hint.used >= usage.hint.limit));

  const usageText = usage
    ? contextType === "lesson"
      ? `${usage.lesson.used}/${usage.lesson.limit}`
      : `${usage.hint.used}/${usage.hint.limit}`
    : undefined;

  const handleSend = useCallback(
    (content: string) => {
      if (!conversationId) return;
      // Optimistically add user message
      const userMsg: ChatMessage = {
        id: `temp-${Date.now()}`,
        role: "user",
        content,
        is_hint: false,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);

      sendMessage(conversationId, content, (assistantMsg) => {
        setMessages((prev) => [...prev, assistantMsg]);
      });
    },
    [conversationId, sendMessage],
  );

  // Expose hint trigger for HintButton
  const triggerHint = useCallback(() => {
    if (!conversationId) return;
    if (!isOpen) {
      setIsOpen(true);
      localStorage.setItem(STORAGE_KEY, "true");
    }
    sendHint(conversationId, (assistantMsg) => {
      setMessages((prev) => [...prev, assistantMsg]);
    });
  }, [conversationId, isOpen, sendHint]);

  // Expose triggerHint via ref-like pattern using window event
  useEffect(() => {
    const handler = () => triggerHint();
    window.addEventListener("chat:request-hint", handler);
    return () => window.removeEventListener("chat:request-hint", handler);
  }, [triggerHint]);

  return (
    <>
      {/* Floating toggle button */}
      <button
        type="button"
        onClick={toggleOpen}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg transition-all hover:bg-blue-700 hover:shadow-xl active:scale-95"
        aria-label={isOpen ? "Close chat" : "Open chat"}
      >
        {isOpen ? (
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
          </svg>
        )}
      </button>

      {/* Chat panel */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 flex h-[500px] w-[380px] flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h3 className="text-sm font-semibold text-slate-800">
              {contextType === "lesson" ? "AI-помощник" : "Подсказки"}
            </h3>
            <button
              type="button"
              onClick={toggleOpen}
              className="text-slate-400 hover:text-slate-600"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <ChatMessages
            messages={messages}
            streamingContent={streamingContent}
            isStreaming={isStreaming}
          />

          {/* Error */}
          {error && (
            <div className="mx-3 mb-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-600">
              {error}
            </div>
          )}

          {/* Input */}
          <ChatInput
            onSend={handleSend}
            disabled={isStreaming || !!limitReached}
            usageText={usageText}
          />
        </div>
      )}
    </>
  );
}
