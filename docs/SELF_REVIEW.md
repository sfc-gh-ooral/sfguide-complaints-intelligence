# Self-review

Checked against the Snow Packs build checklist and every **Must** in the catalog's
[CONTRIBUTING.md](https://github.com/sfc-gh-ooral/snow-packs/blob/main/CONTRIBUTING.md).
Last checked: November 2026 at commit after `356b07e` (review round 1).

## Before you call it done

| Check | Result | Evidence |
| --- | --- | --- |
| Run from a fresh clone in Sample (mock) mode | Pass | `npm ci`, `npm run lint`, `tsc --noEmit` and `npm run build` clean; `/try/` is the same build on bundled data |
| Setup → Live mode → cleanup in a clean role | Pass | `sql/setup.sql` run in the build account as `CI_DEMO_ROLE` (earlier build session, November 2026); every screen and AI action used in Live mode (the sample capture in `lib/sample/data.json` is that run's output); `sql/cleanup.sql` run and `SHOW DATABASES/WAREHOUSES/ROLES` returned nothing for the pack |
| Grep files and git history for secrets, account identifiers, real user names | Pass | `git log -p --all` scanned for account locators, hostnames, user names and key headers: no hits |
| Pages URL and `/try/` signed out, phone width and dark mode | Pass | Landing and `/try/` return 200; all 11 JS/CSS assets return 200; rendered at 390 px and 1440 px in light and dark |
| Every planted story visible in a screenshot | Pass | Overdraft spike (01, 02, 07), fair-lending flags (01, 06), escrow deadlines (03), repeat complaints (05) |

## CONTRIBUTING Musts

| Must | Result | Where |
| --- | --- | --- |
| Business problem a specific industry recognizes | Pass | README headline and scenario |
| One industry and one business function | Pass | Banking · Compliance (catalog entry) |
| Public repo named `sfguide-<topic>` | Pass | `sfguide-complaints-intelligence` |
| `LICENSE` (Apache 2.0) | Pass | `LICENSE` |
| GitHub Pages enabled, `.nojekyll` when needed | Pass | `/docs`, `docs/.nojekyll` |
| Business problem and outcome on the first screen | Pass | `docs/index.html` hero, README intro |
| Screenshots of the running app | Pass | `docs/images/01–08` |
| Caption naming the capability, plus alt text, for every screenshot | Pass | `docs/index.html` figures; alt text matches the current screenshots (41.2% high-risk, 1,426 overdue, 957 overdraft) |
| Name the capability behind each step; only claim what was used and tested | Pass | README "Snowflake capabilities used (all run in Live mode)" and the landing-page table |
| Visible disclaimer (synthetic, illustrative, not advice) | Pass | Banner in the app, landing page, README |
| Links to repository and Snowflake docs | Pass | Landing page and README |
| No Snowflake logo files or trademarked imagery | Pass | Fictional Tallowmark mark (inline SVG) |
| No internal sales motions | Pass | Copy is about the reader's business |
| End-user app with a real workflow | Pass | Queue, drawer, case file, route/resolve/link-duplicate with a note, open issue |
| No-account mode on bundled synthetic data | Pass | Sample mode and hosted `/try/` |
| Simulated output labeled ("Sample AI response") | Pass | Every AI panel in Sample mode |
| Live mode on Snowflake | Pass | Sample/Live switch; no silent fallback in Live mode |
| Synthetic data, deterministic | Pass | `scripts/generate-data.mjs` (seeded) |
| Self-contained setup (own DB, XSMALL warehouse, no changes elsewhere) | Pass | `COMPLAINTS_INTEL_DEMO`, `CI_WH` (XSMALL, AUTO_SUSPEND 60), `CI_DEMO_ROLE` |
| Cleanup removes everything | Pass | `sql/cleanup.sql` |
| No credentials, account identifiers, hostnames in code, screenshots or history | Pass | Scan above; `.env.local` is git-ignored |
| User names redacted in captured output | Pass | Role shown as `CI_DEMO_ROLE`; no user names in screenshots |
| No customer names, logos, data or identifiable logic | Pass | Fictional firm and brand; synthetic data |
| No deals, internal programs or non-public roadmap | Pass | |
| GA features, or preview features labeled | Pass | All functions used are GA; `AI_REDACT` has been generally available since December 2025 (it launched as Preview in November 2025), so no Preview label is needed |
| Prerequisites | Pass | README "Prerequisites" |
| Step-by-step run instructions and objects created | Pass | README "Live mode" and objects table |
| Expected cost and time | Pass | README timings table |
| Known limitations | Pass | README "Known limitations" |
| Customize with Cortex Code prompts | Pass | README, three prompts |
| Owner and last-reviewed date | Pass | `Owner: Oz Oral · Last reviewed: November 2026` |
| License and as-is disclaimer | Pass | README "License and disclaimer" |
| Outcomes described as possibilities, no unmeasured numbers | Pass | |
| Planted results qualified "on this synthetic data set" | Pass | README stories, landing-page note |

## Should items skipped

- Sample firm name "Northwind Bank": left for the maintainer's call.

## Polish pass, November 20, 2026

- Fresh clone, `npm ci`, `npm run dev`: pass (home page returns 200).
- Dark mode: renders with the dark theme, no console errors.
- Round-1 Should items 6 and 7, done: when Live mode reuses a saved AI_REDACT, AI_COMPLETE or AI_AGG result, a ledger step under the answer says so (`CachedNote` in `components/Reasoning.tsx`); the color, font and shadow tokens are mapped into a Tailwind `@theme inline` block (`app/globals.css`, documented in `docs/DESIGN.md`).
- `npm run lint` and `tsc --noEmit`: pass.
