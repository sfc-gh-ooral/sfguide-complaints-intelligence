# Complaints Intelligence

Help complaint teams classify every complaint across channels, spot emerging conduct-risk themes early,
and evidence timely resolution. A Snowflake example on synthetic data, built with Cortex AI functions,
Dynamic Tables, and a Cortex Agent.

- **Guide:** https://sfc-gh-ooral.github.io/sfguide-complaints-intelligence/
- **Try it (no account):** https://sfc-gh-ooral.github.io/sfguide-complaints-intelligence/try/

> Synthetic data only (fictional "Northwind Bank"). The taxonomy, regulator-style product and issue
> list, regulatory flags, and 15-day response window are illustrative, not an official regulator list.
> Not legal, regulatory, or compliance advice. AI output is a suggestion that a person reviews.

UDAAP means unfair, deceptive, or abusive acts or practices. Fair lending refers to laws against
discrimination in credit decisions.

## What it does

The app is styled as **Tallowmark Complaints Desk**, a fictional product used by the fictional
Northwind Bank. The brand, palette and layout are described in [docs/DESIGN.md](docs/DESIGN.md).

| Screen | For | What you see |
| --- | --- | --- |
| Overview | Complaints manager | Weekly volume by product, volume and high-risk share by channel, regulatory flags, on-time resolution rate, aging of open complaints, and where the next three days' deadlines sit |
| Complaint queue | Complaints analyst | Saved views: all open, fair-lending review, due in 3 days, overdue, likely duplicates, UDAAP flagged, filtered by product and free text, with sortable columns and a quick-view drawer for each complaint |
| Complaint detail | Complaints analyst | The text with PII masked by `AI_REDACT`, AI category and subcategory, regulatory flags, sentiment, deadline, other complaints from the same customer with their similarity, a labeled AI response draft, and route, resolve, or link-as-duplicate actions with a required note |
| Emerging themes | Complaints manager, product owners | AI subcategory by product, ranked by the sharpest week-over-week rise, shown as a six-week heatmap; a streamed `AI_AGG` root-cause summary that cites masked example quotes; open an issue for the root-cause owner |
| Regulatory view | Compliance | The internal taxonomy rolled up to a regulator-style product and issue list, with CSV export, and the activity log of every decision |
| Ask the data | Anyone on the team | Questions answered by a Cortex Agent that writes SQL with Cortex Analyst over a semantic view; the answer streams in and cites the semantic view and its SQL |

**Stories on this synthetic data set** (details in [data/README.md](data/README.md)):

1. **Overdraft fees after an app update.** Overdraft or NSF fee complaints on deposits rise from 86 in
   week 2 to 955 in week 3. The `AI_AGG` summary names the mobile app update (version 7.2) and its
   balance display as the common cause, and the manager opens an issue for Digital Banking.
2. **Fair-lending allegations.** 27 complaints allege discrimination (age, sex, national origin,
   disability, public assistance, redlining). `AI_CLASSIFY` flags all 27 for fair-lending review on
   this data set; the analyst routes them before responding.
3. **Escrow deadlines.** 66 open mortgage escrow complaints are due within three days of the business
   date, 24% of that theme's open complaints, the highest share of any theme.
4. **The same customer, several channels.** `AI_EMBED` similarity within the same customer and AI
   subcategory finds 68 pairs of repeat complaints sent through different channels, and no unrelated
   pairs on this data set.

## Snowflake capabilities used (all run in Live mode)

| Capability | Where |
| --- | --- |
| `AI_CLASSIFY` | `CI.COMPLAINT_AI` Dynamic Table: one subcategory from a 20-label taxonomy, and multi-label regulatory flags (UDAAP, Fair lending, Servicing) |
| `AI_SENTIMENT` | `CI.COMPLAINT_AI`: overall sentiment per complaint |
| `AI_EMBED` + `VECTOR_COSINE_SIMILARITY` | `CI.COMPLAINT_AI` embeddings (`snowflake-arctic-embed-m-v1.5`) and the `CI.DUPLICATE_PAIRS` Dynamic Table |
| Dynamic Tables (incremental refresh) | `CI.COMPLAINT_AI` classifies each new complaint as it lands (`TARGET_LAG = '1 hour'`) |
| `AI_REDACT` | Masks PII on the complaint detail screen and in theme quotes; results cached in `CI.REDACTIONS` |
| `AI_AGG` | Root-cause summary for a theme's peak week, cached in `CI.THEME_INSIGHTS` |
| `AI_COMPLETE` | Response draft from the masked text (default model `llama3.3-70b`), saved in `CI.RESPONSE_DRAFTS` |
| Semantic view + Cortex Analyst + Cortex Agents | `CI.COMPLAINTS_SV` and `CI.COMPLAINTS_AGENT`, called with `SNOWFLAKE.CORTEX.DATA_AGENT_RUN` |
| Git repository + `COPY FILES` | `setup.sql` loads the synthetic CSVs from this public repository |

