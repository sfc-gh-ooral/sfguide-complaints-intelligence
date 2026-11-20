'use client';

// Shared UI kit: cards, docket headers, KPI tiles (animated counters + sparklines), badges, skeletons,
// a chart tooltip, a tiny markdown renderer, and a streaming text reveal for AI answers.
import { ArrowDownRight, ArrowUpRight, Bot, Database, Sparkles, Timer } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Line, LineChart, ResponsiveContainer } from 'recharts';
import type { Provenance } from '@/lib/types';

export function Card({ title, eyebrow, right, children, className = '', pad = true }: { title?: ReactNode; eyebrow?: ReactNode; right?: ReactNode; children: ReactNode; className?: string; pad?: boolean }) {
  return (
    <section className={`card min-w-0 ${className}`}>
      {(title || right || eyebrow) && (
        <div className="card-head">
          <div className="min-w-0">{eyebrow && <div className="eyebrow mb-0.5">{eyebrow}</div>}{title && <h2 className="card-title">{title}</h2>}</div>
          {right && <div className="flex items-center gap-2 flex-wrap">{right}</div>}
        </div>
      )}
      <div className={pad ? 'p-4' : 'pt-3'}>{children}</div>
    </section>
  );
}

/** Screen header: serif title, one-line description, a reference line, and capability chips. */
export function Docket({ title, eyebrow, children, refLine, right }: { title: ReactNode; eyebrow: string; children?: ReactNode; refLine?: ReactNode; right?: ReactNode }) {
  return (
    <header className="docket flex items-end justify-between gap-4 flex-wrap">
      <div className="min-w-0">
        <div className="flex items-center gap-2 mb-2"><div className="tally-rule" aria-hidden /><span className="eyebrow">{eyebrow}</span></div>
        <h1>{title}</h1>
        {children && <p className="text-sm text-2 mt-1.5 max-w-3xl">{children}</p>}
        {refLine && <p className="text-xs muted mt-1.5 tabular">{refLine}</p>}
      </div>
      {right && <div className="flex gap-2 flex-wrap items-center">{right}</div>}
    </header>
  );
}

