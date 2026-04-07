'use client';

import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

const rehypeKatexOptions = {
  output: 'html' as const,
  errorColor: '#64748b',
  strict: 'ignore' as const,
  trust: true as const,
};

function preprocessLatexDelimiters(text: string): string {
  return text
    .replace(/\\\[/g, '$$')
    .replace(/\\\]/g, '$$')
    .replace(/\\\(/g, '$')
    .replace(/\\\)/g, '$');
}

function unindentDisplayMathFences(text: string): string {
  return text.replace(/^[ \t]+(\$\$)/gm, '$1');
}

function fixShorthandFrac(text: string): string {
  return text
    .replace(/\\tfrac(\d)(\d)(?![0-9])/g, '\\tfrac{$1}{$2}')
    .replace(/\\frac(\d)(\d)(?![0-9])/g, '\\frac{$1}{$2}');
}

function repairBrokenMathFences(text: string): string {
  let s = text;
  for (let k = 0; k < 8; k++) {
    const before = s;
    s = s.replace(/\$\$([^$]+?)\$(?!\$)/g, '$$$1$$');
    if (s === before) break;
  }
  s = s.replace(/(^|\n)(\s*)\$([^$\n][^$]*?)\$\$(?=\s*(?:\n|$))/g, '$1$2$$$3$$');
  return s;
}

function insertSpaceBeforeInlineMath(text: string): string {
  return text.replace(
    /([\p{L}\p{N})}\]])(?=\$(?:\\|[a-zA-Zа-яёіїА-ЯЁІЇ({]))/gu,
    '$1 ',
  );
}

function decodeBasicHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function escapeLessThanOutsideMath(text: string): string {
  const out: string[] = [];
  let i = 0;

  const nextUnescapedDollar = (from: number): number => {
    for (let j = from; j < text.length; j++) {
      if (text[j] !== '$') continue;
      let bs = 0;
      for (let k = j - 1; k >= 0 && text[k] === '\\'; k--) bs++;
      if (bs % 2 === 0) return j;
    }
    return -1;
  };

  while (i < text.length) {
    if (text.startsWith('$$', i)) {
      let bs = 0;
      for (let k = i - 1; k >= 0 && text[k] === '\\'; k--) bs++;
      if (bs % 2 !== 0) {
        out.push(text[i]);
        i++;
        continue;
      }
      const close = text.indexOf('$$', i + 2);
      if (close === -1) {
        out.push(escapeComparisonLessThan(text.slice(i)));
        break;
      }
      out.push(text.slice(i, close + 2));
      i = close + 2;
      continue;
    }

    const d = nextUnescapedDollar(i);
    if (d === -1) {
      out.push(escapeComparisonLessThan(text.slice(i)));
      break;
    }
    if (d > i) {
      out.push(escapeComparisonLessThan(text.slice(i, d)));
    }
    if (text.startsWith('$$', d)) {
      i = d;
      continue;
    }
    const close = nextUnescapedDollar(d + 1);
    if (close === -1) {
      out.push(text.slice(d));
      break;
    }
    out.push(text.slice(d, close + 1));
    i = close + 1;
  }

  return out.join('');
}

export function escapeComparisonLessThan(plain: string): string {
  let s = plain;
  const fenceParts: string[] = [];
  s = s.replace(/```[\s\S]*?```/g, (m) => {
    fenceParts.push(m);
    return `\uE000F${fenceParts.length - 1}\uE000`;
  });
  const PLAIN_LT = /([\p{L}\p{N}.!?)}\]'"]|\))\s*<\s*(?=[\p{L}\p{N}($[\-\\])/gu;
  let prev: string;
  do {
    prev = s;
    s = s.replace(PLAIN_LT, '$1 &lt; ');
  } while (s !== prev);
  fenceParts.forEach((part, ix) => {
    s = s.replace(`\uE000F${ix}\uE000`, part);
  });
  return s;
}

export function escapeLessThanInSimpleHtml(html: string): string {
  return html.split(/(<[^>]+>)/g).map((chunk) => {
    if (/^<[^>]+>$/.test(chunk)) return chunk;
    return escapeComparisonLessThan(chunk);
  }).join('');
}

function tryUnwrapSimpleHtmlToMarkdown(html: string): string | null {
  const t = html.trim();
  if (/<(script|style|iframe|object|embed|img|video|svg|table|input|form|button)/i.test(t)) {
    return null;
  }
  let out = t
    .replace(/\r\n/g, '\n')
    .replace(/<\/\s*p\s*>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/\s*div\s*>/gi, '\n\n')
    .replace(/<li[^>]*>/gi, '\n- ')
    .replace(/<\/\s*li\s*>/gi, '')
    .replace(/<\/\s*ul\s*>|<\/\s*ol\s*>/gi, '\n')
    .replace(/<[^>]+>/g, '');
  out = decodeBasicHtmlEntities(out);
  out = out.replace(/\n{3,}/g, '\n\n').trim();
  if (out.length < 40) return null;
  const hasMath = /\$\$/.test(out) || /\$[^$\n][^$]{0,400}\$/m.test(out);
  const hasMdStructure = /^(\s*[-*+]|\s*\d+\.\s|#{1,6}\s)/m.test(out);
  if (!hasMath && !hasMdStructure) return null;
  return out;
}

export function normalizeLectureMarkdown(text: string): string {
  let s = preprocessLatexDelimiters(text);
  s = unindentDisplayMathFences(s);
  s = repairBrokenMathFences(s);
  s = fixShorthandFrac(s);
  s = insertSpaceBeforeInlineMath(s);
  s = escapeLessThanOutsideMath(s);
  return s;
}

export function lectureMarkdownFromBody(body: string | null | undefined): string | null {
  if (body == null || !body.trim()) return '';
  const trimmed = body.trim();
  if (!/<[a-zA-Z!?/]/.test(trimmed)) {
    return normalizeLectureMarkdown(trimmed);
  }
  const unwrapped = tryUnwrapSimpleHtmlToMarkdown(trimmed);
  if (unwrapped !== null) return normalizeLectureMarkdown(unwrapped);
  return null;
}

export function LectureContent({ body }: { body: string }) {
  const processed = normalizeLectureMarkdown(body);
  return (
    <div
      className={[
        'lecture-content prose prose-slate max-w-none mx-auto',
        'prose-p:text-base prose-p:leading-relaxed prose-headings:font-bold prose-headings:scroll-mt-24',
        'prose-li:my-1 prose-li:leading-relaxed prose-ol:my-2 prose-ul:my-2',
        'prose-pre:bg-slate-50 prose-pre:text-slate-800 prose-pre:leading-relaxed',
        '[&_.katex]:text-[1.05em] [&_.katex-display]:my-4',
        '[&_.katex-error]:!text-slate-600 [&_.katex-error]:!bg-transparent',
        '[&_img]:mx-auto [&_img]:my-8 [&_img]:max-h-[420px] [&_img]:w-full [&_img]:rounded-2xl',
        '[&_img]:border [&_img]:border-slate-200 [&_img]:bg-white [&_img]:object-contain',
      ].join(' ')}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath, remarkBreaks]}
        rehypePlugins={[[rehypeKatex, rehypeKatexOptions]]}
        skipHtml
      >
        {processed}
      </ReactMarkdown>
    </div>
  );
}
