// Generates the synthetic complaints for this example: data/complaints.csv and data/taxonomy.csv.
// Deterministic (seeded): every run writes the same rows, so screenshots match what readers get.
//   node scripts/generate-data.mjs
// Fictional bank "Northwind Bank". Names, phone numbers (555-01xx) and emails (example.com) are invented.
// Planted stories (see data/README.md):
//   1. Overdraft fees after the mobile app update (version 7.2, released 2026-10-20) spike in week 3.
//   2. Complaints that allege discrimination in lending (routed to fair-lending review).
//   3. Open mortgage escrow complaints whose response is due within three days of the business date.
//   4. The same customer complaining about the same problem through two or three channels.
import { writeFileSync } from 'node:fs';

let seed = 20261116;
const rnd = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = (a) => a[Math.floor(rnd() * a.length)];
const int = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));
const money = (lo, hi) => `$${int(lo, hi)}.${String(int(0, 99)).padStart(2, '0')}`;

export const AS_OF = '2026-11-16';           // business date: Monday after the six-week window
const START = Date.UTC(2026, 9, 5);           // Mon 2026-10-05 = week 1
const DAYS = 42;
const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
const addDays = (d, n) => iso(Date.parse(`${d}T00:00:00Z`) + n * 864e5);
const DUE_DAYS = 15;                          // illustrative response window

const FIRST = ['Dana', 'Marcus', 'Priya', 'Tomas', 'Alicia', 'Jerome', 'Mei', 'Kofi', 'Hannah', 'Luis', 'Grace', 'Omar', 'Nadia', 'Victor', 'Elena', 'Samuel', 'Aisha', 'Ben', 'Carmen', 'Derek', 'Fatima', 'Gavin', 'Ines', 'Jamal', 'Keiko', 'Lena', 'Mateo', 'Nora', 'Owen', 'Paula', 'Quinn', 'Rosa', 'Tariq', 'Uma', 'Wes', 'Yara', 'Zane', 'Bianca', 'Caleb', 'Delia'];
const LAST = ['Whitfield', 'Okonkwo', 'Raman', 'Castellano', 'Brennan', 'Haldane', 'Nakamura', 'Asante', 'Lindqvist', 'Moreira', 'Pemberton', 'Haddad', 'Volkova', 'Strand', 'Abernathy', 'Quist', 'Delacroix', 'Mbeki', 'Fairbairn', 'Ostrowski', 'Tennant', 'Varga', 'Ellery', 'Yamada', 'Corwin', 'Ibarra', 'Kessler', 'Larkspur', 'Montague', 'Penrose'];
const STREETS = ['Alder Way', 'Birch Lane', 'Cedar Court', 'Dove Street', 'Elm Ridge Road', 'Fern Avenue', 'Garnet Place', 'Harbor View Drive'];

