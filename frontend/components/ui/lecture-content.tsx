'use client';

import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

function preprocessLatex(text: string): string {
  return text
    .replace(/\\\[/g, '$$')
    .replace(/\\\]/g, '$$')
    .replace(/\\\(/g, '$')
    .replace(/\\\)/g, '$');
}

export function LectureContent({ body }: { body: string }) {
  const processed = preprocessLatex(body);
  return (
    <div className="lecture-content prose prose-slate mx-auto max-w-3xl prose-p:text-base prose-p:leading-8 prose-headings:font-bold prose-li:my-1 [&_.katex]:text-base [&_.katex-display]:my-4 [&_img]:mx-auto [&_img]:my-8 [&_img]:max-h-[420px] [&_img]:w-full [&_img]:rounded-2xl [&_img]:border [&_img]:border-slate-200 [&_img]:bg-white [&_img]:object-contain">
      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
        {processed}
      </ReactMarkdown>
    </div>
  );
}
