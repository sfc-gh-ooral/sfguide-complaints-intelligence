'use client';

// Work queue: saved views (fair-lending review, due soon, overdue, likely duplicates, UDAAP), a product
// filter, a text filter, sortable columns, and a quick-view drawer for each complaint.
import { Search } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useMemo, useState } from 'react';
import { ComplaintTable } from '@/components/Complaints';
import { ComplaintDrawer } from '@/components/Drawer';
import { n } from '@/components/fmt';
import { Empty, ErrorBox } from '@/components/Status';
import { Card, Docket, PoweredBy, ScreenSkeleton, SourceBadge, TableSkeleton } from '@/components/ui';
import { useAsync } from '@/components/useAsync';
import { data } from '@/lib/client';
import { PRODUCTS, VIEWS, type ComplaintRow, type View } from '@/lib/types';

const POWERED: Partial<Record<View, string>> = { 'fair-lending': 'AI_CLASSIFY multi-label', udaap: 'AI_CLASSIFY multi-label', duplicates: 'AI_EMBED + VECTOR_COSINE_SIMILARITY' };
const HINT: Record<View, string> = {
  open: 'Everything not yet resolved, soonest deadline first.',
  'fair-lending': 'Text that alleges different treatment on a protected basis. Route before responding.',
  'due-soon': 'Responses due within three days of the business date.',
  overdue: 'Past the illustrative 15-day response window.',
  duplicates: 'Same customer, different channel, near-identical text.',
  udaap: 'Possible unfair, deceptive or abusive practices.',
};

function Queue() {
  const params = useSearchParams();
  const router = useRouter();
  const view = (params.get('view') && params.get('view')! in VIEWS ? params.get('view') : 'open') as View;
  const product = params.get('product') && (PRODUCTS as readonly string[]).includes(params.get('product')!) ? params.get('product')! : 'All';
  const { data: q, error, loading } = useAsync(() => data.queue(view, product), [view, product], true);
  const [text, setText] = useState('');
  const [sel, setSel] = useState<ComplaintRow>();
  const go = (v: View, p: string) => router.push(`/queue?view=${v}${p !== 'All' ? `&product=${encodeURIComponent(p)}` : ''}`);
  const rows = useMemo(() => {
    const t = text.trim().toLowerCase();
    return !q ? [] : !t ? q.rows : q.rows.filter((r) => [r.complaint_id, r.customer_id, r.subcategory, r.channel, r.status, ...r.flags].some((v) => v.toLowerCase().includes(t)));
  }, [q, text]);

  if (!q && !error) return <ScreenSkeleton label="Loading queue" tiles={0} />;
  return (
    <div className="space-y-5">
      <Docket eyebrow="Work queue" title="Complaint queue" refLine={q ? `${n(q.total)} complaints in “${VIEWS[view]}”${product !== 'All' ? ` · ${product}` : ''}` : undefined}
        right={<>{POWERED[view] && <PoweredBy>{POWERED[view]}</PoweredBy>}<SourceBadge p={q} /></>}>
        Open the most urgent complaints first. Every row was classified as it arrived; click one for a quick view.
      </Docket>

      <div className="flex gap-3 flex-wrap items-center justify-between">
        <div className="seg overflow-x-auto no-scrollbar max-w-full" role="tablist" aria-label="Saved views">
          {(Object.keys(VIEWS) as View[]).map((v) => <button key={v} role="tab" aria-selected={v === view} onClick={() => go(v, product)}>{VIEWS[v]}</button>)}
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <label className="relative">
            <span className="sr-only">Filter rows</span>
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 muted" aria-hidden />
            <input className="input !pl-8 w-56" value={text} onChange={(e) => setText(e.target.value)} placeholder="Filter by ID, subcategory, flag" />
          </label>
          <label className="text-xs muted flex items-center gap-2">Product
            <select className="input" value={product} onChange={(e) => go(view, e.target.value)}><option>All</option>{PRODUCTS.map((p) => <option key={p}>{p}</option>)}</select>
          </label>
        </div>
      </div>

      <Card pad={false} eyebrow={VIEWS[view]} title={HINT[view]}
        right={q && <span className="text-xs muted tabular">{text ? `${n(rows.length)} match · ` : ''}showing {n(q.rows.length)} of {n(q.total)}</span>}>
        {error ? <div className="p-4"><ErrorBox error={error} /></div> : !q || loading ? <TableSkeleton /> : rows.length
          ? <div className="fade-up"><ComplaintTable rows={rows} onSelect={setSel} selected={sel?.complaint_id} /></div>
          : <Empty title="Nothing in this view">{text ? `No rows match “${text}”.` : `No complaints in “${VIEWS[view]}” for ${product}.`}</Empty>}
      </Card>
      {sel && <ComplaintDrawer row={sel} onClose={() => setSel(undefined)} />}
    </div>
  );
}

export default function QueuePage() { return <Suspense fallback={<ScreenSkeleton label="Loading queue" tiles={0} />}><Queue /></Suspense>; }
