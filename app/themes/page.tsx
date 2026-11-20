'use client';

// Emerging themes: AI subcategory x product, ranked by the sharpest week-over-week rise. Open a theme
// to see an AI_AGG root-cause summary and masked example quotes, then open an issue for the owner.
import { AlertTriangle, ClipboardPlus } from 'lucide-react';
import { useState } from 'react';
import { Line, LineChart, ResponsiveContainer } from 'recharts';
import { day, growthLabel, n } from '@/components/fmt';
import { Reasoning } from '@/components/Reasoning';
import { ErrorBox, Tag } from '@/components/Status';
import { Card, Markdown, PoweredBy, SampleAiBadge, SourceBadge, Thinking } from '@/components/ui';
import { useAsync } from '@/components/useAsync';
import { data } from '@/lib/client';
import type { Theme, ThemeInsight } from '@/lib/types';

const OWNERS = ['Digital Banking (mobile app)', 'Deposit Operations', 'Card Services', 'Mortgage Servicing', 'Auto Finance Servicing', 'Fair Lending Office', 'Customer Care'];

function Insight({ t, onIssue }: { t: Theme; onIssue: () => void }) {
  const ins = useAsync<ThemeInsight>(() => data.themeInsight(t.theme_id), [t.theme_id]);
  const [owner, setOwner] = useState(t.product === 'Deposits' ? OWNERS[0] : t.product === 'Mortgage' ? OWNERS[3] : t.product === 'Auto loan' ? OWNERS[4] : OWNERS[2]);
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState<string>();
  const open = async () => {
    try { const r = await data.openIssue(t.theme_id, owner, note); setMsg(`Opened ${r.issueId} for ${owner}.`); setNote(''); onIssue(); }
    catch (e) { setMsg(String((e as Error).message)); }
  };
  return (
    <Card title={`${t.subcategory} · ${t.product}`} right={<><PoweredBy>AI_AGG · AI_REDACT</PoweredBy>{ins.data && <SourceBadge p={ins.data} />}</>}>
      {ins.error ? <ErrorBox error={ins.error} /> : !ins.data ? <Reasoning kind="insight" /> : (
        <div className="space-y-3">
          <div className="flex gap-2 flex-wrap items-center">
            <Tag tone="info">Week {ins.data.week} summary</Tag>{ins.data.source === 'mock' && <SampleAiBadge />}
          </div>
          <Markdown text={ins.data.summary} />
          <div>
            <div className="text-[11px] uppercase tracking-wider muted font-semibold mb-1">Example quotes (PII masked)</div>
            <ul className="space-y-2">{ins.data.quotes.map((q, i) => <li key={i} className="text-sm rounded-lg p-2" style={{ background: 'var(--surface-2)' }}>&ldquo;{q}&rdquo;</li>)}</ul>
          </div>
          <div className="pt-3 border-t space-y-2" style={{ borderColor: 'var(--border)' }}>
            <div className="text-sm font-semibold">Open an issue for the root-cause owner</div>
            <div className="flex gap-2 flex-wrap">
              <label className="sr-only" htmlFor="owner">Owner</label>
              <select id="owner" className="input" value={owner} onChange={(e) => setOwner(e.target.value)}>{OWNERS.map((o) => <option key={o}>{o}</option>)}</select>
            </div>
            <label className="sr-only" htmlFor="issue-note">Issue note</label>
            <textarea id="issue-note" className="input w-full text-sm" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What should the owner investigate?" />
            <button className="btn btn-primary text-xs" disabled={!note.trim()} onClick={open}><ClipboardPlus className="w-4 h-4" aria-hidden />Open issue</button>
            {msg && <p className="text-xs" role="status">{msg}</p>}
          </div>
        </div>
      )}
    </Card>
  );
}

export default function ThemesPage() {
  const [rev, setRev] = useState(0);
  const { data: d, error } = useAsync(() => data.themes(), [rev], true);
  const [sel, setSel] = useState<string>();
  if (error) return <ErrorBox error={error} />;
  if (!d) return <Thinking label="Grouping complaints into themes" />;
  const top = d.themes.slice(0, 12);
  const current = top.find((t) => t.theme_id === (sel ?? top[0]?.theme_id));
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold">Emerging themes</h1>
          <p className="text-sm text-2 mt-1">Themes are AI subcategories by product, ranked by their sharpest week-over-week rise (weeks with at least 40 complaints).</p>
        </div>
        <div className="flex gap-2 flex-wrap"><PoweredBy>AI_CLASSIFY</PoweredBy><SourceBadge p={d} /></div>
      </div>
      {top[0] && top[0].peakGrowth >= 0.5 && (
        <div role="note" className="card p-3 flex items-start gap-2 text-sm" style={{ borderColor: 'var(--warning)' }}>
          <AlertTriangle className="w-4 h-4 mt-0.5" style={{ color: 'var(--warning)' }} aria-hidden />
          <div><strong>{top[0].subcategory} ({top[0].product})</strong> grew {growthLabel(top[0].peakGrowth)} in week {top[0].peakWeek} (from {n(top[0].weekly[top[0].peakWeek - 2])} to {n(top[0].weekly[top[0].peakWeek - 1])}), on this synthetic data set.</div>
        </div>
      )}
      <div className="grid lg:grid-cols-5 gap-4">
        <Card title="Themes" className="lg:col-span-3 min-w-0">
          <div className="overflow-x-auto relative"><table className="data-table min-w-[620px]">
            <thead><tr><th>Theme</th><th>Weeks 1–6</th><th className="text-right">Total</th><th className="text-right">Peak rise</th><th className="text-right">Last week</th><th>Issues</th></tr></thead>
            <tbody>{top.map((t) => (
              <tr key={t.theme_id} className="click" onClick={() => setSel(t.theme_id)} aria-selected={t.theme_id === current?.theme_id}
                style={t.theme_id === current?.theme_id ? { background: 'var(--accent-soft)' } : undefined}>
                <td><button className="underline text-left font-medium" onClick={() => setSel(t.theme_id)}>{t.subcategory}</button><div className="text-[11px] muted">{t.product}</div></td>
                <td><div className="w-28 h-8" aria-label={`Weekly counts ${t.weekly.join(', ')}`} role="img"><ResponsiveContainer><LineChart data={t.weekly.map((v, i) => ({ i, v }))}><Line dataKey="v" stroke="var(--chart-1)" dot={false} strokeWidth={2} isAnimationActive={false} /></LineChart></ResponsiveContainer></div></td>
                <td className="text-right tabular">{n(t.total)}</td>
                <td className="text-right tabular">{t.peakWeek ? <Tag tone={t.peakGrowth >= 0.5 ? 'warn' : 'muted'}>{growthLabel(t.peakGrowth)} · wk {t.peakWeek}</Tag> : '—'}</td>
                <td className="text-right tabular">{growthLabel(t.latestGrowth)}</td>
                <td>{t.issues ? <Tag tone="good">{t.issues} open</Tag> : <span className="muted text-xs">—</span>}</td>
              </tr>))}</tbody>
          </table></div>
          <p className="text-[11px] muted mt-2">Weeks start {d.weeks.map((w) => day(w.start)).join(', ')}.</p>
        </Card>
        <div className="lg:col-span-2 min-w-0">{current && <Insight key={current.theme_id} t={current} onIssue={() => setRev((x) => x + 1)} />}</div>
      </div>
    </div>
  );
}
