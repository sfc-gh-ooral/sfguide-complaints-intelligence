'use client';

// One complaint as a case file: the text with PII masked by AI_REDACT, the AI classification, flags,
// sentiment and deadline, a streamed AI_COMPLETE response draft, the decision panel and its timeline,
// and other complaints from the same customer (AI_EMBED similarity).
import { ArrowLeft, Check, FileText, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { DueTag, FlagTags, SentimentTag, StatusTag } from '@/components/Complaints';
import { day, dayLong, stamp } from '@/components/fmt';
import { CachedNote, Reasoning } from '@/components/Reasoning';
import { ErrorBox, Tag } from '@/components/Status';
import { Card, Docket, PoweredBy, SampleAiBadge, ScreenSkeleton, SourceBadge, Sources, useStream } from '@/components/ui';
import { useAsync } from '@/components/useAsync';
import { data } from '@/lib/client';
import type { CaseAction, Draft } from '@/lib/types';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><dt className="muted text-xs mb-0.5">{label}</dt><dd className="text-sm">{children}</dd></div>;
}

function DraftBox({ draft, onChange }: { draft: Draft; onChange: (s: string) => void }) {
  const { shown, done } = useStream(draft.draft);
  const [edited, setEdited] = useState<string>();
  return (
    <div className="space-y-2 fade-up">
      <div className="flex gap-2 flex-wrap items-center"><Tag tone="info">AI draft · needs review</Tag>{draft.source === 'mock' && <SampleAiBadge />}<span className="text-[11px] muted">{draft.model}</span></div>
      <label className="sr-only" htmlFor="draft">Response draft</label>
      <textarea id="draft" className={`input w-full text-sm leading-relaxed ${done ? '' : 'caret'}`} rows={10} readOnly={!done} value={done ? (edited ?? draft.draft) : shown}
        onChange={(e) => { setEdited(e.target.value); onChange(e.target.value); }} />
      {done && <Sources items={[
        { label: 'Masked complaint text', detail: 'AI_REDACT output' },
        { label: 'AI category, flags and due date', detail: 'COMPLAINT_AI dynamic table' },
      ]} />}
      <p className="text-[11px] muted">Drafts never leave the app. A person edits and sends the response through the normal channel.</p>
    </div>
  );
}

