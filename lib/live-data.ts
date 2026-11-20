// Live mode: reads and writes COMPLAINTS_INTEL_DEMO with CI_DEMO_ROLE. Classification comes from the
// COMPLAINT_AI Dynamic Table (AI_CLASSIFY, AI_SENTIMENT, AI_EMBED), duplicates from DUPLICATE_PAIRS
// (VECTOR_COSINE_SIMILARITY), masking from AI_REDACT, theme summaries from AI_AGG, response drafts from
// AI_COMPLETE, and questions from the COMPLAINTS_AGENT Cortex Agent. Latency shown in the UI is measured here.
import { buildThemes, weekList } from './build';
import type { CiData } from './ci-data';
import { ROLE, query } from './snowflake';
import { PRODUCTS, VIEWS, type Activity, type CaseAction, type Complaint, type ComplaintRow, type Flag, type RegulatoryRow, type View } from './types';

const MODEL = process.env.SNOWFLAKE_COMPLETE_MODEL ?? 'llama3.3-70b';
const AGENT = 'COMPLAINTS_INTEL_DEMO.CI.COMPLAINTS_AGENT';

type Row = Record<string, unknown>;
const lower = <T>(rows: Row[]): T[] => rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k.toLowerCase(), v])) as T);
async function timed<T>(fn: () => Promise<T>): Promise<[T, number]> { const t0 = Date.now(); const r = await fn(); return [r, Date.now() - t0]; }
const live = (latencyMs: number) => ({ source: 'snowflake' as const, role: ROLE, latencyMs });
const D = (c: string, a = c) => `TO_VARCHAR(${c}) ${a}`;
const TS = (c: string, a = c) => `TO_VARCHAR(${c}, 'YYYY-MM-DD"T"HH24:MI:SS') ${a}`;
const arr = (v: unknown): string[] => (Array.isArray(v) ? v : typeof v === 'string' && v ? JSON.parse(v) : []) as string[];
const ID = /^C-\d{6}$/;

const ROW_COLS = `complaint_id, customer_id, ${D('received_date')}, ${D('due_date')}, channel, product, status, subcategory, category, flags,
  sentiment, days_to_due, duplicate_of, routed_to`;
const rowOf = (r: Row): ComplaintRow => ({ ...(r as unknown as ComplaintRow), flags: arr(r.flags) as Flag[], days_to_due: Number(r.days_to_due) });

// Saved views: fixed SQL per view name (never built from user input).
const VIEW_SQL: Record<View, string> = {
  open: 'is_open',
  'fair-lending': 'flag_fair_lending',
  'due-soon': 'is_open AND days_to_due BETWEEN 0 AND 3',
  overdue: 'is_open AND days_to_due < 0',
  duplicates: 'duplicate_of IS NOT NULL',
  udaap: 'is_open AND flag_udaap',
};
const ORDER = 'ORDER BY is_open DESC, days_to_due ASC, received_date DESC, complaint_id';

async function log(action: string, objectType: string, id: string, detail: string, ai: boolean) {
  await query('INSERT INTO CI.ACTIVITY_LOG SELECT ?, ?, ?, ?, ?, CURRENT_USER(), CURRENT_TIMESTAMP()', [action, objectType, id, detail.slice(0, 4000), ai]);
}

async function redacted(id: string): Promise<{ text: string; cached: boolean }> {
  const hit = await query<{ T: string }>('SELECT redacted_text t FROM CI.REDACTIONS WHERE complaint_id = ?', [id]);
  if (hit.length) return { text: hit[0].T, cached: true };
  const [r] = await query<{ T: string }>('SELECT AI_REDACT(complaint_text) t FROM SRC.COMPLAINTS WHERE complaint_id = ?', [id]);
  if (!r) throw new Error('Complaint not found');
  await query('INSERT INTO CI.REDACTIONS SELECT ?, ?, CURRENT_TIMESTAMP()', [id, r.T]);
  return { text: r.T, cached: false };
}

