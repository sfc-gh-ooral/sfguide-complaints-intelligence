'use client';

// Complaint rows, status pills and regulatory flag tags, shared by Overview, the queue and the drawer.
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
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
export function StatusTag({ s }: { s: string }) {
  return <Tag tone={s === 'Resolved' ? 'good' : s === 'In progress' ? 'info' : s.startsWith('Routed') || s.includes('review') ? 'brand' : 'muted'}>{s}</Tag>;
}
export function DueTag({ r }: { r: Pick<ComplaintRow, 'status' | 'days_to_due'> }) {
  const open = r.status !== 'Resolved';
  return <Tag tone={!open ? 'muted' : r.days_to_due < 0 ? 'bad' : r.days_to_due <= 3 ? 'warn' : 'muted'}>{dueLabel(r.days_to_due, open)}</Tag>;
}

type Key = 'complaint_id' | 'received_date' | 'channel' | 'product' | 'subcategory' | 'flags' | 'sentiment' | 'status' | 'days_to_due';
const COLS: { key: Key; label: string; compact?: boolean }[] = [
  { key: 'complaint_id', label: 'Complaint' }, { key: 'received_date', label: 'Received' }, { key: 'channel', label: 'Channel' },
  { key: 'product', label: 'Product' }, { key: 'subcategory', label: 'AI subcategory' }, { key: 'flags', label: 'Flags' },
  { key: 'sentiment', label: 'Sentiment', compact: false }, { key: 'status', label: 'Status' }, { key: 'days_to_due', label: 'Due' },
];
const SEV: Record<string, number> = { 'Fair lending': 3, UDAAP: 2, Servicing: 1 };
const sortVal = (r: ComplaintRow, k: Key): string | number =>
  k === 'flags' ? r.flags.reduce((a, f) => a + (SEV[f] ?? 0), 0) : k === 'days_to_due' ? (r.status === 'Resolved' ? 9999 : r.days_to_due) : String(r[k] ?? '');

/** Sortable complaint table. Rows open the drawer via onSelect, or the case file when none is given. */
export function ComplaintTable({ rows, compact = false, onSelect, selected }: { rows: ComplaintRow[]; compact?: boolean; onSelect?: (r: ComplaintRow) => void; selected?: string }) {
  const router = useRouter();
  const [sort, setSort] = useState<{ k: Key; dir: 1 | -1 }>({ k: 'days_to_due', dir: 1 });
  const sorted = useMemo(() => [...rows].sort((a, b) => {
    const x = sortVal(a, sort.k), y = sortVal(b, sort.k);
    return (x < y ? -1 : x > y ? 1 : 0) * sort.dir;
  }), [rows, sort]);
  const cols = COLS.filter((c) => !(compact && c.compact === false));
  const toggle = (k: Key) => setSort((s) => (s.k === k ? { k, dir: (s.dir * -1) as 1 | -1 } : { k, dir: k === 'flags' ? -1 : 1 }));
  return (
    <div className="overflow-x-auto">
      <table className="ledger min-w-[780px]">
        <thead><tr>{cols.map((c) => {
          const on = sort.k === c.key;
          return (
            <th key={c.key} scope="col" className="sortable" tabIndex={0} aria-sort={on ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}
              onClick={() => toggle(c.key)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(c.key); } }}>
              <span className="inline-flex items-center gap-1">{c.label}{on ? (sort.dir === 1 ? <ArrowUp className="w-3 h-3" aria-hidden /> : <ArrowDown className="w-3 h-3" aria-hidden />) : <ChevronsUpDown className="w-3 h-3 opacity-40" aria-hidden />}</span>
            </th>);
        })}</tr></thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.complaint_id} className={`click ${selected === r.complaint_id ? 'sel' : ''}`} onClick={() => (onSelect ? onSelect(r) : router.push(`/complaint?id=${r.complaint_id}`))}>
              <td className="whitespace-nowrap">
                {onSelect
                  ? <button className="font-semibold tabular underline-offset-2 hover:underline" onClick={(e) => { e.stopPropagation(); onSelect(r); }}>{r.complaint_id}</button>
                  : <Link className="font-semibold tabular underline-offset-2 hover:underline" href={`/complaint?id=${r.complaint_id}`} onClick={(e) => e.stopPropagation()}>{r.complaint_id}</Link>}
                {r.duplicate_of && <div className="text-[11px] muted">Likely repeat of {r.duplicate_of}</div>}
              </td>
              <td className="whitespace-nowrap tabular">{day(r.received_date)}</td>
              <td>{r.channel}</td><td>{r.product}</td><td>{r.subcategory}</td>
              <td><FlagTags flags={r.flags} /></td>
              {!compact && <td><SentimentTag s={r.sentiment} /></td>}
              <td className="whitespace-nowrap"><StatusTag s={r.status} />{r.routed_to && <div className="text-[11px] muted mt-0.5">{r.routed_to}</div>}</td>
              <td><DueTag r={r} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
