"use client";

import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

type ChatBubbleProps = {
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
};

function preprocessLatex(text: string): string {
  let result = text;
  // \[...\] → $$...$$
  result = result.replace(/\\\[([\s\S]*?)\\\]/g, "\n$$\n$1\n$$\n");
  // \(...\) → $...$
  result = result.replace(/\\\(([\s\S]*?)\\\)/g, " $$$1$$ ");
  // standalone integrals/fractions etc that aren't wrapped — wrap in $...$
  // e.g. ∫_a^b f(x)dx or F(b) − F(a)
  result = result.replace(
    /(?<!\$)(∫[^$\n]+?(?:dx|dy|dz|dt))(?!\$)/g,
    " $$$1$$ "
  );
  return result;
}

export function ChatBubble({ role, content, isStreaming }: ChatBubbleProps) {
  const isUser = role === "user";

  return (
    <div
      className={`flex ${isUser ? "justify-end" : "justify-start"} animate-[fade-in_0.2s_ease-out]`}
    >
      {!isUser && (
        <div className="mr-2 mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white shadow-sm">
          Ai
        </div>
      )}
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm ${
          isUser
            ? "rounded-br-md bg-blue-600 text-white"
            : "rounded-bl-md border border-slate-100 bg-white text-slate-700"
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap break-words">{content}</p>
        ) : (
          <div className="prose prose-sm prose-slate max-w-none break-words prose-p:my-1 prose-p:leading-relaxed prose-headings:mb-1 prose-headings:mt-2 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-code:rounded prose-code:bg-slate-100 prose-code:px-1 prose-code:py-0.5 prose-code:text-xs prose-code:before:content-none prose-code:after:content-none prose-pre:my-2 prose-pre:rounded-lg prose-pre:bg-slate-900 prose-pre:text-xs [&_.katex]:text-[13px] [&_.katex-display]:my-2 [&_.katex-display]:text-sm">
            <ReactMarkdown
              remarkPlugins={[remarkMath]}
              rehypePlugins={[rehypeKatex]}
            >
              {preprocessLatex(content)}
            </ReactMarkdown>
          </div>
        )}
        {isStreaming && (
          <span className="ml-1 inline-flex gap-0.5">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current opacity-40 [animation-delay:0ms]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current opacity-40 [animation-delay:150ms]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current opacity-40 [animation-delay:300ms]" />
          </span>
        )}
      </div>
    </div>
  );
}
