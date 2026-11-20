'use client';

// One complaint: the text with PII masked by AI_REDACT, the AI category, regulatory flags, sentiment,
// the deadline, related complaints from the same customer, a labeled AI response draft, and the actions.
import { ArrowLeft, FileText, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { DueTag, FlagTags, SentimentTag } from '@/components/Complaints';
import { day, dayLong, stamp } from '@/components/fmt';
import { Reasoning } from '@/components/Reasoning';
import { ErrorBox, Tag } from '@/components/Status';
import { Card, PoweredBy, SampleAiBadge, SourceBadge, Thinking } from '@/components/ui';
import { useAsync } from '@/components/useAsync';
import { data } from '@/lib/client';
import type { CaseAction, Draft } from '@/lib/types';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><div className="text-[11px] uppercase tracking-wider muted font-semibold mb-1">{label}</div><div className="text-sm">{children}</div></div>;
}

function Detail({ id }: { id: string }) {
  const [rev, setRev] = useState(0);
  const { data: d, error } = useAsync(() => data.complaint(id), [id, rev], true);
  const red = useAsync(() => data.redact(id), [id]);
  const [draft, setDraft] = useState<Draft>();
  const [drafting, setDrafting] = useState(false);
  const [draftErr, setDraftErr] = useState<string>();
  const [edited, setEdited] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>();

  if (error) return <ErrorBox error={error} />;
  if (!d) return <Thinking label="Loading complaint" />;
  const c = d.complaint;
  if (!c) return <Card><p className="text-sm">Complaint {id} wasn&apos;t found. <Link className="underline" href="/queue">Back to the queue</Link></p></Card>;
  const open = c.status !== 'Resolved';

  const makeDraft = async () => {
    setDrafting(true); setDraftErr(undefined);
    try { const r = await data.draft(id); setDraft(r); setEdited(r.draft); } catch (e) { setDraftErr(String((e as Error).message)); } finally { setDrafting(false); }
  };
  const act = async (a: CaseAction, text: string) => {
    setBusy(true); setMsg(undefined);
    try { await data.updateCase(id, a, text, a === 'Resolve' && !!draft); setMsg(`${a}: saved to the activity log.`); setNote(''); setRev((x) => x + 1); }
    catch (e) { setMsg(String((e as Error).message)); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <Link href="/queue" className="text-sm inline-flex items-center gap-1 underline"><ArrowLeft className="w-4 h-4" />Complaint queue</Link>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold">{c.complaint_id} · {c.subcategory}</h1>
          <p className="text-sm text-2 mt-1">{c.product} · {c.channel} · received {dayLong(c.received_date)} · customer {c.customer_id}</p>
        </div>
        <div className="flex gap-2 flex-wrap items-center"><Tag tone={open ? 'warn' : 'good'}>{c.status}</Tag><DueTag r={c} /><SourceBadge p={d} /></div>
      </div>
      {c.flags.includes('Fair lending') && (
        <div role="note" className="card p-3 flex items-start gap-2 text-sm" style={{ borderColor: 'var(--negative)' }}>
          <ShieldAlert className="w-4 h-4 mt-0.5" style={{ color: 'var(--negative)' }} aria-hidden />
          <div><strong>Possible fair-lending concern.</strong> The text alleges different treatment on a protected basis. Route it to fair-lending review before responding.
            {c.routed_to && <span className="muted"> Routed to {c.routed_to}.</span>}</div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-4">
        <Card title="Complaint text (PII masked)" className="lg:col-span-2 min-w-0" right={<><PoweredBy>AI_REDACT</PoweredBy>{red.data && <SourceBadge p={red.data} />}</>}>
          {red.error ? <ErrorBox error={red.error} /> : !red.data ? <Reasoning kind="redact" /> : (
            <>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{red.data.text}</p>
              {red.data.source === 'mock' && <div className="mt-2"><SampleAiBadge /></div>}
              <p className="text-[11px] muted mt-2">The unmasked text stays in SRC.COMPLAINTS; this screen only shows the AI_REDACT output. AI masking is best-effort, so review it.</p>
            </>
          )}
        </Card>
        <Card title="AI classification" right={<PoweredBy>AI_CLASSIFY · AI_SENTIMENT</PoweredBy>}>
          <div className="space-y-3">
            <Field label="Category / subcategory">{c.category} / {c.subcategory}</Field>
            <Field label="Regulator-style mapping">{c.regulator_product} · {c.regulator_issue}</Field>
            <Field label="Regulatory flags"><FlagTags flags={c.flags} /></Field>
            <Field label="Sentiment"><SentimentTag s={c.sentiment} /></Field>
            <Field label="Response due">{dayLong(c.due_date)} ({c.age_days} days since receipt)</Field>
            {c.resolution && <Field label="Resolution">{c.resolution}{c.resolved_date && ` · ${day(c.resolved_date)}`}</Field>}
          </div>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card title="Suggested response draft" className="lg:col-span-2 min-w-0" right={<><PoweredBy>AI_COMPLETE</PoweredBy>{draft && <SourceBadge p={draft} />}</>}>
          {drafting ? <Reasoning kind="draft" /> : draft ? (
            <div className="space-y-2">
              <div className="flex gap-2 flex-wrap items-center"><Tag tone="info">AI draft · needs review</Tag>{draft.source === 'mock' && <SampleAiBadge />}<span className="text-[11px] muted">{draft.model}</span></div>
              <label className="sr-only" htmlFor="draft">Response draft</label>
              <textarea id="draft" className="input w-full text-sm" rows={8} value={edited} onChange={(e) => setEdited(e.target.value)} />
              <p className="text-[11px] muted">Drafts never leave the app. A person edits and sends the response through the normal channel.</p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-2">Draft a first response from the masked text, the AI category, and the due date.</p>
              <button className="btn btn-ai" onClick={makeDraft}><FileText className="w-4 h-4" aria-hidden />Draft a response</button>
              {draftErr && <ErrorBox error={draftErr} />}
            </div>
          )}
        </Card>
        <Card title="Decide">
          <div className="space-y-2">
            <label className="text-xs muted" htmlFor="note">Note (required to route or resolve)</label>
            <textarea id="note" className="input w-full text-sm" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What you checked and why" />
            <div className="flex flex-wrap gap-2">
              {open && c.status === 'Open' && <button className="btn text-xs" disabled={busy} onClick={() => act('Start work', note)}>Start work</button>}
              {open && <button className="btn text-xs" disabled={busy || !note.trim()} onClick={() => act('Route to fair-lending review', note)}>Route to fair-lending review</button>}
              {open && <button className="btn btn-primary text-xs" disabled={busy || !note.trim()} onClick={() => act('Resolve', note)}>Resolve</button>}
              {open && c.duplicate_of && <button className="btn text-xs" disabled={busy || !note.trim()} onClick={() => act('Link as duplicate', note)}>Link as duplicate of {c.duplicate_of}</button>}
            </div>
            {msg && <p className="text-xs" role="status">{msg}</p>}
            {c.history.length > 0 && (
              <ul className="text-xs space-y-1 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                {c.history.map((h, i) => <li key={i}><strong>{h.status}</strong>{h.routed_to && ` · ${h.routed_to}`} · {h.updated_by} · {stamp(h.updated_ts)}{h.note && <div className="muted">{h.note}</div>}</li>)}
              </ul>
            )}
          </div>
        </Card>
      </div>

      <Card title="Same customer" right={<PoweredBy>AI_EMBED + VECTOR_COSINE_SIMILARITY</PoweredBy>}>
        {c.related.length ? (
          <div className="overflow-x-auto relative"><table className="data-table min-w-[560px]">
            <thead><tr><th>Complaint</th><th>Received</th><th>Channel</th><th>AI subcategory</th><th>Status</th><th>Similarity</th></tr></thead>
            <tbody>{c.related.map((r) => <tr key={r.complaint_id}>
              <td><Link className="underline" href={`/complaint?id=${r.complaint_id}`}>{r.complaint_id}</Link></td><td>{day(r.received_date)}</td><td>{r.channel}</td><td>{r.subcategory}</td><td>{r.status}</td>
              <td>{r.similarity != null ? <Tag tone="warn">{r.similarity.toFixed(2)} · likely duplicate</Tag> : <span className="muted text-xs">different issue</span>}</td></tr>)}</tbody>
          </table></div>
        ) : <p className="text-sm muted">No other complaints from this customer in the six-week window.</p>}
      </Card>
    </div>
  );
}

function Page() {
  const id = useSearchParams().get('id') ?? '';
  return <Detail key={id} id={id} />;
}
export default function ComplaintPage() { return <Suspense fallback={<Thinking />}><Page /></Suspense>; }