/** Counts up from 0 to the target once, then follows the value. */
export function useCountUp(target: number, ms = 600) {
  const [v, setV] = useState(0);
  const done = useRef(false);
  useEffect(() => {
    if (done.current || typeof window === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setV(target); return; }
    const t0 = performance.now(); let raf = 0;
    const tick = (t: number) => { const p = Math.min(1, (t - t0) / ms); setV(target * (1 - Math.pow(1 - p, 3))); if (p < 1) raf = requestAnimationFrame(tick); else done.current = true; };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

export function Kpi({ label, value, format, sub, trend, trendLabel, spark, tone, goodWhenDown = false }: {
  label: string; value: number; format: (x: number) => string; sub?: ReactNode; trend?: number; trendLabel?: string; spark?: number[]; tone?: 'alert' | 'warn'; goodWhenDown?: boolean;
}) {
  const v = useCountUp(value);
  const up = (trend ?? 0) >= 0;
  const good = goodWhenDown ? !up : up;
  return (
    <div className={`card kpi ${tone ?? ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="eyebrow">{label}</div>
        {trend !== undefined && (
          <span className="pill tabular" style={{ color: good ? 'var(--ok)' : 'var(--danger)', background: good ? 'var(--ok-soft)' : 'var(--danger-soft)' }} title={trendLabel}>
            {up ? <ArrowUpRight className="w-3 h-3" aria-hidden /> : <ArrowDownRight className="w-3 h-3" aria-hidden />}{Math.abs(Math.round(trend * 100))}%
          </span>
        )}
      </div>
      <div className="flex items-end justify-between gap-2 mt-1.5">
        <div className="kpi-value" aria-label={`${label}: ${format(value)}`}>{format(v)}</div>
        {spark && spark.length > 1 && (
          <div className="w-20 h-8 shrink-0" aria-hidden>
            <ResponsiveContainer><LineChart data={spark.map((y, i) => ({ i, y }))}><Line dataKey="y" stroke={tone === 'alert' ? 'var(--danger)' : 'var(--brand)'} strokeWidth={2} dot={false} isAnimationActive={false} /></LineChart></ResponsiveContainer>
          </div>
        )}
      </div>
      {sub && <div className="text-xs muted mt-1.5">{sub}{trendLabel && trend !== undefined && <span> · {trendLabel}</span>}</div>}
    </div>
  );
}

function Pill({ children, color, bg, title }: { children: ReactNode; color: string; bg: string; title?: string }) {
  return <span title={title} className="pill" style={{ color, background: bg }}>{children}</span>;
}

/** Names the Snowflake capability behind a component. */
export function PoweredBy({ children }: { children: ReactNode }) {
  return <Pill color="var(--signal)" bg="var(--signal-soft)"><Sparkles className="w-3 h-3" aria-hidden />{children}</Pill>;
}

export function SampleAiBadge() {
  return <Pill color="var(--brand)" bg="var(--brand-soft)" title="Recorded from a live run; not generated now"><Bot className="w-3 h-3" aria-hidden />Sample AI response</Pill>;
}

/** Shows where data came from; latency only when measured in Live mode. */
export function SourceBadge({ p }: { p?: Provenance }) {
  if (!p) return null;
  if (p.source === 'mock') return <Pill color="var(--ink-2)" bg="var(--paper-2)"><Database className="w-3 h-3" aria-hidden />Sample data</Pill>;
  return (
    <Pill color="var(--ok)" bg="var(--ok-soft)" title="Measured round trip from the app server to Snowflake">
      <Timer className="w-3 h-3" aria-hidden />Live · {p.role}{p.latencyMs !== undefined ? ` · ${p.latencyMs.toLocaleString()} ms` : ''}
    </Pill>
  );
}

export function Skeleton({ className = '' }: { className?: string }) { return <div className={`skel ${className}`} aria-hidden />; }

/** Placeholder screen while a page loads: docket, KPI tiles, and two panels. */
export function ScreenSkeleton({ label, tiles = 4 }: { label: string; tiles?: number }) {
  return (
    <div className="space-y-5" role="status" aria-label={label}>
      <div className="space-y-2"><Skeleton className="h-3 w-32" /><Skeleton className="h-8 w-80 max-w-full" /><Skeleton className="h-3 w-[28rem] max-w-full" /></div>
      {tiles > 0 && <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{Array.from({ length: tiles }, (_, i) => <Skeleton key={i} className="h-[104px]" />)}</div>}
      <div className="grid lg:grid-cols-3 gap-4"><Skeleton className="h-72 lg:col-span-2" /><Skeleton className="h-72" /></div>
      <span className="sr-only">{label}…</span>
    </div>
  );
}

export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return <div className="space-y-2 p-4" role="status" aria-label="Loading rows">{Array.from({ length: rows }, (_, i) => <Skeleton key={i} className="h-7" />)}</div>;
}

/** Recharts tooltip in the paper style. */
export function ChartTip({ active, payload, label, unit = '' }: { active?: boolean; payload?: { name?: string; value?: number; color?: string }[]; label?: string | number; unit?: string }) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((a, p) => a + (Number(p.value) || 0), 0);
  return (
    <div className="card px-3 py-2 text-xs" style={{ boxShadow: 'var(--shadow-lift)' }}>
      <div className="font-semibold mb-1">{label}</div>
      {payload.map((p) => <div key={p.name} className="flex items-center gap-2 tabular"><span className="w-2 h-2 rounded-sm" style={{ background: p.color }} /> <span className="text-2">{p.name}</span><span className="ml-auto font-semibold pl-4">{Number(p.value).toLocaleString()}{unit}</span></div>)}
      {payload.length > 1 && <div className="flex justify-between border-t mt-1 pt-1 tabular" style={{ borderColor: 'var(--rule)' }}><span className="muted">Total</span><span className="font-semibold">{total.toLocaleString()}{unit}</span></div>}
    </div>
  );
}
export const AXIS = { fontSize: 11, fill: 'var(--muted)' } as const;

// Minimal markdown: lists, tables, bold/italic, and [n] citation markers. Text is escaped by React.
function inline(s: string, key: number): ReactNode {
  const parts = s.split(/(\*\*[^*]+\*\*|(?<![\w])_[^_\s][^_]*_(?![\w])|\*[^*\s][^*]*\*|\[\d+\])/g).filter(Boolean);
  return <span key={key}>{parts.map((p, i) =>
    p.startsWith('**') ? <strong key={i}>{p.slice(2, -2)}</strong>
      : /^\[\d+\]$/.test(p) ? <a key={i} className="cite" href={`#src-${p.slice(1, -1)}`}>{p.slice(1, -1)}</a>
        : (p.startsWith('_') && p.endsWith('_')) || (p.startsWith('*') && p.endsWith('*')) ? <em key={i}>{p.slice(1, -1)}</em>
          : p)}</span>;
}
export function Markdown({ text, caret = false }: { text: string; caret?: boolean }) {
  const lines = text.replace(/\r/g, '').split('\n');
  const out: ReactNode[] = [];
  let i = 0, k = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (l.trim().startsWith('|')) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) { rows.push(lines[i].split('|').slice(1, -1).map((c) => c.trim())); i++; }
      const body = rows.filter((r) => !r.every((c) => /^:?-{2,}:?$/.test(c)));
      if (body.length) out.push(<table key={k++}><thead><tr>{body[0].map((c, j) => <th key={j}>{inline(c, j)}</th>)}</tr></thead>
        <tbody>{body.slice(1).map((r, ri) => <tr key={ri}>{r.map((c, j) => <td key={j}>{inline(c, j)}</td>)}</tr>)}</tbody></table>);
      continue;
    }
    if (/^\s*([-*]|\d+\.)\s+/.test(l)) {
      const ordered = /^\s*\d+\./.test(l);
      const items: string[] = [];
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*([-*]|\d+\.)\s+/, '')); i++; }
      const li = items.map((t, j) => <li key={j}>{inline(t, j)}</li>);
      out.push(ordered ? <ol key={k++}>{li}</ol> : <ul key={k++}>{li}</ul>);
      continue;
    }
    if (/^\s*([-*_])\1{2,}\s*$/.test(l)) { i++; continue; }
    if (/^#{1,4}\s/.test(l)) { out.push(<p key={k++}><strong>{l.replace(/^#+\s/, '')}</strong></p>); i++; continue; }
    if (l.trim()) out.push(<p key={k++}>{inline(l, 0)}</p>);
    i++;
  }
  return <div className={`prose-ai text-sm leading-relaxed ${caret ? 'caret' : ''}`}>{out}</div>;
}

