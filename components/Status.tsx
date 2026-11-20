// Status pills and error/empty states used across screens.
import { AlertOctagon, Inbox } from 'lucide-react';
import type { ReactNode } from 'react';

const TONES = {
  good: ['var(--ok)', 'var(--ok-soft)'],
  bad: ['var(--danger)', 'var(--danger-soft)'],
  warn: ['var(--amber)', 'var(--amber-soft)'],
  info: ['var(--signal)', 'var(--signal-soft)'],
  brand: ['var(--brand)', 'var(--brand-soft)'],
  muted: ['var(--ink-2)', 'var(--paper-2)'],
} as const;
export type Tone = keyof typeof TONES;

export function Tag({ tone = 'muted', children, title }: { tone?: Tone; children: ReactNode; title?: string }) {
  const [color, bg] = TONES[tone];
  return <span title={title} className="pill" style={{ color, background: bg }}>{children}</span>;
}

export function ErrorBox({ error }: { error: string }) {
  return (
    <div role="alert" className="card p-4 flex gap-3 items-start" style={{ borderColor: 'var(--danger)' }}>
      <AlertOctagon className="w-5 h-5 shrink-0" style={{ color: 'var(--danger)' }} aria-hidden />
      <div className="text-sm"><div className="font-semibold" style={{ color: 'var(--danger)' }}>Couldn&apos;t load from Snowflake</div><div className="text-2 mt-0.5">{error}</div>
        <div className="muted text-xs mt-1">Live mode never falls back to sample data. Check the connection in .env.local, or switch to Sample.</div></div>
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="py-10 text-center">
      <Inbox className="w-7 h-7 mx-auto mb-2 muted" aria-hidden />
      <div className="serif font-semibold">{title}</div>
      {children && <div className="text-sm muted mt-1">{children}</div>}
    </div>
  );
}
