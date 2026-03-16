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

type ActiveTab = "chat" | "hint";

const STORAGE_KEY = "chat_widget_open";

export function ChatWidget({ contextType, lessonId, problemId }: ChatWidgetProps) {
  const { accessToken } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>("chat");
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

      if (activeTab === "hint" && contextType === "problem") {
        sendHint(conversationId, (assistantMsg) => {
          setMessages((prev) => [...prev, assistantMsg]);
        });
      } else {
        sendMessage(conversationId, content, (assistantMsg) => {
          setMessages((prev) => [...prev, assistantMsg]);
        });
      }
    },
    [conversationId, sendMessage, sendHint, activeTab, contextType],
  );

  const triggerHint = useCallback(() => {
    if (!conversationId) return;
    if (!isOpen) {
      setIsOpen(true);
      localStorage.setItem(STORAGE_KEY, "true");
    }
    setActiveTab("hint");
    sendHint(conversationId, (assistantMsg) => {
      setMessages((prev) => [...prev, assistantMsg]);
    });
  }, [conversationId, isOpen, sendHint]);

  useEffect(() => {
    const handler = () => triggerHint();
    window.addEventListener("chat:request-hint", handler);
    return () => window.removeEventListener("chat:request-hint", handler);
  }, [triggerHint]);

  const showTabs = contextType === "problem";

  return (
    <>
      {/* Floating toggle button */}
      <button
        type="button"
        onClick={toggleOpen}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-blue-600 text-white shadow-lg shadow-blue-500/25 transition-all hover:shadow-xl hover:shadow-blue-500/30 hover:brightness-110 active:scale-90"
        aria-label={isOpen ? "Close chat" : "Open chat"}
      >
        <div className={`transition-transform duration-200 ${isOpen ? "rotate-0" : "rotate-0"}`}>
          {isOpen ? (
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" />
            </svg>
          )}
        </div>
      </button>

      {/* Chat panel */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 flex h-[520px] w-[400px] flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xl shadow-slate-900/10 animate-[scale-in_0.2s_ease-out]">
          {/* Header */}
          <div className="bg-gradient-to-r from-violet-600 to-blue-600 px-4 py-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 backdrop-blur-sm">
                  <svg className="h-4.5 w-4.5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">AI-помощник</h3>
                  <p className="text-[11px] text-white/70">Всегда готов помочь</p>
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

            {/* Tabs */}
            {showTabs && (
              <div className="mt-3 flex gap-1 rounded-lg bg-white/10 p-1 backdrop-blur-sm">
                <button
                  type="button"
                  onClick={() => setActiveTab("chat")}
                  className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                    activeTab === "chat"
                      ? "bg-white text-violet-700 shadow-sm"
                      : "text-white/80 hover:text-white hover:bg-white/10"
                  }`}
                >
                  <span className="flex items-center justify-center gap-1.5">
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
                    </svg>
                    Чат
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("hint")}
                  className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                    activeTab === "hint"
                      ? "bg-white text-amber-600 shadow-sm"
                      : "text-white/80 hover:text-white hover:bg-white/10"
                  }`}
                >
                  <span className="flex items-center justify-center gap-1.5">
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3.75 7.478a12.06 12.06 0 0 1-4.5 0m3.75 2.383a14.406 14.406 0 0 1-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 1 0-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
                    </svg>
                    Подсказка
                  </span>
                </button>
              </div>
            )}
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
