"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { apiGet, API_BASE_URL, getErrorMessage, readApiErrorMessage } from "@/lib/api";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { ChatBubble } from "@/components/chat/ChatBubble";
import { useProfile } from "@/lib/swr-hooks";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type Document = {
  id: string;
  filename: string;
  chunks: number;
  uploaded_at: string;
};

export default function AikaPage() {
  const { user, accessToken, isLoading } = useAuth();
  const router = useRouter();
  const { profile } = useProfile();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [documents, setDocuments] = useState<Document[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isLoading && !user) router.replace("/auth");
  }, [isLoading, user, router]);

  useEffect(() => {
    if (!accessToken) return;
    apiGet<Document[]>("/chat/aika/documents", accessToken)
      .then(setDocuments)
      .catch(() => {});
  }, [accessToken]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || !accessToken || isStreaming) return;

    const userMsg: Message = { id: `u-${Date.now()}`, role: "user", content: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsStreaming(true);
    setStreamingContent("");
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/chat/aika/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ content: trimmed }),
      });

      if (!response.ok) {
        throw new Error(await readApiErrorMessage(response, "/chat/aika/messages"));
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("Сервер не вернул поток ответа. Попробуйте ещё раз.");
      }

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
          try {
            const event = JSON.parse(line.slice(6));
            if ("token" in event) {
              accumulated += event.token;
              setStreamingContent(accumulated);
            } else if ("done" in event && event.done) {
              setMessages((prev) => [
                ...prev,
                { id: `a-${Date.now()}`, role: "assistant", content: accumulated },
              ]);
            } else if ("message" in event) {
              setError(event.message);
            }
          } catch {
          }
        }
      }
    } catch (err) {
      setError(getErrorMessage(err, "Не удалось отправить сообщение. Попробуйте ещё раз."));
    } finally {
      setIsStreaming(false);
      setStreamingContent("");
    }
  }, [input, accessToken, isStreaming]);

  const handleUpload = useCallback(
    async (file: File) => {
      if (!accessToken) return;
      setUploading(true);
      setError(null);
      try {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch(`${API_BASE_URL}/chat/aika/upload`, {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}` },
          body: form,
        });
        if (!res.ok) {
          throw new Error(await readApiErrorMessage(res, "/chat/aika/upload"));
        }
        const data = await res.json();
        setDocuments((prev) => [
          { id: data.document_id, filename: data.filename, chunks: data.chunks, uploaded_at: new Date().toISOString() },
          ...prev,
        ]);
      } catch (err) {
        setError(getErrorMessage(err, "Не удалось загрузить файл. Попробуйте ещё раз."));
      } finally {
        setUploading(false);
      }
    },
    [accessToken],
  );

  const handleDelete = useCallback(
    async (docId: string) => {
      if (!accessToken) return;
      setError(null);
      try {
        const response = await fetch(`${API_BASE_URL}/chat/aika/documents/${docId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!response.ok) {
          throw new Error(
            await readApiErrorMessage(response, `/chat/aika/documents/${docId}`),
          );
        }
        setDocuments((prev) => prev.filter((d) => d.id !== docId));
      } catch (err) {
        setError(getErrorMessage(err, "Не удалось удалить документ. Попробуйте ещё раз."));
      }
    },
    [accessToken],
  );

  if (isLoading || !user) return null;

  const userName = profile?.full_name || user.email;
  const userRole = user.role;

  return (
    <div className="flex min-h-screen flex-col bg-[#f8fafc] text-[#0f2d51]">
      <DashboardHeader userName={userName} userRole={userRole} avatarUrl={profile?.avatar_url ?? null} />

      <div className="mx-auto flex w-full max-w-5xl flex-1 gap-6 px-4 py-6 sm:px-6">
        {}
        <aside className="hidden w-72 shrink-0 flex-col gap-4 lg:flex">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-slate-800">Материалы</h2>
            <p className="mb-3 text-xs text-slate-400">
              Загрузите файлы (.txt, .md, .docx, .pdf) — Aika будет отвечать на их основе
            </p>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 px-4 py-3 text-sm font-medium text-slate-500 transition-colors hover:border-[#93c5fd] hover:bg-[#eff6ff] hover:text-[#0f2d51] disabled:opacity-50"
            >
              {uploading ? (
                <>
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Загрузка...
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  Загрузить файл
                </>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.md,.docx,.pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUpload(file);
                e.target.value = "";
              }}
            />

            {documents.length > 0 && (
              <div className="mt-4 space-y-2">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-slate-700">{doc.filename}</p>
                      <p className="text-[10px] text-slate-400">{doc.chunks} фрагм.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDelete(doc.id)}
                      className="shrink-0 rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-500"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>

        {}
        <div className="relative flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {}
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 2, height: 60 }}
               className="flex items-center gap-3 border-b border-slate-100 bg-[#0f2d51] px-5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20">
              <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
              </svg>
            </div>
            <div>
              <h1 className="text-sm font-semibold text-white">Aika</h1>
              <p className="text-[11px] text-white/70">Загрузите материалы и задавайте вопросы</p>
            </div>

            {}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="ml-auto rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white lg:hidden"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </button>
          </div>

          {}
          <div style={{ position: "absolute", top: 60, bottom: 64, left: 0, right: 0, overflowY: "auto" }}
               className="px-5 py-4 space-y-3 bg-slate-50/50">
            {messages.length === 0 && !isStreaming && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#0f2d51] text-white shadow-lg">
                  <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" />
                  </svg>
                </div>
                <h2 className="text-lg font-semibold text-slate-700">Привет! Я Aika</h2>
                <p className="mt-1 max-w-sm text-sm text-slate-400">
                  Загрузите учебные материалы и задавайте вопросы.
                  Я отвечу на основе ваших файлов.
                </p>
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
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0f2d51] text-[10px] font-bold text-white">Ai</div>
                <div className="rounded-2xl rounded-bl-md border border-slate-100 bg-white px-4 py-3 shadow-sm">
                  <div className="flex gap-1">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-blue-300 [animation-delay:0ms]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-blue-300 [animation-delay:150ms]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-blue-300 [animation-delay:300ms]" />
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="rounded-xl bg-rose-50 px-4 py-2 text-sm text-rose-600">{error}</div>
            )}

            <div ref={bottomRef} />
          </div>

          {}
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 2, height: 64 }}
               className="flex items-center gap-2 border-t border-slate-100 bg-white px-4">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                disabled={isStreaming}
                placeholder="Спросите Aika..."
                rows={1}
                className="flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 transition-colors focus:border-[#5081ba] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#bfdbfe] disabled:opacity-50"
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={isStreaming || !input.trim()}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0f2d51] text-white shadow-sm transition-all hover:bg-[#184070] active:scale-95 disabled:opacity-40"
              >
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
      </div>
    </div>
  );
}
