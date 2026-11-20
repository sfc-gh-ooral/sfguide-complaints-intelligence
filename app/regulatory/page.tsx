'use client';

// Regulatory view: the internal AI taxonomy mapped to a regulator-style product and issue list, with a
// CSV export, plus the activity log as evidence of every decision taken in the app.
import { Download } from 'lucide-react';
import { Fragment } from 'react';
import { n, pct, stamp } from '@/components/fmt';
import { ErrorBox, Tag } from '@/components/Status';
import { Card, PoweredBy, SourceBadge, Thinking } from '@/components/ui';
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
  if (error) return <ErrorBox error={error} />;
  if (!d) return <Thinking label="Mapping the taxonomy" />;
  const products = [...new Set(d.rows.map((r) => r.regulator_product))];
  const download = () => {
    const url = URL.createObjectURL(new Blob([csv(d.rows)], { type: 'text/csv' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: 'complaints-by-regulator-issue.csv' });
    a.click(); URL.revokeObjectURL(url);
  };
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold">Regulatory view</h1>
          <p className="text-sm text-2 mt-1">AI subcategories rolled up to a regulator-style product and issue list (illustrative, not an official list).</p>
        </div>
        <div className="flex gap-2 flex-wrap items-center"><PoweredBy>AI_CLASSIFY</PoweredBy><SourceBadge p={d} />
          <button className="btn btn-primary text-xs" onClick={download}><Download className="w-4 h-4" aria-hidden />Export CSV</button></div>
      </div>
      <Card title="Complaints by regulator product and issue">
        <div className="overflow-x-auto relative"><table className="data-table min-w-[720px]">
          <thead><tr><th>Regulator issue</th><th>Internal subcategory</th><th className="text-right">Complaints</th><th className="text-right">Open</th><th className="text-right">High-risk</th><th className="text-right">On time</th></tr></thead>
          <tbody>{products.map((p) => {
            const rows = d.rows.filter((r) => r.regulator_product === p);
            return (
              <Fragment key={p}>
                <tr><td colSpan={6} className="font-semibold" style={{ background: 'var(--surface-2)' }}>{p} · {n(rows.reduce((a, r) => a + r.complaints, 0))}</td></tr>
                {rows.map((r) => (
                  <tr key={p + r.subcategory}>
                    <td>{r.regulator_issue}</td><td>{r.subcategory}</td>
                    <td className="text-right tabular">{n(r.complaints)}</td><td className="text-right tabular">{n(r.open)}</td>
                    <td className="text-right tabular">{n(r.high_risk)}</td>
                    <td className="text-right tabular">{r.on_time_rate == null ? '—' : <Tag tone={r.on_time_rate < 0.9 ? 'warn' : 'muted'}>{pct(r.on_time_rate, 0)}</Tag>}</td>
                  </tr>))}
              </Fragment>);
          })}</tbody>
        </table></div>
      </Card>
      <Card title="Activity log (evidence)" right={log.data && <SourceBadge p={log.data} />}>
        {log.error ? <ErrorBox error={log.error} /> : !log.data ? <Thinking /> : log.data.items.length ? (
          <div className="overflow-x-auto relative"><table className="data-table min-w-[620px]">
            <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Object</th><th>Detail</th></tr></thead>
            <tbody>{log.data.items.map((a, i) => <tr key={i}><td className="whitespace-nowrap">{stamp(a.ts)}</td><td>{a.actor}</td><td>{a.action}{a.ai_assisted && <> <Tag tone="info">AI-assisted</Tag></>}</td><td>{a.object_type} {a.object_id}</td><td className="text-xs">{a.detail}</td></tr>)}</tbody>
          </table></div>
        ) : <p className="text-sm muted">No actions yet. Routing, resolving, and opening issues are recorded here with the user and time.</p>}
      </Card>
    </div>
  );
}
