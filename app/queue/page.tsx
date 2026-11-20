'use client';

// Work queue: saved views (fair-lending review, due soon, overdue, likely duplicates, UDAAP) by product.
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { ComplaintTable } from '@/components/Complaints';
import { n } from '@/components/fmt';
import { ErrorBox } from '@/components/Status';
import { Card, PoweredBy, SourceBadge, Thinking } from '@/components/ui';
import { useAsync } from '@/components/useAsync';
import { data } from '@/lib/client';
import { PRODUCTS, VIEWS, type View } from '@/lib/types';

const POWERED: Partial<Record<View, string>> = { 'fair-lending': 'AI_CLASSIFY multi-label', udaap: 'AI_CLASSIFY multi-label', duplicates: 'AI_EMBED + VECTOR_COSINE_SIMILARITY' };

function Queue() {
  const params = useSearchParams();
  const router = useRouter();
  const view = (params.get('view') && params.get('view')! in VIEWS ? params.get('view') : 'open') as View;
  const product = params.get('product') && (PRODUCTS as readonly string[]).includes(params.get('product')!) ? params.get('product')! : 'All';
  const { data: q, error, loading } = useAsync(() => data.queue(view, product), [view, product], true);
  const go = (v: View, p: string) => router.push(`/queue?view=${v}${p !== 'All' ? `&product=${encodeURIComponent(p)}` : ''}`);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold">Complaint queue</h1>
          <p className="text-sm text-2 mt-1">Open the most urgent complaints first. Every row was classified as it arrived.</p>
        </div>
        <div className="flex gap-2 flex-wrap">{POWERED[view] && <PoweredBy>{POWERED[view]}</PoweredBy>}<SourceBadge p={q} /></div>
      </div>
      <div className="flex gap-2 flex-wrap" role="tablist" aria-label="Saved views">
        {(Object.keys(VIEWS) as View[]).map((v) => (
          <button key={v} role="tab" aria-selected={v === view} className={`btn text-xs ${v === view ? 'btn-primary' : ''}`} onClick={() => go(v, product)}>{VIEWS[v]}</button>
        ))}
      </div>
      <Card title={q ? `${VIEWS[view]} · ${n(q.total)} complaint${q.total === 1 ? '' : 's'}${q.total > q.rows.length ? ` (showing ${q.rows.length})` : ''}` : VIEWS[view]}
        right={<label className="text-xs muted flex items-center gap-2">Product
          <select className="input" value={product} onChange={(e) => go(view, e.target.value)}>
            <option>All</option>{PRODUCTS.map((p) => <option key={p}>{p}</option>)}
          </select></label>}>
        {error ? <ErrorBox error={error} /> : !q ? <Thinking label="Loading queue" /> : (
          <div style={{ opacity: loading ? 0.5 : 1 }}>
            {q.rows.length ? <ComplaintTable rows={q.rows} /> : <p className="text-sm muted">No complaints in this view for {product}.</p>}
          </div>
        )}
      </Card>
    </div>
  );
}

export default function QueuePage() { return <Suspense fallback={<Thinking />}><Queue /></Suspense>; }