function Detail({ id }: { id: string }) {
  const [rev, setRev] = useState(0);
  const { data: d, error } = useAsync(() => data.complaint(id), [id, rev], true);
  const red = useAsync(() => data.redact(id), [id]);
  const [draft, setDraft] = useState<Draft>();
  const [drafting, setDrafting] = useState(false);
  const [draftErr, setDraftErr] = useState<string>();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string }>();

  if (error) return <ErrorBox error={error} />;
  if (!d) return <ScreenSkeleton label="Loading complaint" tiles={0} />;
  const c = d.complaint;
  if (!c) return <Card><p className="text-sm">Complaint {id} wasn&apos;t found. <Link className="underline" href="/queue">Back to the queue</Link></p></Card>;
  const open = c.status !== 'Resolved';

  const makeDraft = async () => {
    setDrafting(true); setDraftErr(undefined);
    try { setDraft(await data.draft(id)); } catch (e) { setDraftErr(String((e as Error).message)); } finally { setDrafting(false); }
  };
  const act = async (a: CaseAction) => {
    setBusy(true); setMsg(undefined);
    try { await data.updateCase(id, a, note, a === 'Resolve' && !!draft); setMsg({ ok: true, text: `${a}: saved to the activity log.` }); setNote(''); setRev((x) => x + 1); }
    catch (e) { setMsg({ ok: false, text: String((e as Error).message) }); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-5">
      <Link href="/queue" className="text-sm inline-flex items-center gap-1 text-2 hover:underline"><ArrowLeft className="w-4 h-4" aria-hidden />Complaint queue</Link>
      <Docket eyebrow={`Case file · ${c.product} · ${c.channel}`} title={<><span className="tabular">{c.complaint_id}</span> <span className="text-2 font-normal">· {c.subcategory}</span></>}
        refLine={`Received ${dayLong(c.received_date)} · customer ${c.customer_id} · ${c.age_days} days open`}
        right={<><StatusTag s={c.status} /><DueTag r={c} /><SourceBadge p={d} /></>} />

      {c.flags.includes('Fair lending') && (
        <div role="note" className="card p-3 flex items-start gap-3 text-sm" style={{ borderLeft: '3px solid var(--danger)' }}>
          <ShieldAlert className="w-5 h-5 shrink-0" style={{ color: 'var(--danger)' }} aria-hidden />
          <div><strong>Possible fair-lending concern.</strong> The text alleges different treatment on a protected basis. Route it to fair-lending review before responding.
            {c.routed_to && <span className="muted"> Routed to {c.routed_to}.</span>}</div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-4 items-start">
        <div className="lg:col-span-2 space-y-4 min-w-0">
          <Card eyebrow="Customer's words" title="Complaint text, PII masked" right={<><PoweredBy>AI_REDACT</PoweredBy>{red.data && <SourceBadge p={red.data} />}</>}>
            {red.error ? <ErrorBox error={red.error} /> : !red.data ? <Reasoning kind="redact" /> : (
              <div className="fade-up">
                <blockquote className="serif text-[15px] leading-relaxed pl-4" style={{ borderLeft: '3px solid var(--brand)' }}>{red.data.text}</blockquote>
                <div className="flex gap-2 flex-wrap items-center mt-3">{red.data.source === 'mock' && <SampleAiBadge />}
                  <span className="text-[11px] muted">The unmasked text stays in SRC.COMPLAINTS; this screen shows only the AI_REDACT output. Masking is best-effort, so review it.</span></div>
                <CachedNote p={red.data} />
              </div>
            )}
          </Card>
          <Card eyebrow="First response" title="Suggested response draft" right={<><PoweredBy>AI_COMPLETE</PoweredBy>{draft && <SourceBadge p={draft} />}</>}>
            {drafting ? <Reasoning kind="draft" steps={['Masking PII with AI_REDACT', `Reading the category (${c.subcategory}) and due date (${day(c.due_date)})`, 'Drafting the response with AI_COMPLETE', 'Saving the draft for review']} />
              : draft ? <><DraftBox draft={draft} onChange={() => {}} /><CachedNote p={draft} /></> : (
                <div className="flex items-center gap-4 flex-wrap">
                  <p className="text-sm text-2 flex-1 min-w-[220px]">Draft a first response from the masked text, the AI category and the due date. You review and edit it before anything is sent.</p>
                  <button className="btn btn-ai" onClick={makeDraft}><FileText className="w-4 h-4" aria-hidden />Draft a response</button>
                  {draftErr && <div className="w-full"><ErrorBox error={draftErr} /></div>}
                </div>
              )}
          </Card>
          <Card eyebrow="Same customer" title="Other complaints from this customer" pad={false} right={<PoweredBy>AI_EMBED + VECTOR_COSINE_SIMILARITY</PoweredBy>}>
            {c.related.length ? (
              <div className="overflow-x-auto"><table className="ledger min-w-[560px]">
                <thead><tr><th scope="col">Complaint</th><th scope="col">Received</th><th scope="col">Channel</th><th scope="col">AI subcategory</th><th scope="col">Status</th><th scope="col">Similarity</th></tr></thead>
                <tbody>{c.related.map((r) => <tr key={r.complaint_id}>
                  <td><Link className="font-semibold hover:underline tabular" href={`/complaint?id=${r.complaint_id}`}>{r.complaint_id}</Link></td><td className="tabular">{day(r.received_date)}</td><td>{r.channel}</td><td>{r.subcategory}</td><td><StatusTag s={r.status} /></td>
                  <td>{r.similarity != null ? <Tag tone="warn">{r.similarity.toFixed(2)} · likely duplicate</Tag> : <span className="muted text-xs">Different issue</span>}</td></tr>)}</tbody>
              </table></div>
            ) : <p className="text-sm muted p-4">No other complaints from this customer in the six-week window.</p>}
          </Card>
        </div>

        <div className="space-y-4 min-w-0 lg:sticky lg:top-[72px]">
          <Card eyebrow="Classified on arrival" title="AI classification" right={<PoweredBy>AI_CLASSIFY · AI_SENTIMENT</PoweredBy>}>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
              <Field label="Category">{c.category}</Field>
              <Field label="Subcategory">{c.subcategory}</Field>
              <div className="col-span-2"><Field label="Regulator-style mapping (illustrative)">{c.regulator_product} · {c.regulator_issue}</Field></div>
              <Field label="Flags"><FlagTags flags={c.flags} /></Field>
              <Field label="Sentiment"><SentimentTag s={c.sentiment} /></Field>
              <div className="col-span-2"><Field label="Response due">{dayLong(c.due_date)}</Field></div>
              {c.resolution && <div className="col-span-2"><Field label="Resolution">{c.resolution}{c.resolved_date && ` · ${day(c.resolved_date)}`}</Field></div>}
            </dl>
          </Card>
          <Card eyebrow="Decide" title={open ? 'Record a decision' : 'Resolved'}>
            {open ? (
              <div className="space-y-2.5">
                <label className="text-xs muted block" htmlFor="note">Note (required to route, resolve or link)</label>
                <textarea id="note" className="input w-full text-sm" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What you checked and why" />
                <div className="grid gap-2">
                  {c.status === 'Open' && <button className="btn justify-center text-xs" disabled={busy} onClick={() => act('Start work')}>Start work</button>}
                  <button className="btn justify-center text-xs" disabled={busy || !note.trim()} onClick={() => act('Route to fair-lending review')}>Route to fair-lending review</button>
                  {c.duplicate_of && <button className="btn justify-center text-xs" disabled={busy || !note.trim()} onClick={() => act('Link as duplicate')}>Link as duplicate of {c.duplicate_of}</button>}
                  <button className="btn btn-primary justify-center text-xs" disabled={busy || !note.trim()} onClick={() => act('Resolve')}><Check className="w-3.5 h-3.5" aria-hidden />Resolve{draft ? ' (AI-assisted)' : ''}</button>
                </div>
                {msg && <p className="text-xs font-semibold" role="status" style={{ color: msg.ok ? 'var(--ok)' : 'var(--danger)' }}>{msg.text}</p>}
              </div>
            ) : <p className="text-sm text-2">This complaint is resolved. Its decisions are in the timeline below and in the activity log.</p>}
            {c.history.length > 0 && (
              <ol className="mt-4 pt-3 border-t space-y-3" style={{ borderColor: 'var(--rule)' }}>
                {c.history.map((h, i) => (
                  <li key={i} className="flex gap-2.5 text-xs">
                    <span className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: i === 0 ? 'var(--brand)' : 'var(--rule)' }} aria-hidden />
                    <div><div><strong>{h.status}</strong>{h.routed_to && ` · ${h.routed_to}`}</div><div className="muted tabular">{h.updated_by} · {stamp(h.updated_ts)}</div>{h.note && <div className="text-2 mt-0.5">{h.note}</div>}</div>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function Page() {
  const id = useSearchParams().get('id') ?? '';
  return <Detail key={id} id={id} />;
}
export default function ComplaintPage() { return <Suspense fallback={<ScreenSkeleton label="Loading complaint" tiles={0} />}><Page /></Suspense>; }
