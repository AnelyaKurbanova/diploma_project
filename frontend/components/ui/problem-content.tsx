'use client';

import type { ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

type ProblemContentProps = {
  body: string;
  variant?: 'block' | 'inline';
  className?: string;
};

function preprocessLatex(text: string): string {
  return text
    .replace(/\\\[/g, '$$')
    .replace(/\\\]/g, '$$')
    .replace(/\\\(/g, '$')
    .replace(/\\\)/g, '$');
}

export function ProblemContent({ body, variant = 'block', className }: ProblemContentProps) {
  const processed = preprocessLatex(body || '');

  if (variant === 'inline') {
    const components = {
      p: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
    };

    return (
      <span className={className}>
        <ReactMarkdown
          remarkPlugins={[remarkMath]}
          rehypePlugins={[rehypeKatex]}
          components={components}
        >
          {processed}
        </ReactMarkdown>
      </span>
    );
  }

  return (
    <div
      className={
        className ??
        'prose prose-slate max-w-none prose-p:text-sm prose-p:leading-7 prose-headings:font-bold prose-li:my-1 [&_.katex]:text-base [&_.katex-display]:my-3'
      }
    >
      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
        {processed}
      </ReactMarkdown>
    </div>
  );
}

