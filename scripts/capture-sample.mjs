// Captures the bundled sample (lib/sample/data.json) from the running app in Live mode, so Sample
// mode shows exactly what Live mode computed, including the AI outputs (labeled "Sample AI response")
// and their measured latency. Run after sql/setup.sql, with `npm run dev` using .env.local:
//   node scripts/capture-sample.mjs [http://localhost:3000]
import { readFileSync, writeFileSync } from 'node:fs';

const BASE = process.argv[2] ?? 'http://localhost:3000';
const env = Object.fromEntries(readFileSync('.env.local', 'utf8').split('\n').map((l) => l.match(/^([A-Z_]+)=(.*)$/)).filter(Boolean).map((m) => [m[1], m[2]]));
const call = async (op, ...args) => {
  const r = await fetch(`${BASE}/api/data`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op, args }) });
  const j = await r.json();
  if (!r.ok || (j.source !== 'snowflake' && !j.notFound)) throw new Error(`${op} ${JSON.stringify(args)}: ${j.error ?? 'not live'}`);
  return j;
};
const pool = async (items, n, fn) => { const q = [...items]; await Promise.all(Array.from({ length: n }, async () => { while (q.length) await fn(q.shift()); })); };

const VIEWS = ['open', 'fair-lending', 'due-soon', 'overdue', 'duplicates', 'udaap'];
const PRODUCTS = ['All', 'Deposits', 'Credit card', 'Mortgage', 'Auto loan'];
const QUESTIONS = [
  'Which complaint subcategories grew the most from week 2 to week 3?',
  'How many open complaints are flagged for fair-lending review, by product?',
  'What share of resolved complaints were closed on time, by channel?',
  'How many open mortgage escrow complaints are due in the next 3 days?',
];

const out = { overview: await call('overview'), queue: {}, complaints: {}, redact: {}, draft: {}, insight: {}, answers: {} };
const ids = new Set(out.overview.dueSoon.map((r) => r.complaint_id));
for (const v of VIEWS) for (const p of PRODUCTS) {
  const q = await call('queue', v, p);
  out.queue[`${v}|${p}`] = q;
  q.rows.forEach((r) => ids.add(r.complaint_id));
}
// Related complaints (same customer) open from the detail page too.
for (const id of [...ids]) {
  const c = await call('complaint', id);
  out.complaints[id] = c;
  c.complaint?.related.forEach((r) => ids.add(r.complaint_id));
}
console.log(ids.size, 'complaints');
await pool([...ids], 6, async (id) => {
  out.complaints[id] ??= await call('complaint', id);
  out.redact[id] = await call('redact', id);
  out.draft[id] = await call('draft', id);
});
out.themes = await call('themes');
await pool(out.themes.themes.slice(0, 12).map((t) => t.theme_id), 3, async (t) => { out.insight[t] = await call('themeInsight', t); console.log('insight', t, out.insight[t].latencyMs, 'ms'); });
out.regulatory = await call('regulatory');
out.activity = await call('activity');
for (const q of QUESTIONS) { out.answers[q] = await call('ask', q); console.log('ask', out.answers[q].latencyMs, 'ms'); }

// Never ship the account's user name in the sample.
const json = JSON.stringify(out).replaceAll(env.SNOWFLAKE_USERNAME.toUpperCase(), 'COMPLAINTS_ANALYST').replaceAll(env.SNOWFLAKE_USERNAME, 'complaints_analyst');
writeFileSync('lib/sample/data.json', json);
console.log('wrote lib/sample/data.json', (json.length / 1024).toFixed(0), 'KB');