// Products and the internal taxonomy. Each subcategory maps to a regulator-style product and issue
// (illustrative, modeled loosely on public complaint-database categories; not an official list).
const REG_PRODUCT = { Deposits: 'Checking or savings account', 'Credit card': 'Credit card', Mortgage: 'Mortgage', 'Auto loan': 'Vehicle loan or lease' };
const SUBS = [
  // [subcategory, category, products, regulator issue, base weekly volume, sentence pool]
  ['Overdraft or NSF fee', 'Fees or interest', ['Deposits'], 'Fees or interest', 70, [
    'I was charged an overdraft fee of {amt} even though I had enough money in my account.',
    'You charged me {n} NSF fees in one day for transactions that should have been declined.',
    'I opted out of overdraft coverage but I still got hit with an overdraft fee.']],
  ['Monthly maintenance fee', 'Fees or interest', ['Deposits'], 'Fees or interest', 160, [
    'A monthly service fee of {fee} started appearing on my checking account without notice.',
    'I keep the minimum balance and you still charged the maintenance fee two months in a row.']],
  ['Funds availability or hold', 'Managing an account', ['Deposits'], 'Managing an account', 220, [
    'My paycheck deposit was put on hold for {n} days and I could not pay my rent.',
    'A mobile check deposit of {amt} was held with no explanation.']],
  ['Online or mobile banking access', 'Managing an account', ['Deposits', 'Credit card'], 'Managing an account', 260, [
    'I have been locked out of online banking for a week and the reset link never arrives.',
    'The app keeps logging me out and I cannot see my statements.']],
  ['Unauthorized transaction', 'Fraud or unauthorized activity', ['Deposits', 'Credit card'], 'Problem with a purchase or transaction', 520, [
    'There are {n} charges on my account I did not make, totaling {amt}.',
    'Someone used my debit card number for {amt} and the claim was denied.',
    'I reported a charge as fraud and the provisional credit was reversed.']],
  ['Account closed unexpectedly', 'Closing an account', ['Deposits', 'Credit card'], 'Closing an account', 120, [
    'My account was closed without warning and my balance of {amt} has not been returned.',
    'You closed my card account and I never got a letter explaining why.']],
  ['Interest rate or APR', 'Fees or interest', ['Credit card'], 'Fees or interest', 300, [
    'My APR went up from {rate}% without any notice to me.',
    'I was promised a 0% promotional rate and was charged interest of {amt} anyway.']],
  ['Late fee', 'Fees or interest', ['Credit card', 'Auto loan'], 'Fees or interest', 340, [
    'I paid on time and still got a late fee of {fee}.',
    'The payment posted a day late because of your system and I was charged a late fee.']],
  ['Purchase dispute', 'Problem with a purchase or transaction', ['Credit card'], 'Problem with a purchase or transaction', 480, [
    'I disputed a charge of {amt} for an item that never arrived and the dispute was closed in the merchant\'s favor.',
    'The merchant agreed to refund {amt} but the credit never showed on my card.']],
  ['Rewards not credited', 'Rewards', ['Credit card'], 'Rewards', 180, [
    'My sign-up bonus of {pts} points was never credited after I met the spending requirement.',
    'Cash back from last quarter is missing from my statement.']],
  ['Credit limit decrease', 'Managing an account', ['Credit card'], 'Managing an account', 110, [
    'My credit limit was cut from {lim} with no warning and now my utilization is hurting my score.']],
  ['Credit reporting error', 'Credit reporting', ['Credit card', 'Mortgage', 'Auto loan'], 'Credit reporting', 380, [
    'You reported a late payment to the credit bureaus that I never made.',
    'My account shows as delinquent on my credit report even though it is paid in full.']],
  ['Escrow analysis or shortage', 'Loan servicing and payments', ['Mortgage'], 'Escrow, taxes, or insurance', 150, [
    'My escrow analysis shows a shortage of {amt} and my monthly payment went up by {fee}.',
    'You did not pay my property taxes from escrow and now I have a penalty notice from the county.',
    'My homeowners insurance lapsed because the escrow payment was never sent.']],
  ['Payment not applied', 'Loan servicing and payments', ['Mortgage', 'Auto loan'], 'Trouble during payment process', 360, [
    'My payment of {amt} cleared my bank but was never applied to my loan.',
    'An extra principal payment was applied to interest instead.']],
  ['Hardship or modification', 'Struggling to pay', ['Mortgage', 'Auto loan'], 'Struggling to pay', 240, [
    'I applied for a loan modification after losing my job and have heard nothing in {n} weeks.',
    'I asked for a payment deferral and was told I did not qualify, with no reason given.']],
  ['Application denied', 'Applying for credit', ['Mortgage', 'Auto loan', 'Credit card'], 'Applying for a loan', 260, [
    'My loan application was denied and the letter did not explain the reason.',
    'I was approved, then the offer was withdrawn the day before closing.']],
  ['Closing costs or fees at origination', 'Applying for credit', ['Mortgage'], 'Applying for a loan', 90, [
    'My closing costs were {amt} higher than the estimate I was given.']],
  ['Repossession', 'Repossession', ['Auto loan'], 'Repossession', 130, [
    'My car was repossessed even though I was only {n} days behind and had a payment arrangement.',
    'The vehicle was repossessed and my personal belongings inside were never returned.']],
  ['GAP or add-on product refund', 'Fees or interest', ['Auto loan'], 'Fees or interest', 120, [
    'I paid off my auto loan early and never received the refund for the GAP coverage of {amt}.']],
  ['Customer service', 'Customer service', ['Deposits', 'Credit card', 'Mortgage', 'Auto loan'], 'Customer service', 900, [
    'I have called {n} times about this and nobody calls me back.',
    'The representative was rude and hung up on me.',
    'I was transferred between departments for over an hour and the issue is still not fixed.']],
];

