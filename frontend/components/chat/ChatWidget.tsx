"use client";

import { useCallback, useEffect, useState } from "react";
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

const STORAGE_KEY = "chat_widget_open";

export function ChatWidget({ contextType, lessonId, problemId }: ChatWidgetProps) {
  const { accessToken } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const { isStreaming, streamingContent, error, sendMessage, sendHint } =
    useChatStream(accessToken);

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

  const handleSend = useCallback(
    (content: string) => {
      if (!conversationId) return;
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

  const triggerHint = useCallback(() => {
    if (!isOpen) {
      setIsOpen(true);
      localStorage.setItem(STORAGE_KEY, "true");
    }
    if (!conversationId) return;
    sendHint(conversationId, (assistantMsg) => {
      setMessages((prev) => [...prev, assistantMsg]);
    });
  }, [conversationId, isOpen, sendHint]);

  useEffect(() => {
    const handler = () => triggerHint();
    window.addEventListener("chat:request-hint", handler);
    return () => window.removeEventListener("chat:request-hint", handler);
  }, [triggerHint]);

  return (
    <>
      {/* FAB */}
      <button
        type="button"
        onClick={toggleOpen}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg shadow-blue-600/25 transition-all hover:bg-blue-700 hover:shadow-xl active:scale-90"
        aria-label={isOpen ? "Закрыть чат" : "Открыть чат"}
      >
        {isOpen ? (
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
          </svg>
        )}
      </button>

      {/* Popup */}
      {isOpen && (
        <div
          style={{ display: "flex", flexDirection: "column", height: "520px", width: "400px" }}
          className="fixed bottom-24 right-6 z-50 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xl animate-[scale-in_0.2s_ease-out]"
        >
          {/* Header */}
          <div style={{ flexShrink: 0 }} className="flex items-center justify-between bg-blue-600 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20">
                <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Aika</h3>
                <p className="text-[11px] text-white/70">AI-помощник</p>
              </div>
            </div>
            <button type="button" onClick={toggleOpen} className="rounded-lg p-1.5 text-white/70 hover:bg-white/10 hover:text-white">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Messages — takes all remaining space */}
          <div style={{ flex: "1 1 0%", minHeight: 0, overflow: "hidden" }}>
            <ChatMessages messages={messages} streamingContent={streamingContent} isStreaming={isStreaming} />
          </div>

          {/* Error */}
          {error && (
            <div style={{ flexShrink: 0 }} className="mx-3 mb-2 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-600">{error}</div>
          )}

          {/* Input — pinned at bottom */}
          <div style={{ flexShrink: 0 }}>
            <ChatInput onSend={handleSend} disabled={isStreaming} />
          </div>
        </div>
      )}
    </>
  );
}