/** Reveals text word by word (about 1.5 s for a typical answer). Off under reduced motion. */
export function useStream(text: string | undefined) {
  const [reduced] = useState(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [st, setSt] = useState({ text: '', i: 0 });
  const words = useMemo(() => (text ? text.split(/(\s+)/) : []), [text]);
  useEffect(() => {
    if (!text || reduced) return;
    const step = Math.max(2, Math.ceil(words.length / 60));
    let i = 0;
    const id = window.setInterval(() => { i = Math.min(words.length, i + step); setSt({ text, i }); if (i >= words.length) window.clearInterval(id); }, 24);
    return () => window.clearInterval(id);
  }, [text, words, reduced]);
  if (!text) return { shown: '', done: false };
  if (reduced) return { shown: text, done: true };
  const i = st.text === text ? st.i : 0;
  return { shown: words.slice(0, i).join(''), done: i >= words.length };
}

export function StreamedMarkdown({ text }: { text: string }) {
  const { shown, done } = useStream(text);
  return <Markdown text={shown} caret={!done} />;
}

export function Sources({ items }: { items: { label: string; detail?: string }[] }) {
  if (!items.length) return null;
  return (
    <div className="mt-3 pt-3 border-t fade-up" style={{ borderColor: 'var(--rule)' }}>
      <div className="eyebrow mb-1.5">Sources</div>
      <ol className="space-y-1">{items.map((s, i) => (
        <li key={i} id={`src-${i + 1}`} className="text-xs flex gap-2"><span className="cite">{i + 1}</span><span><span className="font-semibold">{s.label}</span>{s.detail && <span className="muted"> · {s.detail}</span>}</span></li>
      ))}</ol>
    </div>
  );
}
