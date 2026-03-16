"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { apiGet, apiPost } from "@/lib/api";
import { ChatBubble } from "./ChatBubble";
import { useChatStream, type ChatMessage } from "./useChatStream";

type ChatWidgetProps = {
  contextType: "lesson" | "problem";
  lessonId?: string;
  problemId?: string;
};

type ConversationResponse = { id: string };

const STORAGE_KEY = "chat_widget_open";

export function ChatWidget({ contextType, lessonId, problemId }: ChatWidgetProps) {
  const { accessToken } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const { isStreaming, streamingContent, error, sendMessage, sendHint } =
    useChatStream(accessToken);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY) === "true") setIsOpen(true);
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
        const conv = await apiPost<ConversationResponse>("/chat/conversations", {
          context_type: contextType,
          lesson_id: contextType === "lesson" ? lessonId : null,
          problem_id: contextType === "problem" ? problemId : null,
        }, accessToken);
        setConversationId(conv.id);
      } catch { /* ignore */ }
    })();
  }, [isOpen, accessToken, contextType, lessonId, problemId, conversationId]);

  useEffect(() => {
    if (!conversationId || !accessToken) return;
    (async () => {
      try {
        const msgs = await apiGet<ChatMessage[]>(
          `/chat/conversations/${conversationId}/messages`, accessToken);
        setMessages(msgs);
      } catch { /* ignore */ }
    })();
  }, [conversationId, accessToken]);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streamingContent]);

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || !conversationId || isStreaming) return;
    setInput("");
    const userMsg: ChatMessage = {
      id: `temp-${Date.now()}`, role: "user", content: trimmed, is_hint: false, created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    sendMessage(conversationId, trimmed, (assistantMsg) => {
      setMessages((prev) => [...prev, assistantMsg]);
    });
  }, [input, conversationId, isStreaming, sendMessage]);

  const triggerHint = useCallback(() => {
    if (!isOpen) { setIsOpen(true); localStorage.setItem(STORAGE_KEY, "true"); }
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
      <button type="button" onClick={toggleOpen}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg shadow-blue-600/25 transition-all hover:bg-blue-700 hover:shadow-xl active:scale-90">
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

      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xl"
             style={{ width: 400, height: 520 }}>
          {/* Header — pinned top */}
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 2, height: 56 }}
               className="flex items-center justify-between bg-blue-600 px-4">
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

          {/* Messages — scrollable area between header and input */}
          <div ref={scrollRef}
               style={{ position: "absolute", top: 56, bottom: 60, left: 0, right: 0, overflowY: "auto" }}
               className="space-y-3 bg-slate-50/50 px-4 py-3">
            {messages.length === 0 && !isStreaming && (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-md">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-slate-500">Спросите Aika</p>
                <p className="mt-1 text-xs text-slate-400">Помогу разобраться</p>
              </div>
            )}

            {messages.map((msg) => (
              <ChatBubble key={msg.id} role={msg.role} content={msg.content} />
            ))}

            {isStreaming && streamingContent && (
              <ChatBubble role="assistant" content={streamingContent} isStreaming />
            )}

            {isStreaming && !streamingContent && (
              <div className="flex items-start gap-2">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">Ai</div>
                <div className="rounded-2xl rounded-bl-md border border-slate-100 bg-white px-4 py-3 shadow-sm">
                  <div className="flex gap-1">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-blue-300 [animation-delay:0ms]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-blue-300 [animation-delay:150ms]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-blue-300 [animation-delay:300ms]" />
                  </div>
                </div>
              </div>
            )}

            {error && <div className="rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-600">{error}</div>}
          </div>

          {/* Input — pinned bottom */}
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 2, height: 60 }}
               className="flex items-center gap-2 border-t border-slate-100 bg-white px-3">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              disabled={isStreaming}
              placeholder="Ваш вопрос..."
              rows={1}
              className="flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-400/20 disabled:opacity-50"
            />
            <button type="button" onClick={handleSend} disabled={isStreaming || !input.trim()}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm transition-all hover:bg-blue-700 active:scale-95 disabled:opacity-40">
              {isStreaming ? (
                <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                </svg>
              )}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