export const liveData: CiData = {
  async overview() {
    const [[k, weekly, channels, flags, aging, due, dueBy, dueRate], ms] = await timed(() => Promise.all([
      query(`SELECT COUNT(*) total, COUNT_IF(is_open) open, COUNT_IF(high_risk) high_risk, COUNT_IF(resolved_on_time) on_time, COUNT_IF(resolved_on_time IS NOT NULL) resolved,
          COUNT_IF(is_open AND days_to_due < 0) overdue, COUNT_IF(is_open AND days_to_due BETWEEN 0 AND 3) due_soon,
          COUNT_IF(flag_fair_lending) fair_lending, COUNT_IF(duplicate_of IS NOT NULL) duplicates FROM CI.COMPLAINTS_V`),
      query(`SELECT week, product, COUNT(*) n FROM CI.COMPLAINTS_V GROUP BY 1, 2`),
      query(`SELECT channel, COUNT(*) complaints, COUNT_IF(high_risk) high_risk FROM CI.COMPLAINTS_V GROUP BY 1 ORDER BY 2 DESC`),
      query(`SELECT COUNT_IF(flag_udaap) u, COUNT_IF(flag_udaap AND is_open) uo, COUNT_IF(flag_fair_lending) f, COUNT_IF(flag_fair_lending AND is_open) fo,
          COUNT_IF(flag_servicing) s, COUNT_IF(flag_servicing AND is_open) so FROM CI.COMPLAINTS_V`),
      query(`SELECT CASE WHEN days_to_due < 0 THEN 'Overdue' WHEN age_days <= 5 THEN '0–5 days' WHEN age_days <= 10 THEN '6–10 days' ELSE '11–15 days' END bucket, COUNT(*) n
          FROM CI.COMPLAINTS_V WHERE is_open GROUP BY 1`),
      query(`SELECT ${ROW_COLS} FROM CI.COMPLAINTS_V WHERE is_open AND days_to_due BETWEEN 0 AND 3 ${ORDER} LIMIT 12`),
      query(`SELECT subcategory, product, COUNT(*) n, ROUND(COUNT(*) / SUM(COUNT(*)) OVER (), 4) share FROM CI.COMPLAINTS_V WHERE is_open AND days_to_due BETWEEN 0 AND 3 GROUP BY 1, 2 ORDER BY 3 DESC LIMIT 6`),
      query(`SELECT subcategory, product, COUNT_IF(is_open AND days_to_due BETWEEN 0 AND 3) / NULLIF(COUNT_IF(is_open), 0) r FROM CI.COMPLAINTS_V GROUP BY 1, 2`),
    ]));
    const r = lower<Record<string, number>>(k)[0];
    const f = lower<Record<string, number>>(flags)[0];
    const n = (v: unknown) => Number(v);
    const ag = Object.fromEntries(lower<{ bucket: string; n: number }>(aging).map((a) => [a.bucket, n(a.n)]));
    return {
      ...live(ms), asOf: '2026-11-16',
      kpis: { total: n(r.total), open: n(r.open), highRisk: n(r.high_risk), onTimeRate: n(r.on_time) / Math.max(1, n(r.resolved)), resolved: n(r.resolved),
        overdue: n(r.overdue), dueSoon: n(r.due_soon), fairLending: n(r.fair_lending), duplicates: n(r.duplicates) },
      weekly: weekList().map(({ week, start }) => ({ week, start, ...Object.fromEntries(PRODUCTS.map((p) => [p, n(lower<{ week: number; product: string; n: number }>(weekly).find((x) => n(x.week) === week && x.product === p)?.n ?? 0)])) })) as never,
      channels: lower<{ channel: string; complaints: number; high_risk: number }>(channels).map((c) => ({ channel: c.channel, complaints: n(c.complaints), highRisk: n(c.high_risk) })),
      flags: [{ flag: 'UDAAP', complaints: n(f.u), open: n(f.uo) }, { flag: 'Fair lending', complaints: n(f.f), open: n(f.fo) }, { flag: 'Servicing', complaints: n(f.s), open: n(f.so) }],
      aging: ['0–5 days', '6–10 days', '11–15 days', 'Overdue'].map((b) => ({ bucket: b, open: ag[b] ?? 0 })),
      dueSoon: lower<Row>(due).map(rowOf),
      dueSoonBy: lower<{ subcategory: string; product: string; n: number; share: number }>(dueBy).map((x) => ({
        subcategory: x.subcategory, product: x.product, open: n(x.n),
        shareOfOpen: n(lower<{ subcategory: string; product: string; r: number }>(dueRate).find((y) => y.subcategory === x.subcategory && y.product === x.product)?.r ?? 0) })),
    };
  },

  async queue(view, product) {
    if (!Object.hasOwn(VIEWS, view)) throw new Error('Unknown view');
    const p = (PRODUCTS as readonly string[]).includes(product) ? product : 'All';
    const where = `${VIEW_SQL[view]} AND (? = 'All' OR product = ?)`;
    const [[rows, total], ms] = await timed(() => Promise.all([
      query(`SELECT ${ROW_COLS} FROM CI.COMPLAINTS_V WHERE ${where} ${ORDER} LIMIT 20`, [p, p]),
      query<{ N: number }>(`SELECT COUNT(*) n FROM CI.COMPLAINTS_V WHERE ${where}`, [p, p]),
    ]));
    return { ...live(ms), view, product: p, total: Number(total[0].N), rows: lower<Row>(rows).map(rowOf) };
  },

  async complaint(id) {
    if (!ID.test(id)) return { ...live(0), complaint: null };
    const [[c, rel, hist], ms] = await timed(() => Promise.all([
      query(`SELECT ${ROW_COLS}, regulator_product, regulator_issue, resolution, ${D('resolved_date')}, age_days, duplicate_similarity FROM CI.COMPLAINTS_V WHERE complaint_id = ?`, [id]),
      query(`SELECT v.complaint_id, ${D('v.received_date', 'received_date')}, v.channel, v.subcategory, v.status, p.similarity
          FROM CI.COMPLAINTS_V v LEFT JOIN CI.DUPLICATE_PAIRS p ON (p.complaint_id = v.complaint_id AND p.duplicate_of = ?) OR (p.duplicate_of = v.complaint_id AND p.complaint_id = ?)
          WHERE v.customer_id = (SELECT customer_id FROM SRC.COMPLAINTS WHERE complaint_id = ?) AND v.complaint_id <> ? ORDER BY v.received_date`, [id, id, id, id]),
      query(`SELECT status, routed_to, note, updated_by, ${TS('updated_ts')} FROM CI.CASE_UPDATES WHERE complaint_id = ? ORDER BY updated_ts DESC`, [id]),
    ]));
    if (!c.length) return { ...live(ms), complaint: null };
    const row = lower<Row>(c)[0];
    const complaint: Complaint = {
      ...(row as unknown as Complaint), ...rowOf(row), age_days: Number(row.age_days),
      duplicate_similarity: row.duplicate_similarity == null ? null : Number(row.duplicate_similarity),
      related: lower<Complaint['related'][number]>(rel).map((x) => ({ ...x, similarity: x.similarity == null ? null : Number(x.similarity) })),
      history: lower<Complaint['history'][number]>(hist),
    };
    return { ...live(ms), complaint };
  },

  async redact(id) {
    if (!ID.test(id)) throw new Error('Unknown complaint');
    const [r, ms] = await timed(() => redacted(id));
    return { ...live(ms), complaintId: id, ...r };
  },

  async draft(id) {
    if (!ID.test(id)) throw new Error('Unknown complaint');
    const [r, ms] = await timed(async () => {
      const hit = await query<{ D: string; M: string }>('SELECT draft d, model m FROM CI.RESPONSE_DRAFTS WHERE complaint_id = ? ORDER BY created_ts DESC LIMIT 1', [id]);
      if (hit.length) return { draft: hit[0].D, model: hit[0].M, cached: true };
      const { text } = await redacted(id);
      const [c] = await query<{ P: string; S: string; DUE: string; LATE: boolean }>(`SELECT product p, subcategory s, TO_VARCHAR(due_date, 'Mon DD, YYYY') due, days_to_due < 0 late FROM CI.COMPLAINTS_V WHERE complaint_id = ?`, [id]);
      const when = c.LATE ? `The response was due ${c.DUE} and is late: apologize for the delay and commit to a full answer within five business days.` : `Commit to a full answer by ${c.DUE}.`;
      const prompt = `You write first drafts of written complaint responses for Northwind Bank's complaints team. A person reviews and edits every draft before it is sent.
Write a short, plain-language response (under 130 words) to this ${c.P} complaint about "${c.S}". Acknowledge the specific problem, say what the bank will review. ${when}
Do not promise refunds or outcomes, do not admit fault, and do not invent facts, amounts, or names. Use "[Customer name]" for the greeting. Sign it "Northwind Bank Customer Care".
Complaint (PII masked): ${text}`;
      const [d] = await query<{ D: string }>('SELECT AI_COMPLETE(?, ?) d', [MODEL, prompt]);
      await query('INSERT INTO CI.RESPONSE_DRAFTS SELECT ?, ?, ?, CURRENT_TIMESTAMP()', [id, d.D.trim(), MODEL]);
      return { draft: d.D.trim(), model: MODEL, cached: false };
    });
    return { ...live(ms), complaintId: id, ...r };
  },

  async updateCase(id, action, note, aiAssisted) {
    if (!ID.test(id)) throw new Error('Unknown complaint');
    const MAP: Record<CaseAction, [string, string | null]> = {
      'Start work': ['In progress', null], 'Route to fair-lending review': ['In progress', 'Fair-lending review'],
      Resolve: ['Resolved', null], 'Link as duplicate': ['Resolved', null],
    };
    if (!MAP[action]) throw new Error('Unknown action');
    if (action !== 'Start work' && !note.trim()) throw new Error('A note is required');
    const [cur] = await query<{ R: string | null; D: string | null }>('SELECT routed_to r, duplicate_of d FROM CI.COMPLAINTS_V WHERE complaint_id = ?', [id]);
    const [status, route] = MAP[action];
    const resolution = action === 'Resolve' ? note : action === 'Link as duplicate' ? `Duplicate of ${cur?.D ?? 'an earlier complaint'}` : null;
    await query('INSERT INTO CI.CASE_UPDATES SELECT ?, ?, ?, ?, ?, CURRENT_USER(), CURRENT_TIMESTAMP()', [id, status, resolution, route ?? cur?.R ?? null, note.slice(0, 4000)]);
    await log(action, 'Complaint', id, note, aiAssisted);
    return { ok: true };
  },

  async themes() {
    const [[rows, issues], ms] = await timed(() => Promise.all([
      query('SELECT theme_id, subcategory, product, category, week, complaints, high_risk FROM CI.THEME_WEEKLY'),
      query<{ THEME_ID: string; N: number }>('SELECT theme_id, COUNT(*) n FROM CI.THEME_ISSUES GROUP BY 1'),
    ]));
    return { ...live(ms), weeks: weekList(),
      themes: buildThemes(lower(rows), Object.fromEntries(issues.map((i) => [i.THEME_ID, Number(i.N)]))) };
  },

  async themeInsight(themeId) {
    const [r, ms] = await timed(async () => {
      const { themes } = await liveData.themes();
      const t = themes.find((x) => x.theme_id === themeId);
      if (!t) throw new Error('Unknown theme');
      const week = t.peakWeek || 6;
      const hit = await query<{ S: string; Q: string; M: string }>('SELECT summary s, quotes::VARCHAR q, model m FROM CI.THEME_INSIGHTS WHERE theme_id = ? AND week = ?', [themeId, week]);
      if (hit.length) return { week, summary: hit[0].S, quotes: arr(hit[0].Q), model: hit[0].M, cached: true };
      const filter = 'v.subcategory = ? AND v.product = ? AND v.week = ?';
      const [s] = await query<{ S: string }>(`SELECT AI_AGG(c.complaint_text, 'These are bank customer complaints from one week that share an issue. In two or three sentences, name the common root cause and anything that changed, such as a product, system, or policy change. Do not include names, account numbers, amounts, or contact details.') s
          FROM SRC.COMPLAINTS c JOIN CI.COMPLAINTS_V v USING (complaint_id) WHERE ${filter}`, [t.subcategory, t.product, week]);
      const q = await query<{ Q: string }>(`SELECT AI_REDACT(c.complaint_text) q FROM SRC.COMPLAINTS c JOIN CI.COMPLAINTS_V v USING (complaint_id)
          WHERE ${filter} AND v.channel <> 'Social' ORDER BY HASH(c.complaint_id) LIMIT 3`, [t.subcategory, t.product, week]);
      const quotes = q.map((x) => x.Q);
      await query('INSERT INTO CI.THEME_INSIGHTS SELECT ?, ?, ?, PARSE_JSON(?), ?, CURRENT_TIMESTAMP()', [themeId, week, s.S.trim(), JSON.stringify(quotes), 'AI_AGG']);
      return { week, summary: s.S.trim(), quotes, model: 'AI_AGG', cached: false };
    });
    return { ...live(ms), themeId, ...r };
  },

  async openIssue(themeId, owner, note) {
    if (!owner.trim() || !note.trim()) throw new Error('Owner and note are required');
    const issueId = `ISS-${Date.now().toString(36).toUpperCase()}`;
    await query('INSERT INTO CI.THEME_ISSUES SELECT ?, ?, ?, ?, CURRENT_USER(), CURRENT_TIMESTAMP()', [issueId, themeId.slice(0, 200), owner.slice(0, 200), note.slice(0, 4000)]);
    await log(`Opened root-cause issue for ${owner}`, 'Theme', themeId, `${issueId}: ${note}`, true);
    return { issueId };
  },

  async regulatory() {
    const [rows, ms] = await timed(() => query(`SELECT regulator_product, regulator_issue, subcategory, COUNT(*) complaints, COUNT_IF(is_open) open, COUNT_IF(high_risk) high_risk,
        COUNT_IF(resolved_on_time) / NULLIF(COUNT_IF(resolved_on_time IS NOT NULL), 0) on_time_rate
      FROM CI.COMPLAINTS_V GROUP BY 1, 2, 3 ORDER BY 1, 4 DESC`));
    return { ...live(ms), rows: lower<RegulatoryRow>(rows).map((r) => ({ ...r, complaints: Number(r.complaints), open: Number(r.open), high_risk: Number(r.high_risk), on_time_rate: r.on_time_rate == null ? null : Number(r.on_time_rate) })) };
  },

  async activity() {
    const [rows, ms] = await timed(() => query(`SELECT action, object_type, object_id, detail, ai_assisted, actor, ${TS('ts')} FROM CI.ACTIVITY_LOG ORDER BY ts DESC LIMIT 50`));
    return { ...live(ms), items: lower<Activity>(rows) };
  },

  async ask(question) {
    const q = question.trim().slice(0, 500);
    if (!q) throw new Error('Ask a question');
    const body = JSON.stringify({ messages: [{ role: 'user', content: [{ type: 'text', text: q }] }] });
    const [rows, ms] = await timed(() => query<{ R: string }>('SELECT SNOWFLAKE.CORTEX.DATA_AGENT_RUN(?, ?, TRUE)::VARCHAR AS R', [AGENT, body]));
    const content: Row[] = JSON.parse(rows[0].R).content ?? [];
    // The answer is every text and table block after the last tool block.
    const lastTool = content.map((c) => c.type).lastIndexOf('tool_result');
    const tail = content.slice(lastTool + 1);
    const text = tail.map((c) => {
      if (c.type === 'text') return String(c.text);
      if (c.type === 'table') {
        const t = (c.table as Row | undefined)?.result_set as { resultSetMetaData?: { rowType?: { name: string }[] }; data?: unknown[][] } | undefined;
        const cols = t?.resultSetMetaData?.rowType?.map((x) => x.name) ?? [];
        if (!cols.length) return '';
        return [`| ${cols.join(' | ')} |`, `| ${cols.map(() => '---').join(' | ')} |`, ...(t?.data ?? []).slice(0, 20).map((r) => `| ${r.join(' | ')} |`)].join('\n');
      }
      return '';
    }).filter(Boolean).join('\n\n').trim();
    const results = content.filter((c) => c.type === 'tool_result').flatMap((c) => ((c.tool_result as Row | undefined)?.content as Row[] | undefined) ?? []);
    const sql = results.map((r) => (r.json as Row | undefined)?.sql).find(Boolean) as string | undefined;
    const tools = [...new Set(content.filter((c) => c.type === 'tool_use').map((c) => String((c.tool_use as Row | undefined)?.name ?? '')).filter(Boolean))];
    return { ...live(ms), question: q, text, sql: sql ?? null, tools };
  },
};