`AI_SUMMARIZE_AGG` and masking policies are not used: `AI_AGG` writes the theme summaries, and PII is
masked with `AI_REDACT` instead of a policy.

## Prerequisites

- **Sample mode:** Node.js 20.19 or later. Nothing else.
- **Live mode:** a Snowflake account (Standard Edition or higher) where Cortex AI functions
  (`AI_CLASSIFY`, `AI_SENTIMENT`, `AI_EMBED`, `AI_REDACT`, `AI_AGG`, `AI_COMPLETE` with `llama3.3-70b`),
  Cortex Analyst, and Cortex Agents are available in your region or with
  [cross-region inference](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cross-region-inference),
  and a user that can use ACCOUNTADMIN once to create a role, warehouse, database, and API integration.
  Tested on an AWS US account in November 2026.

## Quick start: Sample mode (no account)

```bash
git clone https://github.com/sfc-gh-ooral/sfguide-complaints-intelligence.git
cd sfguide-complaints-intelligence
npm install
npm run dev        # http://localhost:3000
```

Sample mode runs on `lib/sample/data.json`, captured from a live run. AI output in Sample mode is what
Cortex returned in that run and is labeled **Sample AI response**; it plays back after a 4 to 8 second
delay with the same progress steps as Live mode. Case updates and issues are kept in memory for the
session. Sample mode covers the complaints that appear in the saved views; Live mode opens any of the
40,141.

## Live mode: deploy to your account

1. Open `sql/setup.sql` in a Snowsight SQL worksheet and **Run All** as a user with ACCOUNTADMIN.
   It took 169 to 200 seconds on the XSMALL warehouse it creates (200 seconds on the November 20, 2026 run).
2. Create a key pair and register the public key on your user (commands in `.env.example`).
3. `cp .env.example .env.local` and fill in your account identifier, user, and key path.
4. `npm run dev`, then switch the header to **Live**. Every screen now reads Snowflake as
   `CI_DEMO_ROLE`, and each card shows the measured round trip.

If a Live call fails, the screen shows the error. It never falls back to sample data silently.

To refresh the sample from your own live run: `node scripts/capture-sample.mjs http://localhost:3000`.

### Objects created

| Object | Name | Notes |
| --- | --- | --- |
| Role | `CI_DEMO_ROLE` | Owns every object below; the app connects with it. Granted `SNOWFLAKE.CORTEX_USER` and usage on the API integration |
| Warehouse | `CI_WH` | XSMALL, `AUTO_SUSPEND = 60`, initially suspended |
| Database | `COMPLAINTS_INTEL_DEMO` | Schemas `SRC` (complaints, taxonomy) and `CI` (AI, workflow, evidence) |
| Dynamic Tables | `CI.COMPLAINT_AI`, `CI.DUPLICATE_PAIRS` | `TARGET_LAG = '1 hour'`; `COMPLAINT_AI` refreshes incrementally |
| Views | `CI.COMPLAINTS_V`, `CI.THEME_WEEKLY` | Classification joined to workflow status, deadlines, and aging |
| Tables | `CI.CONFIG`, `CI.CASE_UPDATES`, `CI.THEME_ISSUES`, `CI.THEME_INSIGHTS`, `CI.REDACTIONS`, `CI.RESPONSE_DRAFTS`, `CI.ACTIVITY_LOG` | Business clock, decisions, AI caches, evidence |
| Semantic view, agent | `CI.COMPLAINTS_SV`, `CI.COMPLAINTS_AGENT` | Cortex Analyst tool on the semantic view |
| Git repository, stage | `SRC.CI_REPO`, `SRC.CI_DATA` | Public repository, read only |
| API integration | `CI_GIT_API` | `git_https_api`, limited to `https://github.com/sfc-gh-ooral/` |

`setup.sql` changes nothing that already exists.

### Expected cost and time

