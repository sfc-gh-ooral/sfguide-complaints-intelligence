// Formatting helpers shared by the screens. Dates in the data are calendar dates without a time zone.
export const day = (d: string) => new Date(`${d.slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
export const dayLong = (d: string) => new Date(`${d.slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
export const stamp = (t: string | null | undefined) => (t ? `${day(t)} ${t.slice(11, 16)}` : '—');
export const n = (x: number) => x.toLocaleString('en-US');
export const pct = (x: number, digits = 1) => `${(x * 100).toFixed(digits)}%`;
export const growthLabel = (g: number) => (g >= 0 ? `+${Math.round(g * 100).toLocaleString('en-US')}%` : `${Math.round(g * 100)}%`);
export const dueLabel = (days: number, open: boolean) => (!open ? '—' : days < 0 ? `${-days}d overdue` : days === 0 ? 'Due today' : `${days}d left`);
export const PRODUCT_COLORS: Record<string, string> = { Deposits: 'var(--chart-1)', 'Credit card': 'var(--chart-2)', Mortgage: 'var(--chart-3)', 'Auto loan': 'var(--chart-4)' };
export const TIP = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 } as const;
