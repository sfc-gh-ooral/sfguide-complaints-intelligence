// Shared rules for Sample and Live mode: theme growth and week labels.
import type { Theme } from './types';

export const WINDOW_START = '2026-10-05';
export const WEEKS = 6;
export const weekStart = (w: number) => new Date(Date.parse(`${WINDOW_START}T00:00:00Z`) + (w - 1) * 7 * 864e5).toISOString().slice(0, 10);
export const weekList = () => Array.from({ length: WEEKS }, (_, i) => ({ week: i + 1, start: weekStart(i + 1) }));
/** A theme only counts as growing once it has at least this many complaints in a week. */
export const MIN_WEEKLY = 40;

export const growth = (prev: number, cur: number) => (cur - prev) / Math.max(prev, 1);

/** Builds themes (AI subcategory x product) from weekly counts and ranks them by their sharpest week-over-week rise. */
export function buildThemes(rows: { theme_id: string; subcategory: string; product: string; category: string; week: number; complaints: number; high_risk: number }[], issues: Record<string, number>): Theme[] {
  const m = new Map<string, Theme>();
  for (const r of rows) {
    const t = m.get(r.theme_id) ?? { theme_id: r.theme_id, subcategory: r.subcategory, product: r.product, category: r.category, weekly: Array(WEEKS).fill(0), total: 0, highRisk: 0, peakWeek: 0, peakGrowth: 0, latestGrowth: 0, issues: issues[r.theme_id] ?? 0 };
    if (r.week >= 1 && r.week <= WEEKS) t.weekly[r.week - 1] += Number(r.complaints);
    t.total += Number(r.complaints); t.highRisk += Number(r.high_risk);
    m.set(r.theme_id, t);
  }
  for (const t of m.values()) {
    for (let w = 1; w < WEEKS; w++) {
      const g = t.weekly[w] >= MIN_WEEKLY ? growth(t.weekly[w - 1], t.weekly[w]) : 0;
      if (g > t.peakGrowth) { t.peakGrowth = g; t.peakWeek = w + 1; }
    }
    t.latestGrowth = growth(t.weekly[WEEKS - 2], t.weekly[WEEKS - 1]);
  }
  return [...m.values()].filter((t) => t.total >= 60).sort((a, b) => b.peakGrowth - a.peakGrowth || b.total - a.total);
}
