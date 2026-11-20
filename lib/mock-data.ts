// Sample mode: lib/sample/data.json, captured from a live run of sql/setup.sql (scripts/capture-sample.mjs).
// AI outputs are the ones Cortex returned in that run, and every screen labels them "Sample AI response".
// Case updates, issues, and the activity log are kept in memory for this browser session only.
import raw from './sample/data.json';
import type { CiData } from './ci-data';
import { SAMPLE_DELAY_MS } from './sample-timing';
import type { Activity, ActivityLog, Answer, CaseAction, ComplaintDetail, ComplaintRow, Draft, Overview, Queue, Redaction, Regulatory, ThemeInsight, Themes } from './types';

interface Sample {
  overview: Overview; queue: Record<string, Queue>; complaints: Record<string, ComplaintDetail>; redact: Record<string, Redaction>;
  draft: Record<string, Draft>; themes: Themes; insight: Record<string, ThemeInsight>; regulatory: Regulatory; activity: ActivityLog; answers: Record<string, Answer>;
}
const S = raw as unknown as Sample;
const ACTOR = 'SAMPLE_USER';
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms + Math.round(Math.random() * 600)));
const mock = { source: 'mock' as const };
const strip = <T extends object>(o: T): T => { const { source: _s, role: _r, latencyMs: _l, ...rest } = o as T & { source?: unknown; role?: unknown; latencyMs?: unknown }; void _s; void _r; void _l; return rest as T; };
const now = () => new Date().toISOString().slice(0, 19);

const updates = new Map<string, { status: string; routed_to: string | null; note: string; updated_ts: string }[]>();
const issues = new Map<string, number>();
const activity: Activity[] = [];
const apply = <T extends ComplaintRow>(r: T): T => { const u = updates.get(r.complaint_id)?.[0]; return u ? { ...r, status: u.status, routed_to: u.routed_to } : r; };
const missing = (what: string) => new Error(`${what} isn't in the bundled sample. Connect Snowflake (Live mode) to run it on any complaint.`);

export const mockData: CiData = {
  async overview() { return { ...strip(S.overview), ...mock, dueSoon: S.overview.dueSoon.map(apply) }; },
  async queue(view, product) {
    const q = S.queue[`${view}|${product}`] ?? S.queue[`${view}|All`];
    if (!q) throw missing('This view');
    return { ...strip(q), ...mock, rows: q.rows.map(apply) };
  },
  async complaint(id) {
    const c = S.complaints[id];
    if (!c?.complaint) return { ...mock, complaint: null };
    const u = updates.get(id) ?? [];
    return { ...mock, complaint: { ...apply(c.complaint), history: [...u.map((x) => ({ ...x, updated_by: ACTOR })), ...c.complaint.history] } };
  },
  async redact(id) {
    await wait(SAMPLE_DELAY_MS.redact);
    const r = S.redact[id];
    if (!r) throw missing('Masking for this complaint');
    return { ...strip(r), ...mock };
  },
  async draft(id) {
    await wait(SAMPLE_DELAY_MS.draft);
    const d = S.draft[id];
    if (!d) throw missing('A response draft for this complaint');
    return { ...strip(d), ...mock };
  },
  async updateCase(id, action: CaseAction, note, aiAssisted) {
    if (action !== 'Start work' && !note.trim()) throw new Error('A note is required');
    const base = S.complaints[id]?.complaint;
    const prev = updates.get(id)?.[0]?.routed_to ?? base?.routed_to ?? null;
    const status = action === 'Resolve' || action === 'Link as duplicate' ? 'Resolved' : 'In progress';
    const routed = action === 'Route to fair-lending review' ? 'Fair-lending review' : prev;
    updates.set(id, [{ status, routed_to: routed, note, updated_ts: now() }, ...(updates.get(id) ?? [])]);
    activity.unshift({ action, object_type: 'Complaint', object_id: id, detail: note, ai_assisted: aiAssisted, actor: ACTOR, ts: now() });
    return { ok: true };
  },
  async themes() { return { ...strip(S.themes), ...mock, themes: S.themes.themes.map((t) => ({ ...t, issues: t.issues + (issues.get(t.theme_id) ?? 0) })) }; },
  async themeInsight(themeId) {
    await wait(SAMPLE_DELAY_MS.insight);
    const i = S.insight[themeId];
    if (!i) throw missing('The AI summary for this theme');
    return { ...strip(i), ...mock };
  },
  async openIssue(themeId, owner, note) {
    if (!owner.trim() || !note.trim()) throw new Error('Owner and note are required');
    issues.set(themeId, (issues.get(themeId) ?? 0) + 1);
    const issueId = `ISS-SAMPLE-${[...issues.values()].reduce((a, b) => a + b, 0)}`;
    activity.unshift({ action: `Opened root-cause issue for ${owner}`, object_type: 'Theme', object_id: themeId, detail: `${issueId}: ${note}`, ai_assisted: true, actor: ACTOR, ts: now() });
    return { issueId };
  },
  async regulatory() { return { ...strip(S.regulatory), ...mock }; },
  async activity() { return { ...mock, items: [...activity, ...S.activity.items] }; },
  async ask(question) {
    await wait(SAMPLE_DELAY_MS.ask);
    const a = S.answers[question.trim()];
    if (!a) throw new Error('In Sample mode only the suggested questions have recorded answers. Connect Snowflake (Live mode) to ask anything.');
    return { ...strip(a), ...mock };
  },
};
