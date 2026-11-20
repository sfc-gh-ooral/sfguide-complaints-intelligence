'use client';

// Emerging themes: AI subcategory x product, ranked by the sharpest week-over-week rise. A heatmap shows
// six weeks at once; opening a theme streams an AI_AGG root-cause summary with masked example quotes as
// cited sources, and lets the analyst open an issue for the root-cause owner.
import { AlertTriangle, ClipboardPlus } from 'lucide-react';
import { useState } from 'react';
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { day, growthLabel, n } from '@/components/fmt';
import { Reasoning } from '@/components/Reasoning';
import { ErrorBox, Tag } from '@/components/Status';
import { AXIS, Card, ChartTip, Docket, PoweredBy, SampleAiBadge, ScreenSkeleton, SourceBadge, useStream, Markdown } from '@/components/ui';
import { useAsync } from '@/components/useAsync';
import { data } from '@/lib/client';
import type { Theme, ThemeInsight } from '@/lib/types';

const OWNERS = ['Digital Banking (mobile app)', 'Deposit Operations', 'Card Services', 'Mortgage Servicing', 'Auto Finance Servicing', 'Fair Lending Office', 'Customer Care'];

function InsightBody({ ins }: { ins: ThemeInsight }) {
  const { shown, done } = useStream(ins.summary);
  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap items-center"><Tag tone="info">Week {ins.week} root cause</Tag>{ins.source === 'mock' && <SampleAiBadge />}<span className="text-[11px] muted">{ins.model}</span></div>
      <Markdown text={shown + (done && ins.quotes.length ? ` ${ins.quotes.map((_, i) => `[${i + 1}]`).join('')}` : '')} caret={!done} />
      {done && (
        <div className="fade-up">
          <div className="eyebrow mb-1.5">Sources · example complaints, PII masked</div>
          <ol className="space-y-2">{ins.quotes.map((q, i) => (
            <li key={i} id={`src-${i + 1}`} className="flex gap-2 text-sm"><span className="cite mt-0.5">{i + 1}</span><span className="serif leading-relaxed rounded-md px-2.5 py-1.5 flex-1" style={{ background: 'var(--paper-2)' }}>&ldquo;{q}&rdquo;</span></li>
          ))}</ol>
        </div>
      )}
    </div>
  );
}

