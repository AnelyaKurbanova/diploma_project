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

  // Hint trigger — opens chat + sends hint request
  const triggerHint = useCallback(() => {
    if (!conversationId) {
      // Open first, conversation will be created by the effect
      if (!isOpen) {
        setIsOpen(true);
        localStorage.setItem(STORAGE_KEY, "true");
      }
      return;
    }
    if (!isOpen) {
      setIsOpen(true);
      localStorage.setItem(STORAGE_KEY, "true");
    }
    sendHint(conversationId, (assistantMsg) => {
      setMessages((prev) => [...prev, assistantMsg]);
    });
  }, [conversationId, isOpen, sendHint]);

  useEffect(() => {
    const handler = () => triggerHint();
    window.addEventListener("chat:request-hint", handler);
    return () => window.removeEventListener("chat:request-hint", handler);
  }, [triggerHint]);

  // Listen for header Aika button toggle
  useEffect(() => {
    const handler = () => toggleOpen();
    window.addEventListener("chat:toggle", handler);
    return () => window.removeEventListener("chat:toggle", handler);
  }, [toggleOpen]);

  return (
    <>
      {/* Floating toggle button */}
      <button
        type="button"
        onClick={toggleOpen}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg shadow-blue-600/25 transition-all hover:bg-blue-700 hover:shadow-xl hover:shadow-blue-600/30 active:scale-90"
        aria-label={isOpen ? "Закрыть Aika" : "Открыть Aika"}
      >
        {isOpen ? (
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" />
          </svg>
        )}
      </button>

      {/* Chat panel */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 flex h-[520px] w-[400px] flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xl shadow-slate-900/10 animate-[scale-in_0.2s_ease-out]">
          {/* Header */}
          <div className="bg-blue-600 px-4 py-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 backdrop-blur-sm">
                  <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Aika</h3>
                  <p className="text-[11px] text-white/70">AI-помощник</p>
                </div>
              </div>
              <button
                type="button"
                onClick={toggleOpen}
                className="rounded-lg p-1.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </button>
            </div>
          </div>

          {/* Messages */}
          <ChatMessages
            messages={messages}
            streamingContent={streamingContent}
            isStreaming={isStreaming}
          />

          {/* Error */}
          {error && (
            <div className="mx-3 mb-2 flex items-center gap-2 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-600">
              <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
              </svg>
              {error}
            </div>
          )}

          {/* Input */}
          <ChatInput
            onSend={handleSend}
            disabled={isStreaming}
          />
        </div>
      )}
    </>
  );
}
