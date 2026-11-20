'use client';

// Complaint list rows and regulatory flag tags, shared by Overview and the queue.
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { day, dueLabel } from '@/components/fmt';
import { Tag } from '@/components/Status';
import type { ComplaintRow, Flag } from '@/lib/types';

const FLAG_TONE: Record<Flag, 'bad' | 'warn' | 'info'> = { 'Fair lending': 'bad', UDAAP: 'warn', Servicing: 'info' };
export function FlagTags({ flags }: { flags: Flag[] }) {
  if (!flags.length) return <span className="muted text-xs">None</span>;
  return <span className="inline-flex flex-wrap gap-1">{flags.map((f) => <Tag key={f} tone={FLAG_TONE[f] ?? 'muted'}>{f}</Tag>)}</span>;
}
export function SentimentTag({ s }: { s: string }) {
  return <Tag tone={s === 'negative' ? 'bad' : s === 'positive' ? 'good' : 'muted'}>{s}</Tag>;
}
export function DueTag({ r }: { r: Pick<ComplaintRow, 'status' | 'days_to_due'> }) {
  const open = r.status !== 'Resolved';
  return <Tag tone={!open ? 'muted' : r.days_to_due < 0 ? 'bad' : r.days_to_due <= 3 ? 'warn' : 'muted'}>{dueLabel(r.days_to_due, open)}</Tag>;
}

export function ComplaintTable({ rows, compact = false }: { rows: ComplaintRow[]; compact?: boolean }) {
  const router = useRouter();
  return (
    <div className="overflow-x-auto relative">
      <table className="data-table min-w-[760px]">
        <thead><tr><th>Complaint</th><th>Received</th><th>Channel</th><th>Product</th><th>AI subcategory</th><th>Flags</th>{!compact && <th>Sentiment</th>}<th>Status</th><th>Due</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.complaint_id} className="click" onClick={() => router.push(`/complaint?id=${r.complaint_id}`)}>
              <td className="whitespace-nowrap"><Link className="underline font-medium" href={`/complaint?id=${r.complaint_id}`} onClick={(e) => e.stopPropagation()}>{r.complaint_id}</Link>
                {r.duplicate_of && <div className="text-[11px] muted">Likely repeat of {r.duplicate_of}</div>}</td>
              <td className="whitespace-nowrap">{day(r.received_date)}</td>
              <td>{r.channel}</td><td>{r.product}</td><td>{r.subcategory}</td>
              <td><FlagTags flags={r.flags} /></td>
              {!compact && <td><SentimentTag s={r.sentiment} /></td>}
              <td className="whitespace-nowrap">{r.status}{r.routed_to && <div className="text-[11px] muted">{r.routed_to}</div>}</td>
              <td><DueTag r={r} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
