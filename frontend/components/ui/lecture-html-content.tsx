'use client';

import { useLayoutEffect, useRef } from 'react';
import renderMathInElement from 'katex/contrib/auto-render';
import { escapeLessThanInSimpleHtml } from '@/components/ui/lecture-content';
import 'katex/dist/katex.min.css';

const proseClass =
  'prose max-w-none prose-headings:text-slate-900 prose-p:text-slate-700 prose-strong:text-slate-900 prose-a:text-blue-600 prose-code:text-blue-600 [&_.katex]:text-[1.05em] [&_.katex-display]:my-4 [&_img]:mx-auto [&_img]:my-8 [&_img]:max-h-[520px] [&_img]:w-full [&_img]:rounded-2xl [&_img]:border [&_img]:border-slate-200 [&_img]:bg-white [&_img]:object-contain';

export function LectureHtmlContent({ html }: { html: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.innerHTML = escapeLessThanInSimpleHtml(html);
    renderMathInElement(el, {
      delimiters: [
        { left: '$$', right: '$$', display: true },
        { left: '$', right: '$', display: false },
        { left: '\\(', right: '\\)', display: false },
        { left: '\\[', right: '\\]', display: true },
      ],
      throwOnError: false,
      strict: 'ignore',
      errorColor: '#64748b',
    });
  }, [html]);

  return <div ref={ref} className={proseClass} />;
}