Measured on an AWS US account (November 2026). **Most of the cost is the first classification of
40,141 complaints**, which runs once when `setup.sql` creates the `COMPLAINT_AI` Dynamic Table.

| Step | Time | AI credits (measured) |
| --- | --- | --- |
| `setup.sql`, top to bottom | 169 to 200 seconds | about 51 per run: `AI_CLASSIFY` (two calls per complaint) about 42.5, `AI_SENTIMENT` about 8.5, `AI_EMBED` about 0.04 |
| Screen loads in Live mode | 0.2 to 3.4 seconds (first call opens the connection) | none |
| Mask one complaint (`AI_REDACT`) | about 4.9 seconds | about 0.0004 per complaint (0.16 for 360) |
| Response draft (`AI_COMPLETE`, `llama3.3-70b`) | 4.0 to 4.5 seconds | about 0.0001 per draft (0.04 for 348) |
| Theme summary (`AI_AGG`) and three masked quotes | 7.4 to 15.5 seconds | about 0.03 per theme |
| Agent question (Cortex Agents + Cortex Analyst) | 12 to 29 seconds | billed separately by Cortex Agents; not measured here |

Warehouse credits measured on the November 20, 2026 run: 0.48 for `setup.sql` plus about 20 minutes of
Live use of every screen (WAREHOUSE_METERING_HISTORY for CI_WH). The AI credit figures above come from
the first live run; AI credits for the second run weren't attributable yet when it was cleaned up. AI credit prices vary by region and contract, so check yours before running setup. To try it
for less, keep fewer complaints: for example add `WHERE received_date >= '2026-11-02'` to the
`COMPLAINT_AI` definition to classify only the last two weeks (about a third of the rows). New
complaints are classified incrementally, so a steady stream costs in proportion to its volume.
Run `sql/cleanup.sql` when you're done.

### Clean up

Run `sql/cleanup.sql`. It drops the database (and everything in it) and warehouse as `CI_DEMO_ROLE`,
then the API integration and role as ACCOUNTADMIN, and ends with `SHOW` commands that should return no
rows. Delete `.env.local` and your key if you created one only for this example.

## Known limitations

- The taxonomy, regulator-style mapping, flags, and 15-day response window are illustrative. Real
  response deadlines depend on the regulator, product, and complaint type.
- AI classification is a suggestion. On this synthetic data some generic texts (for example "I want a
  refund" with no other detail) land in a neighboring subcategory; compare with analyst tags before
  relying on it (see the Cortex Code prompts below).
- `AI_REDACT` masks PII on a best-effort basis. The raw text stays in `SRC.COMPLAINTS`, which the app
  role can read; a production build should restrict that table and keep only masked text in reach of
  analysts. There is no per-user masking or row access in this example.
- Themes are AI subcategory by product, not free-form clusters. Embeddings are used for duplicate
  detection; clustering embeddings into new themes is left as a customization.
- Duplicate detection compares complaints from the same customer within 14 days. The 0.55 similarity
  floor was tuned on this data, where channel framing (call scripts, social posts) lowers similarity.
- The data is frozen at a business date (November 16, 2026) so deadlines read the same every time.
- Response drafts are never sent; status changes are recorded in the app only.

## Customize with Cortex Code

- "Replace the taxonomy in `CI.COMPLAINT_AI` with mine, re-classify, and show the categories where the
  classifier's labels disagree most with my analysts' tags on 500 complaints."
- "Alert me by email when any theme in `CI.THEME_WEEKLY` grows more than 50% week over week."
- "Map my complaint tables to `SRC.COMPLAINTS` and propose least-privilege access so analysts only see
  `AI_REDACT` output."

## Project layout

```
app/            Next.js screens and the /api/data route
components/     Shell, Sample/Live switch, staged AI progress, shared UI
lib/            Data interface, live (Snowflake) and sample sources, theme rules
data/           Synthetic CSVs (see data/README.md)
scripts/        Data generator, sample capture, hosted example build, screenshots
sql/            setup.sql and cleanup.sql
docs/           GitHub Pages guide, DESIGN.md, and the hosted example in docs/try/
```

## License and disclaimer

Apache 2.0 (see [LICENSE](LICENSE) and [LEGAL.md](LEGAL.md)). This is an example provided as is. It is
not an official Snowflake product and is not supported by Snowflake Support.

Owner: Oz Oral · Last reviewed: November 2026
