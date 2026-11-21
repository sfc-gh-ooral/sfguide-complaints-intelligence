'use client';

// Quick view of one complaint in a right-hand drawer: masked text, AI classification and deadline.
// Escape closes it, focus moves in on open and back to the row on close.
import { ArrowRight, ShieldAlert, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { DueTag, FlagTags, SentimentTag, StatusTag } from '@/components/Complaints';
import { dayLong } from '@/components/fmt';
import { CachedNote, Reasoning } from '@/components/Reasoning';
import { ErrorBox } from '@/components/Status';
import { PoweredBy, SampleAiBadge, Skeleton, SourceBadge } from '@/components/ui';
import { useAsync } from '@/components/useAsync';
import { data } from '@/lib/client';
import type { ComplaintRow } from '@/lib/types';

export function ComplaintDrawer({ row, onClose }: { row: ComplaintRow; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const back = useRef<Element | null>(null);
  const d = useAsync(() => data.complaint(row.complaint_id), [row.complaint_id]);
  const red = useAsync(() => data.redact(row.complaint_id), [row.complaint_id]);
  useEffect(() => {
    back.current = document.activeElement; ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab' && ref.current) { // keep focus inside the drawer
        const f = ref.current.querySelectorAll<HTMLElement>('a,button,textarea,select,input');
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); (back.current as HTMLElement | null)?.focus?.(); };
  }, [onClose]);
  const c = d.data?.complaint;

  return createPortal(
    <>
      <div className="scrim" onClick={onClose} aria-hidden />
      <div ref={ref} tabIndex={-1} className="drawer outline-none" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
        <div className="sticky top-0 z-10 flex items-start gap-3 px-5 py-4 border-b" style={{ background: 'var(--paper)', borderColor: 'var(--rule)' }}>
          <div className="min-w-0">
            <div className="eyebrow">Quick view · {row.product} · {row.channel}</div>
            <h2 id="drawer-title" className="serif text-xl font-semibold mt-0.5">{row.complaint_id}</h2>
            <div className="flex gap-1.5 flex-wrap mt-1.5"><StatusTag s={row.status} /><DueTag r={row} /><FlagTags flags={row.flags} /></div>
          </div>
          <button className="btn !px-2 ml-auto" onClick={onClose} aria-label="Close quick view"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-5">
          {row.flags.includes('Fair lending') && (
            <div role="note" className="flex gap-2 text-sm rounded-lg p-3" style={{ background: 'var(--danger-soft)' }}>
              <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" style={{ color: 'var(--danger)' }} aria-hidden />
              <span><strong>Possible fair-lending concern.</strong> Route to fair-lending review before responding.</span>
            </div>
          )}
          <section>
            <div className="flex items-center justify-between gap-2 mb-2"><h3 className="eyebrow">Complaint text · PII masked</h3><div className="flex gap-1.5"><PoweredBy>AI_REDACT</PoweredBy>{red.data && <SourceBadge p={red.data} />}</div></div>
            {red.error ? <ErrorBox error={red.error} /> : !red.data ? <Reasoning kind="redact" /> : (
              <div className="fade-up">
                <p className="text-sm leading-relaxed rounded-lg p-3" style={{ background: 'var(--paper-2)' }}>{red.data.text}</p>
                {red.data.source === 'mock' && <div className="mt-2"><SampleAiBadge /></div>}
                <CachedNote p={red.data} />
              </div>
            )}
          </section>
          <section>
            <h3 className="eyebrow mb-2">AI classification</h3>
            {d.error ? <ErrorBox error={d.error} /> : !c ? <div className="space-y-2"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-4 w-1/2" /><Skeleton className="h-4 w-2/3" /></div> : (
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm fade-up">
                <div><dt className="muted text-xs">Category</dt><dd>{c.category}</dd></div>
                <div><dt className="muted text-xs">Subcategory</dt><dd>{c.subcategory}</dd></div>
                <div><dt className="muted text-xs">Regulator-style issue</dt><dd>{c.regulator_issue}</dd></div>
                <div><dt className="muted text-xs">Sentiment</dt><dd><SentimentTag s={c.sentiment} /></dd></div>
                <div><dt className="muted text-xs">Received</dt><dd>{dayLong(c.received_date)}</dd></div>
                <div><dt className="muted text-xs">Response due</dt><dd>{dayLong(c.due_date)}</dd></div>
                {c.related.length > 0 && <div className="col-span-2"><dt className="muted text-xs">Same customer</dt><dd>{c.related.length} other complaint{c.related.length > 1 ? 's' : ''}{c.duplicate_of && <>, likely repeat of <strong>{c.duplicate_of}</strong></>}</dd></div>}
              </dl>
            )}
          </section>
          <Link href={`/complaint?id=${row.complaint_id}`} className="btn btn-primary w-full justify-center">Open the case file to draft and decide<ArrowRight className="w-4 h-4" aria-hidden /></Link>
        </div>
      </div>
    </>,
    document.body,
  );
}
