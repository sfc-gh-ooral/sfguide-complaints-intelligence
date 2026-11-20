'use client';

// Overview: volume by product and channel, the share flagged high-risk, on-time resolution, aging of
// open complaints, and the complaints whose response is due in the next three days.
import Link from 'next/link';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ComplaintTable } from '@/components/Complaints';
import { PRODUCT_COLORS, TIP, day, dayLong, n, pct } from '@/components/fmt';
import { ErrorBox, Tag } from '@/components/Status';
import { Card, Kpi, PoweredBy, SourceBadge, Thinking } from '@/components/ui';
import { useAsync } from '@/components/useAsync';
import { data } from '@/lib/client';
import { PRODUCTS } from '@/lib/types';

export default function OverviewPage() {
  const { data: d, error } = useAsync(() => data.overview(), []);
  if (error) return <ErrorBox error={error} />;
  if (!d) return <Thinking label="Loading complaints" />;
  const k = d.kpis;
  const weekly = d.weekly.map((w) => ({ ...w, label: `Wk ${w.week} · ${day(w.start)}` }));
  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold">Complaints overview</h1>
          <p className="text-sm text-2 mt-1">Six weeks of complaints across five channels · business date {dayLong(d.asOf)}</p>
        </div>
        <div className="flex gap-2 flex-wrap"><PoweredBy>Dynamic Tables + AI_CLASSIFY</PoweredBy><SourceBadge p={d} /></div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Complaints" value={n(k.total)} sub={`${n(k.open)} open or in progress`} />
        <Kpi label="Flagged high-risk" value={pct(k.highRisk / k.total)} sub={`${n(k.highRisk)} with a UDAAP, fair-lending, or servicing flag`} />
        <Kpi label="Resolved on time" value={pct(k.onTimeRate)} sub={`of ${n(k.resolved)} resolved · 15-day window (illustrative)`} />
        <Kpi label="Due in 3 days" value={n(k.dueSoon)} sub={`${n(k.overdue)} already overdue`} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card title="Weekly volume by product" className="lg:col-span-2 min-w-0" right={<span className="text-xs muted">Week 3 starts Oct 19</span>}>
          <div className="h-64" role="img" aria-label={`Stacked bar chart of weekly complaints by product. Deposits rise from ${weekly[1].Deposits} in week 2 to ${weekly[2].Deposits} in week 3.`}>
            <ResponsiveContainer>
              <BarChart data={weekly} margin={{ left: -10, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--muted)' }} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--muted)' }} />
                <Tooltip contentStyle={TIP} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {PRODUCTS.map((p) => <Bar key={p} dataKey={p} stackId="a" fill={PRODUCT_COLORS[p]} />)}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Regulatory flags" right={<PoweredBy>AI_CLASSIFY multi-label</PoweredBy>}>
          <ul className="space-y-3">
            {d.flags.map((f) => (
              <li key={f.flag} className="flex items-center justify-between gap-2">
                <Link className="underline text-sm" href={f.flag === 'Fair lending' ? '/queue?view=fair-lending' : f.flag === 'UDAAP' ? '/queue?view=udaap' : '/queue'}>{f.flag}</Link>
                <span className="text-sm tabular">{n(f.complaints)} <span className="muted text-xs">({n(f.open)} open)</span></span>
              </li>
            ))}
            <li className="flex items-center justify-between gap-2 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
              <Link className="underline text-sm" href="/queue?view=duplicates">Likely duplicates</Link>
              <span className="text-sm tabular">{n(k.duplicates)} <PoweredBy>AI_EMBED</PoweredBy></span>
            </li>
          </ul>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card title="By channel" className="min-w-0">
          <table className="data-table">
            <thead><tr><th>Channel</th><th className="text-right">Complaints</th><th className="text-right">High-risk</th></tr></thead>
            <tbody>{d.channels.map((c) => <tr key={c.channel}><td>{c.channel}</td><td className="text-right tabular">{n(c.complaints)}</td><td className="text-right tabular">{pct(c.highRisk / c.complaints, 0)}</td></tr>)}</tbody>
          </table>
        </Card>
        <Card title="Aging of open complaints" className="lg:col-span-2 min-w-0">
          <div className="h-48" role="img" aria-label={`Open complaints by age: ${d.aging.map((a) => `${a.bucket} ${a.open}`).join(', ')}`}>
            <ResponsiveContainer>
              <BarChart data={d.aging} layout="vertical" margin={{ left: 20, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--muted)' }} />
                <YAxis type="category" dataKey="bucket" tick={{ fontSize: 11, fill: 'var(--muted)' }} width={80} />
                <Tooltip contentStyle={TIP} />
                <Bar dataKey="open" name="Open complaints" fill="var(--chart-1)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card title="Deadlines in the next 3 days, by AI subcategory">
        <div className="overflow-x-auto relative"><table className="data-table min-w-[520px]">
          <thead><tr><th>Subcategory</th><th>Product</th><th className="text-right">Due in 3 days</th><th className="text-right">Share of its open complaints</th></tr></thead>
          <tbody>{d.dueSoonBy.map((x) => <tr key={x.subcategory + x.product}><td>{x.subcategory}</td><td>{x.product}</td><td className="text-right tabular">{n(x.open)}</td>
            <td className="text-right tabular">{x.shareOfOpen >= 0.2 ? <Tag tone="warn">{pct(x.shareOfOpen, 0)}</Tag> : pct(x.shareOfOpen, 0)}</td></tr>)}</tbody>
        </table></div>
      </Card>

      <Card title="Response due in the next 3 days" right={<><Tag tone="warn">{n(k.dueSoon)} due</Tag><Link className="btn text-xs" href="/queue?view=due-soon">Open in queue</Link></>}>
        <ComplaintTable rows={d.dueSoon} compact />
      </Card>
    </div>
  );
}