const TAILS = ['This is unacceptable.', 'Please fix this.', 'I want a refund.', 'I am considering closing all my accounts.', 'I expect a written response.', '', '', 'Thank you for looking into it.', 'I have been a customer for {yrs} years.'];
const CHANNELS = [['Call', 0.34], ['Email', 0.24], ['Branch', 0.14], ['Social', 0.1], ['Regulator portal', 0.18]];
const pickChannel = () => { let r = rnd(); for (const [c, w] of CHANNELS) { if ((r -= w) < 0) return c; } return 'Call'; };

function fill(s) {
  return s.replace('{amt}', money(25, 2400)).replace('{fee}', money(12, 39)).replace('{n}', String(int(2, 6))).replace('{rate}', String(int(17, 29)))
    .replace('{pts}', `${int(3, 8) * 10000}`).replace('{lim}', `$${int(4, 15)},000 to $${int(1, 3)},500`).replace('{yrs}', String(int(3, 25)));
}
function person() {
  const first = pick(FIRST), last = pick(LAST);
  return { name: `${first} ${last}`, first, phone: `(${int(201, 989)}) 555-01${String(int(0, 99)).padStart(2, '0')}`,
    email: `${first.toLowerCase()}.${last.toLowerCase()}${int(1, 99)}@example.com`, acct: String(int(1000, 9999)),
    addr: `${int(12, 9800)} ${pick(STREETS)}` };
}
// Each channel frames the same complaint differently; most include PII that AI_REDACT should mask.
function frame(channel, p, body) {
  const pii = rnd();
  const id = pii < 0.35 ? ` My name is ${p.name}, account ending ${p.acct}.` : pii < 0.55 ? ` You can reach me at ${p.phone}.` : pii < 0.7 ? ` Email me at ${p.email}.` : '';
  switch (channel) {
    case 'Call': return `Agent: Thank you for calling Northwind Bank, how can I help? Customer: ${body}${id} Agent: I understand, let me document this complaint.`;
    case 'Email': return `Subject: Complaint. Hello, ${body}${id} Regards, ${p.first}`;
    case 'Branch': return `Branch note: Customer ${p.name} visited the ${pick(['Riverside', 'Oak Park', 'Lakeview', 'Downtown', 'Hillcrest'])} branch. ${body.replace(/\bI am\b/g, 'Customer is').replace(/\bI have\b/g, 'Customer has').replace(/\bI (expect|want|believe|think|trust)\b/g, 'Customer $1s').replace(/\bI\b/g, 'Customer').replace(/\bmy\b/g, 'their').replace(/\bme\b/g, 'them').replace(/\bam\b/g, 'is')}`;
    case 'Social': return `@NorthwindBank ${body.split('. ')[0].replace(/\.$/, '')}. ${pick(['Terrible.', 'So frustrated.', 'Fix this!', 'Not happy.', ''])}`.trim();
    default: return `Regulator portal submission. What happened: ${body}${id} Desired resolution: ${pick(['Make this right.', 'Correct my account.', 'A written explanation.', 'Refund what I was charged.'])}`;
  }
}

