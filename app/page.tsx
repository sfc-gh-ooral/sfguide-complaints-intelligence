'use client';

// Overview: weekly volume by product, risk flags, channel mix, aging of open complaints, the sharpest
// emerging theme, and the complaints whose response is due in the next three days.
import { AlertTriangle, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ComplaintTable } from '@/components/Complaints';
import { PRODUCT_COLORS, day, dayLong, growthLabel, n, pct } from '@/components/fmt';
import { ErrorBox, Tag } from '@/components/Status';
import { AXIS, Card, ChartTip, Docket, Kpi, PoweredBy, ScreenSkeleton, Skeleton, SourceBadge } from '@/components/ui';
import { useAsync } from '@/components/useAsync';
import { data } from '@/lib/client';
import { PRODUCTS } from '@/lib/types';

const FLAG_VIEW: Record<string, string> = { 'Fair lending': 'fair-lending', UDAAP: 'udaap' };

export default function OverviewPage() {
  const { data: d, error } = useAsync(() => data.overview(), []);
  const th = useAsync(() => data.themes(), []);
  if (error) return <ErrorBox error={error} />;
  if (!d) return <ScreenSkeleton label="Loading complaints" />;
  const k = d.kpis;
  const weekly = d.weekly.map((w) => ({ ...w, label: `Wk ${w.week}`, total: PRODUCTS.reduce((a, p) => a + w[p], 0) }));
  const totals = weekly.map((w) => w.total);
  const last = totals.at(-2) ?? 0, prev = totals.at(-3) ?? 0; // final week is partial; compare the last two full weeks
  const top = th.data?.themes[0];
  const flagMax = Math.max(...d.flags.map((f) => f.complaints), k.duplicates);
  const chanMax = Math.max(...d.channels.map((c) => c.complaints));

  return (
    <div className="space-y-5">
      <Docket eyebrow="Complaints overview" title="Every complaint, classified on arrival"
        refLine={`Business date ${dayLong(d.asOf)} · ${n(k.total)} complaints over ${weekly.length} weeks · 5 channels`}
        right={<><PoweredBy>Dynamic Tables</PoweredBy><PoweredBy>AI_CLASSIFY</PoweredBy><SourceBadge p={d} /></>}>
        Volumes, risk flags and deadlines for Northwind Bank&apos;s consumer complaints. Start with what&apos;s due, then look at what&apos;s rising.
      </Docket>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 stagger">
        <Kpi label="Complaints" value={k.total} format={(x) => n(Math.round(x))} spark={totals.slice(0, -1)} trend={prev ? last / prev - 1 : undefined} trendLabel="last full week vs prior" goodWhenDown sub={`${n(k.open)} open or in progress`} />
        <Kpi label="Flagged high-risk" value={k.highRisk / k.total} format={(x) => pct(x)} sub={`${n(k.highRisk)} UDAAP, fair-lending or servicing`} />
        <Kpi label="Resolved on time" value={k.onTimeRate} format={(x) => pct(x)} sub={`of ${n(k.resolved)} resolved · 15-day window`} />
        <Kpi label="Due in 3 days" value={k.dueSoon} format={(x) => n(Math.round(x))} tone={k.overdue ? 'alert' : 'warn'} sub={<><span style={{ color: 'var(--danger)' }} className="font-semibold">{n(k.overdue)} overdue</span> · open the queue</>} />
      </div>

      {top && top.peakGrowth >= 0.5 && (
        <Link href="/themes" className="card flex items-center gap-3 p-3 no-underline group" style={{ borderLeft: '3px solid var(--amber)' }}>
          <AlertTriangle className="w-5 h-5 shrink-0" style={{ color: 'var(--amber)' }} aria-hidden />
          <div className="text-sm min-w-0"><span className="font-semibold">Emerging: {top.subcategory} ({top.product})</span>
            <span className="text-2"> grew {growthLabel(top.peakGrowth)} in week {top.peakWeek}, from {n(top.weekly[top.peakWeek - 2])} to {n(top.weekly[top.peakWeek - 1])} complaints.</span></div>
          <span className="ml-auto text-xs font-semibold inline-flex items-center gap-1 shrink-0" style={{ color: 'var(--brand)' }}>Read the theme<ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" aria-hidden /></span>
        </Link>
      )}
      {!th.data && !th.error && <Skeleton className="h-12" />}

      <div className="grid lg:grid-cols-3 gap-4">
        <Card eyebrow="Volume" title="Weekly complaints by product" className="lg:col-span-2" right={<span className="text-xs muted">Week {weekly.length} is partial</span>}>
          <div className="h-72" role="img" aria-label={`Stacked area chart of weekly complaints by product. Deposits go from ${weekly[1].Deposits} in week 2 to ${weekly[2].Deposits} in week 3.`}>
            <ResponsiveContainer>
              <AreaChart data={weekly} margin={{ left: -6, right: 8, top: 8 }}>
                <CartesianGrid stroke="var(--rule)" vertical={false} />
                <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} />
                <YAxis tick={AXIS} axisLine={false} tickLine={false} width={44} />
                <Tooltip content={<ChartTip />} labelFormatter={(l, p) => `${l} · from ${day(String(p?.[0]?.payload?.start ?? ''))}`} />
                <Legend verticalAlign="top" align="left" iconType="square" wrapperStyle={{ fontSize: 12, paddingBottom: 8 }} />
                <ReferenceLine x="Wk 3" stroke="var(--amber)" strokeDasharray="4 3" label={{ value: 'App update', position: 'insideTopRight', fill: 'var(--amber)', fontSize: 11 }} />
                {PRODUCTS.map((p) => <Area key={p} dataKey={p} stackId="a" type="monotone" stroke={PRODUCT_COLORS[p]} fill={PRODUCT_COLORS[p]} fillOpacity={0.78} strokeWidth={1.5} />)}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card eyebrow="Conduct risk" title="Regulatory flags" right={<PoweredBy>AI_CLASSIFY multi-label</PoweredBy>}>
          <ul className="space-y-3.5">
            {d.flags.map((f) => (
              <li key={f.flag}>
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <Link className="font-semibold hover:underline" href={`/queue?view=${FLAG_VIEW[f.flag] ?? 'open'}`}>{f.flag}</Link>
                  <span className="tabular">{n(f.complaints)} <span className="muted text-xs">· {n(f.open)} open</span></span>
                </div>
                <div className="h-1.5 rounded-full mt-1.5" style={{ background: 'var(--paper-2)' }}><div className="h-full rounded-full" style={{ width: `${Math.max(2, (f.complaints / flagMax) * 100)}%`, background: f.flag === 'Fair lending' ? 'var(--danger)' : f.flag === 'UDAAP' ? 'var(--amber)' : 'var(--signal)' }} /></div>
              </li>
            ))}
            <li className="pt-3 border-t" style={{ borderColor: 'var(--rule)' }}>
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <Link className="font-semibold hover:underline" href="/queue?view=duplicates">Likely duplicates</Link>
                <span className="tabular">{n(k.duplicates)}</span>
              </div>
              <div className="text-xs muted mt-1">Same customer, similar text · <span style={{ color: 'var(--signal)' }}>AI_EMBED</span></div>
            </li>
            {k.fairLending > 0 && <li><Link href="/queue?view=fair-lending" className="btn btn-primary w-full justify-center text-xs">Review {n(k.fairLending)} fair-lending complaints</Link></li>}
          </ul>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card eyebrow="Channels" title="Where complaints arrive">
          <ul className="space-y-2.5">
            {d.channels.map((c) => (
              <li key={c.channel} className="text-sm">
                <div className="flex justify-between gap-2"><span>{c.channel}</span><span className="tabular">{n(c.complaints)} <span className="muted text-xs">· {pct(c.highRisk / c.complaints, 0)} high-risk</span></span></div>
                <div className="flex h-2 rounded-full overflow-hidden mt-1" style={{ background: 'var(--paper-2)' }} aria-hidden>
                  <div style={{ width: `${(c.highRisk / chanMax) * 100}%`, background: 'var(--brand)' }} />
                  <div style={{ width: `${((c.complaints - c.highRisk) / chanMax) * 100}%`, background: 'color-mix(in srgb, var(--brand) 25%, var(--paper-2))' }} />
                </div>
              </li>
            ))}
          </ul>
          <div className="flex gap-4 text-[11px] muted mt-3"><span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-sm" style={{ background: 'var(--brand)' }} />High-risk</span><span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-sm" style={{ background: 'color-mix(in srgb, var(--brand) 25%, var(--paper-2))' }} />Other</span></div>
        </Card>
        <Card eyebrow="Aging" title="Open complaints by age" className="lg:col-span-2">
          <div className="h-56" role="img" aria-label={`Open complaints by age: ${d.aging.map((a) => `${a.bucket} ${a.open}`).join(', ')}`}>
            <ResponsiveContainer>
              <BarChart data={d.aging} margin={{ left: -6, right: 8, top: 8 }}>
                <CartesianGrid stroke="var(--rule)" vertical={false} />
                <XAxis dataKey="bucket" tick={AXIS} axisLine={false} tickLine={false} />
                <YAxis tick={AXIS} axisLine={false} tickLine={false} width={44} />
                <Tooltip content={<ChartTip />} cursor={{ fill: 'var(--paper-2)' }} />
                <Bar dataKey="open" name="Open complaints" fill="var(--signal)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card eyebrow="Deadlines" title="Due in 3 days, by subcategory" pad={false}>
          <table className="ledger">
            <thead><tr><th scope="col">Subcategory</th><th scope="col" className="!text-right">Due</th><th scope="col" className="!text-right">Of open</th></tr></thead>
            <tbody>{d.dueSoonBy.map((x) => <tr key={x.subcategory + x.product}><td>{x.subcategory}<div className="text-[11px] muted">{x.product}</div></td><td className="text-right tabular">{n(x.open)}</td>
              <td className="text-right">{x.shareOfOpen >= 0.2 ? <Tag tone="warn">{pct(x.shareOfOpen, 0)}</Tag> : <span className="tabular text-2">{pct(x.shareOfOpen, 0)}</span>}</td></tr>)}</tbody>
          </table>
        </Card>
        <Card eyebrow="Deadlines" title="Response due next" className="lg:col-span-2" pad={false} right={<Link className="btn text-xs" href="/queue?view=due-soon">All {n(k.dueSoon)} in the queue<ArrowRight className="w-3.5 h-3.5" aria-hidden /></Link>}>
          <ComplaintTable rows={d.dueSoon.slice(0, 8)} compact />
        </Card>
      </div>
    </div>
  );
}
