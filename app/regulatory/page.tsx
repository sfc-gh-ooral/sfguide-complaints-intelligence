'use client';

// Regulatory view: the internal AI taxonomy rolled up to a regulator-style product and issue list, with
// an on-time chart and a CSV export, plus the activity log as evidence of every decision taken in the app.
import { ChevronDown, Download } from 'lucide-react';
import { Fragment, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { n, pct, stamp } from '@/components/fmt';
import { Empty, ErrorBox, Tag } from '@/components/Status';
import { AXIS, Card, ChartTip, Docket, Kpi, PoweredBy, ScreenSkeleton, SourceBadge, TableSkeleton } from '@/components/ui';
import { useAsync } from '@/components/useAsync';
import { data } from '@/lib/client';
import type { RegulatoryRow } from '@/lib/types';

const csv = (rows: RegulatoryRow[]) => {
  const esc = (v: unknown) => (/[",\n]/.test(String(v ?? '')) ? `"${String(v).replaceAll('"', '""')}"` : String(v ?? ''));
  return ['Regulator product,Regulator issue,Internal subcategory,Complaints,Open,High-risk,On-time rate',
    ...rows.map((r) => [r.regulator_product, r.regulator_issue, r.subcategory, r.complaints, r.open, r.high_risk, r.on_time_rate == null ? '' : r.on_time_rate.toFixed(3)].map(esc).join(','))].join('\n');
};

export default function RegulatoryPage() {
  const { data: d, error } = useAsync(() => data.regulatory(), []);
  const log = useAsync(() => data.activity(), []);
  const [closed, setClosed] = useState<Set<string>>(new Set());
  if (error) return <ErrorBox error={error} />;
  if (!d) return <ScreenSkeleton label="Mapping the taxonomy" />;
  const products = [...new Set(d.rows.map((r) => r.regulator_product))];
  const byProduct = products.map((p) => {
    const rows = d.rows.filter((r) => r.regulator_product === p);
    const complaints = rows.reduce((a, r) => a + r.complaints, 0);
    const timed = rows.filter((r) => r.on_time_rate != null);
    const w = timed.reduce((a, r) => a + (r.complaints - r.open), 0);
    const onTime = w ? timed.reduce((a, r) => a + (r.on_time_rate ?? 0) * (r.complaints - r.open), 0) / w : 0;
    return { p, rows, complaints, open: rows.reduce((a, r) => a + r.open, 0), high: rows.reduce((a, r) => a + r.high_risk, 0), onTime };
  });
  const total = byProduct.reduce((a, x) => a + x.complaints, 0);
  const issues = d.rows.length;
  const below = d.rows.filter((r) => r.on_time_rate != null && r.on_time_rate < 0.9).length;
  const download = () => {
    const url = URL.createObjectURL(new Blob([csv(d.rows)], { type: 'text/csv' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: 'complaints-by-regulator-issue.csv' });
    a.click(); URL.revokeObjectURL(url);
  };
  const toggle = (p: string) => setClosed((s) => { const x = new Set(s); if (x.has(p)) x.delete(p); else x.add(p); return x; });

  return (
    <div className="space-y-5">
      <Docket eyebrow="Reporting and evidence" title="Regulatory view" refLine={`${n(total)} complaints · ${products.length} regulator products · ${issues} issue mappings`}
        right={<><PoweredBy>AI_CLASSIFY</PoweredBy><SourceBadge p={d} /><button className="btn btn-primary text-xs" onClick={download}><Download className="w-4 h-4" aria-hidden />Export CSV</button></>}>
        AI subcategories rolled up to a regulator-style product and issue list (illustrative, not an official list), with every decision kept as evidence.
      </Docket>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 stagger">
        <Kpi label="Regulator products" value={products.length} format={(x) => n(Math.round(x))} sub={`${issues} internal subcategories mapped`} />
        <Kpi label="Open" value={byProduct.reduce((a, x) => a + x.open, 0)} format={(x) => n(Math.round(x))} sub="across all products" />
        <Kpi label="High-risk" value={byProduct.reduce((a, x) => a + x.high, 0) / total} format={(x) => pct(x)} sub="share with a regulatory flag" />
        <Kpi label="Issues under 90% on time" value={below} format={(x) => n(Math.round(x))} tone={below ? 'warn' : undefined} sub="resolved within 15 days" />
      </div>

      <div className="grid lg:grid-cols-3 gap-4 items-start">
        <Card eyebrow="Timeliness" title="On-time resolution by product">
          <div className="h-64" role="img" aria-label={`On-time resolution by regulator product: ${byProduct.map((x) => `${x.p} ${pct(x.onTime, 0)}`).join(', ')}`}>
            <ResponsiveContainer>
              <BarChart data={byProduct.map((x) => ({ name: x.p, v: Math.round(x.onTime * 1000) / 10 }))} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid stroke="var(--rule)" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tick={AXIS} axisLine={false} tickLine={false} unit="%" />
                <YAxis type="category" dataKey="name" tick={AXIS} width={110} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTip unit="%" />} cursor={{ fill: 'var(--paper-2)' }} />
                <Bar dataKey="v" name="On time" fill="var(--signal)" radius={[0, 4, 4, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card eyebrow="Taxonomy mapping" title="Complaints by regulator product and issue" className="lg:col-span-2" pad={false}>
          <div className="overflow-x-auto"><table className="ledger min-w-[680px]">
            <thead><tr><th scope="col">Regulator issue</th><th scope="col">Internal subcategory</th><th scope="col" className="!text-right">Complaints</th><th scope="col" className="!text-right">Open</th><th scope="col" className="!text-right">High-risk</th><th scope="col" className="!text-right">On time</th></tr></thead>
            <tbody>{byProduct.map((g) => (
              <Fragment key={g.p}>
                <tr><td colSpan={6} style={{ background: 'var(--paper-2)' }}>
                  <button className="flex items-center gap-2 w-full text-left font-semibold" onClick={() => toggle(g.p)} aria-expanded={!closed.has(g.p)}>
                    <ChevronDown className={`w-4 h-4 transition-transform ${closed.has(g.p) ? '-rotate-90' : ''}`} aria-hidden />
                    <span className="serif">{g.p}</span><span className="muted text-xs font-normal tabular">{n(g.complaints)} complaints · {n(g.open)} open</span>
                  </button></td></tr>
                {!closed.has(g.p) && g.rows.map((r) => (
                  <tr key={g.p + r.subcategory}>
                    <td>{r.regulator_issue}</td><td className="text-2">{r.subcategory}</td>
                    <td className="text-right tabular">{n(r.complaints)}</td><td className="text-right tabular">{n(r.open)}</td>
                    <td className="text-right tabular">{n(r.high_risk)}</td>
                    <td className="text-right">{r.on_time_rate == null ? <span className="muted">—</span> : <Tag tone={r.on_time_rate < 0.9 ? 'warn' : 'good'}>{pct(r.on_time_rate, 0)}</Tag>}</td>
                  </tr>))}
              </Fragment>))}</tbody>
          </table></div>
        </Card>
      </div>

      <Card eyebrow="Evidence" title="Activity log" pad={false} right={log.data && <SourceBadge p={log.data} />}>
        {log.error ? <div className="p-4"><ErrorBox error={log.error} /></div> : !log.data ? <TableSkeleton rows={4} /> : log.data.items.length ? (
          <div className="overflow-x-auto"><table className="ledger min-w-[640px]">
            <thead><tr><th scope="col">When</th><th scope="col">Who</th><th scope="col">Action</th><th scope="col">Object</th><th scope="col">Detail</th></tr></thead>
            <tbody>{log.data.items.map((a, i) => <tr key={i}><td className="whitespace-nowrap tabular">{stamp(a.ts)}</td><td>{a.actor}</td><td className="whitespace-nowrap">{a.action}{a.ai_assisted && <> <Tag tone="info">AI-assisted</Tag></>}</td><td className="tabular">{a.object_type} {a.object_id}</td><td className="text-xs text-2">{a.detail}</td></tr>)}</tbody>
          </table></div>
        ) : <Empty title="No decisions recorded yet">Routing, resolving and opening issues are recorded here with the user and time.</Empty>}
      </Card>
    </div>
  );
}