function Insight({ t, onIssue }: { t: Theme; onIssue: () => void }) {
  const ins = useAsync<ThemeInsight>(() => data.themeInsight(t.theme_id), [t.theme_id]);
  const [owner, setOwner] = useState(t.product === 'Deposits' ? OWNERS[0] : t.product === 'Mortgage' ? OWNERS[3] : t.product === 'Auto loan' ? OWNERS[4] : OWNERS[2]);
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string }>();
  const peak = t.peakWeek || t.weekly.indexOf(Math.max(...t.weekly)) + 1;
  const open = async () => {
    try { const r = await data.openIssue(t.theme_id, owner, note); setMsg({ ok: true, text: `Opened ${r.issueId} for ${owner}.` }); setNote(''); onIssue(); }
    catch (e) { setMsg({ ok: false, text: String((e as Error).message) }); }
  };
  return (
    <Card eyebrow={t.product} title={t.subcategory} right={<><PoweredBy>AI_AGG · AI_REDACT</PoweredBy>{ins.data && <SourceBadge p={ins.data} />}</>}>
      <div className="h-28 -mx-1 mb-3" role="img" aria-label={`Weekly complaints for this theme: ${t.weekly.join(', ')}`}>
        <ResponsiveContainer>
          <BarChart data={t.weekly.map((v, i) => ({ w: `Wk ${i + 1}`, v }))} margin={{ top: 4, left: 4, right: 4 }}>
            <XAxis dataKey="w" tick={AXIS} axisLine={false} tickLine={false} />
            <Tooltip content={<ChartTip />} cursor={{ fill: 'var(--paper-2)' }} />
            <Bar dataKey="v" name="Complaints" radius={[3, 3, 0, 0]}>{t.weekly.map((_, i) => <Cell key={i} fill={i + 1 === peak ? 'var(--brand)' : 'color-mix(in srgb, var(--brand) 28%, var(--paper-2))'} />)}</Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {ins.error ? <ErrorBox error={ins.error} /> : !ins.data
        ? <Reasoning kind="insight" steps={[`Counting ${n(t.weekly[peak - 1] ?? 0)} complaints in week ${peak}`, `Summarizing the root cause with AI_AGG`, 'Masking example quotes with AI_REDACT', 'Caching the theme insight']} />
        : (
          <div className="space-y-4">
            <InsightBody ins={ins.data} />
            <div className="pt-3 border-t space-y-2" style={{ borderColor: 'var(--rule)' }}>
              <div className="serif font-semibold">Open an issue for the root-cause owner</div>
              <label className="sr-only" htmlFor="owner">Owner</label>
              <select id="owner" className="input w-full" value={owner} onChange={(e) => setOwner(e.target.value)}>{OWNERS.map((o) => <option key={o}>{o}</option>)}</select>
              <label className="sr-only" htmlFor="issue-note">Issue note</label>
              <textarea id="issue-note" className="input w-full text-sm" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What should the owner investigate?" />
              <button className="btn btn-primary text-xs" disabled={!note.trim()} onClick={open}><ClipboardPlus className="w-4 h-4" aria-hidden />Open issue</button>
              {msg && <p className="text-xs font-semibold" role="status" style={{ color: msg.ok ? 'var(--ok)' : 'var(--danger)' }}>{msg.text}</p>}
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
  if (!d) return <ScreenSkeleton label="Grouping complaints into themes" tiles={0} />;
  const top = d.themes.slice(0, 12);
  const current = top.find((t) => t.theme_id === (sel ?? top[0]?.theme_id));
  const max = Math.max(...top.flatMap((t) => t.weekly));
  const lead = top[0];
  return (
    <div className="space-y-5">
      <Docket eyebrow="Early warning" title="Emerging themes" refLine={`${top.length} of ${d.themes.length} themes shown · weeks start ${d.weeks.map((w) => day(w.start)).join(', ')}`}
        right={<><PoweredBy>AI_CLASSIFY</PoweredBy><SourceBadge p={d} /></>}>
        A theme is an AI subcategory within a product. They are ranked by their sharpest week-over-week rise, counting only weeks with at least 40 complaints.
      </Docket>
      {lead && lead.peakGrowth >= 0.5 && (
        <div role="note" className="card p-3 flex items-start gap-3 text-sm" style={{ borderLeft: '3px solid var(--amber)' }}>
          <AlertTriangle className="w-5 h-5 shrink-0" style={{ color: 'var(--amber)' }} aria-hidden />
          <div><strong>{lead.subcategory} ({lead.product})</strong> grew {growthLabel(lead.peakGrowth)} in week {lead.peakWeek}, from {n(lead.weekly[lead.peakWeek - 2])} to {n(lead.weekly[lead.peakWeek - 1])} complaints.</div>
        </div>
      )}
      <div className="grid lg:grid-cols-5 gap-4 items-start">
        <Card eyebrow="Six weeks at a glance" title="Theme heatmap" className="lg:col-span-3" pad={false}>
          <div className="overflow-x-auto">
            <table className="ledger min-w-[640px]">
              <thead><tr><th scope="col">Theme</th>{d.weeks.map((w) => <th key={w.week} scope="col" className="!text-center">Wk {w.week}</th>)}<th scope="col" className="!text-right">Peak rise</th><th scope="col">Issues</th></tr></thead>
              <tbody>{top.map((t) => {
                const on = t.theme_id === current?.theme_id;
                return (
                  <tr key={t.theme_id} className={`click ${on ? 'sel' : ''}`} onClick={() => setSel(t.theme_id)} aria-selected={on}>
                    <td><button className="font-semibold text-left hover:underline" onClick={(e) => { e.stopPropagation(); setSel(t.theme_id); }}>{t.subcategory}</button><div className="text-[11px] muted">{t.product} · {n(t.total)} total</div></td>
                    {t.weekly.map((v, i) => {
                      const a = v / max;
                      return <td key={i} className="!p-1"><div className="rounded text-[11px] tabular text-center py-1.5 font-semibold" title={`Week ${i + 1}: ${n(v)}`}
                        style={{ background: `color-mix(in srgb, var(--brand) ${Math.round(8 + a * 80)}%, var(--paper))`, color: a > 0.58 ? 'var(--on-brand)' : 'var(--ink)' }}>{n(v)}</div></td>;
                    })}
                    <td className="text-right">{t.peakWeek ? <Tag tone={t.peakGrowth >= 0.5 ? 'warn' : 'muted'}>{growthLabel(t.peakGrowth)} · wk {t.peakWeek}</Tag> : <span className="muted">—</span>}</td>
                    <td>{t.issues ? <Tag tone="good">{t.issues} open</Tag> : <span className="muted text-xs">—</span>}</td>
                  </tr>);
              })}</tbody>
            </table>
          </div>
        </Card>
        <div className="lg:col-span-2 min-w-0 lg:sticky lg:top-[72px]">{current && <Insight key={current.theme_id} t={current} onIssue={() => setRev((x) => x + 1)} />}</div>
      </div>
    </div>
  );
}