const rows = [];
let seq = 0, cust = 0;
const newCustomer = () => `CU-${String(++cust).padStart(6, '0')}`;
function status(received, product, sub) {
  const age = (Date.parse(`${AS_OF}T00:00:00Z`) - Date.parse(`${received}T00:00:00Z`)) / 864e5;
  const pResolved = age > 20 ? 0.985 : age > 12 ? 0.8 : age > 6 ? 0.45 : 0.12;
  if (rnd() >= pResolved) return { status: rnd() < 0.5 ? 'Open' : 'In progress', resolved_date: '', resolution: '' };
  const late = rnd() < 0.07;
  const days = late ? int(DUE_DAYS + 1, DUE_DAYS + 12) : int(1, DUE_DAYS);
  const resolved = addDays(received, Math.min(days, Math.max(1, Math.floor(age))));
  const res = /fee|Late|Rewards|GAP|Overdraft/.test(sub) ? pick(['Fee refunded', 'Fee refunded', 'Explanation provided', 'Credit applied'])
    : /report/.test(sub) ? pick(['Credit report corrected', 'Explanation provided']) : pick(['Explanation provided', 'Account corrected', 'Monetary relief', 'No action warranted']);
  void product;
  return { status: 'Resolved', resolved_date: resolved, resolution: res };
}
function add(received, channel, product, sub, text, customer = newCustomer(), forceOpen = false) {
  const st = forceOpen ? { status: pick(['Open', 'In progress']), resolved_date: '', resolution: '' } : status(received, product, sub[0]);
  rows.push({ complaint_id: `C-${String(++seq).padStart(6, '0')}`, customer_id: customer, received_date: received, channel, product,
    complaint_text: text, status: st.status, due_date: addDays(received, DUE_DAYS), resolved_date: st.resolved_date, resolution: st.resolution, _sub: sub[0] });
}

// Background volume: each subcategory's weekly base, a little noise, lighter weekends.
for (let d = 0; d < DAYS; d++) {
  const date = iso(START + d * 864e5);
  const dow = new Date(START + d * 864e5).getUTCDay();
  const dayW = dow === 0 || dow === 6 ? 0.45 : 1.22;
  for (const sub of SUBS) {
    const n = Math.round((sub[4] * 1.16 / 7) * dayW * (0.85 + rnd() * 0.3));
    for (let i = 0; i < n; i++) {
      const p = person(), ch = pickChannel(), product = pick(sub[2]);
      add(date, ch, product, sub, frame(ch, p, `${fill(pick(sub[5]))} ${fill(pick(TAILS))}`.trim()));
    }
  }
}

// Story 1: overdraft fees after the app update (v7.2 ships Tue 2026-10-20, week 3).
const OD = SUBS.find((s) => s[0] === 'Overdraft or NSF fee');
const OD_TEXT = [
  'After the app update last week my balance showed {amt} available, so I made a purchase, and then I was charged an overdraft fee.',
  'Since updating the mobile app to version 7.2 the available balance is wrong and I got {n} overdraft fees.',
  'The new app version shows pending transactions as cleared. I trusted it and got overdraft fees totaling {amt}.',
  'Ever since the app update my balance is not accurate and I was charged overdraft fees I should not owe.',
  'Your app update broke the balance display. Two overdraft fees of {fee} each. Refund them.'];
const SPIKE = { 2: 1100, 3: 820, 4: 430, 5: 210 }; // extra complaints per week index (0-based), from Oct 20
for (const [w, extra] of Object.entries(SPIKE)) {
  for (let i = 0; i < extra; i++) {
    const offset = Number(w) === 2 ? int(1, 6) : int(0, 6);
    const p = person(), ch = rnd() < 0.3 ? 'Social' : pickChannel();
    add(iso(START + (Number(w) * 7 + offset) * 864e5), ch, 'Deposits', OD, frame(ch, p, `${fill(pick(OD_TEXT))} ${fill(pick(TAILS))}`.trim()));
  }
}

// Story 2: allegations of discrimination (fair lending). Spread across the window.
const APP = SUBS.find((s) => s[0] === 'Application denied');
const DISC = [
  ['Mortgage', 'My mortgage application was denied and the loan officer told me it was because I am on disability income. That is discrimination.'],
  ['Mortgage', 'I believe I was denied a mortgage because of my national origin. The officer asked where I was really from.'],
  ['Auto loan', 'The dealer financing offered me a much higher rate than my coworker with the same credit score. I think it is because I am a woman.'],
  ['Mortgage', 'I was told my neighborhood is not a good area for lending. Everyone on my street is Black. This is redlining.'],
  ['Auto loan', 'I was denied an auto loan after the manager found out I was 68 years old and said I might not live long enough to pay it off.'],
  ['Credit card', 'My card application was declined after I told them part of my income is public assistance. That should not count against me.'],
  ['Mortgage', 'The loan officer said my pregnancy and upcoming maternity leave made me a risk and stopped processing my application.'],
  ['Auto loan', 'I was required to put down a bigger down payment than others because I do not speak English well. I feel discriminated against.'],
  ['Mortgage', 'My husband and I were treated differently than a white couple who applied the same week with lower income.'],
];
for (let i = 0; i < 27; i++) {
  const [product, text] = DISC[i % DISC.length];
  const p = person(), ch = pick(['Email', 'Call', 'Regulator portal', 'Branch']);
  add(iso(START + int(0, DAYS - 1) * 864e5), ch, product, APP, frame(ch, p, text), newCustomer(), i % 3 !== 0);
}

// Story 3: open mortgage escrow complaints received 2026-11-02..04, due 2026-11-17..19.
const ESC = SUBS.find((s) => s[0] === 'Escrow analysis or shortage');
for (let i = 0; i < 34; i++) {
  const p = person(), ch = pick(['Call', 'Email', 'Regulator portal']);
  add(addDays('2026-11-02', i % 3), ch, 'Mortgage', ESC, frame(ch, p, `${fill(pick(ESC[5]))} ${fill(pick(TAILS))}`.trim()), newCustomer(), true);
}

// Story 4: the same customer, same problem, two or three channels within a few days.
const DUP_SUBS = ['Unauthorized transaction', 'Payment not applied', 'Escrow analysis or shortage', 'Repossession', 'Overdraft or NSF fee', 'Account closed unexpectedly'];
const REPHRASE = [(b) => b, (b) => `Following up again. ${b}`, (b) => `${b} I already reported this once and nothing happened.`];
for (let i = 0; i < 48; i++) {
  const sub = SUBS.find((s) => s[0] === DUP_SUBS[i % DUP_SUBS.length]);
  const product = pick(sub[2]), p = person(), customer = newCustomer();
  const body = fill(pick(sub[5]));
  const day0 = int(8, DAYS - 6);
  const chans = [...CHANNELS.map((c) => c[0])].sort(() => rnd() - 0.5).slice(0, i % 3 === 0 ? 3 : 2);
  chans.forEach((ch, k) => add(iso(START + (day0 + k * int(1, 2)) * 864e5), ch, product, sub, frame(ch, p, REPHRASE[k](body)), customer));
}

// Repeat customers with unrelated complaints: same customer ID is not enough to call something a duplicate.
const bg = rows.filter((r) => !r.customer_id.startsWith('CU-9'));
for (let i = 0; i < 400; i++) {
  const a = bg[int(0, bg.length - 1)], b = bg[int(0, bg.length - 1)];
  if (a === b || a._sub === b._sub || a._dup || b._dup) continue;
  b.customer_id = a.customer_id; a._dup = b._dup = true;
}

rows.sort((a, b) => a.received_date.localeCompare(b.received_date) || a.complaint_id.localeCompare(b.complaint_id));
const esc = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replaceAll('"', '""')}"` : String(v));
const COLS = ['complaint_id', 'customer_id', 'received_date', 'channel', 'product', 'complaint_text', 'status', 'due_date', 'resolved_date', 'resolution'];
writeFileSync('data/complaints.csv', [COLS.join(','), ...rows.map((r) => COLS.map((c) => esc(r[c])).join(','))].join('\n') + '\n');
const TCOLS = ['subcategory', 'category', 'regulator_issue', 'description'];
writeFileSync('data/taxonomy.csv', [TCOLS.join(','), ...SUBS.map((s) => [s[0], s[1], s[3], s[5][0].replace(/\{\w+\}/g, 'X')].map(esc).join(','))].join('\n') + '\n');
writeFileSync('data/regulator_products.csv', ['product,regulator_product', ...Object.entries(REG_PRODUCT).map(([k, v]) => `${esc(k)},${esc(v)}`)].join('\n') + '\n');
const bySub = {}; rows.forEach((r) => { bySub[r._sub] = (bySub[r._sub] ?? 0) + 1; });
console.log(rows.length, 'complaints;', cust, 'customers;', rows.filter((r) => r.status !== 'Resolved').length, 'open');
console.log(bySub);
