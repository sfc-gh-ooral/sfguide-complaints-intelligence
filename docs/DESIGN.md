# Design: Tallowmark Complaints Desk

Tallowmark is a fictional product brand used only in this example. The fictional firm using it is
Northwind Bank. All data is synthetic.

## Brand

- **Name:** Tallowmark Complaints Desk. A tally mark is how you count what you hear; the product
  counts and reads every complaint so the pattern shows before it becomes a finding.
- **Logo mark:** four upright strokes crossed by a fifth diagonal stroke (a tally of five) inside a
  rounded square, burgundy on light, rose on dark. It is inline SVG in `components/Brand.tsx` and in
  `docs/index.html`.
- **Voice:** calm, exact, regulator-literate. Short sentences, numbers first, no hype. Labels say
  what a thing is ("Response due in 3 days"), never what it might feel like.
- **Audience:** complaints analysts, complaints management leads, and second-line compliance.

## Direction: "case file"

Editorial and paper-like in light mode, like a well-kept case file; graphite in dark mode. Serif
headings give it a document feel; sans body and tabular numerals keep tables fast to scan.

### Palette

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--canvas` | `#F3F4F1` | `#121417` | page background (stone) |
| `--paper` | `#FFFFFF` | `#1A1D22` | cards |
| `--paper-2` | `#EBEDE8` | `#22262C` | wells, table headers |
| `--rule` | `#D9DCD4` | `#2E333A` | hairlines |
| `--ink` | `#191B1F` | `#ECEDEA` | text |
| `--ink-2` | `#4A4F57` | `#B4B9BF` | secondary text |
| `--brand` | `#8C1D40` | `#E26D8F` | burgundy: brand, primary actions, active nav |
| `--brand-soft` | `#F6E7EC` | `#3A1F29` | brand washes |
| `--signal` | `#0E6E6C` | `#4FC1BC` | teal: AI, Cortex output, links |
| `--signal-soft` | `#E1F0EF` | `#163330` | AI panels |
| `--amber` | `#9A5B00` | `#E6A646` | due soon, warnings |
| `--danger` | `#B42318` | `#F07A6E` | overdue, fair-lending |
| `--ok` | `#2B7A4B` | `#5CC98A` | on time, resolved |

Chart series: burgundy `#8C1D40`, teal `#0E6E6C`, ochre `#C08A2E`, slate `#5B6573`. All text pairs
meet WCAG AA (4.5:1) on `--paper`; the burgundy and teal were picked darker than usual for that reason.

### Typography

- Headings: system serif stack (`"Iowan Old Style", "Charter", "Georgia", serif`), weight 600.
- Body and UI: system sans (`ui-sans-serif, -apple-system, "Segoe UI", sans-serif`), 13–14 px.
- Numbers: tabular figures everywhere; KPI values in the serif at 30 px.
- No web fonts and no CDN: everything ships with the app.

### Layout model

- **Top navigation bar**, not a sidebar: logo and product name on the left, section tabs in the
  middle, environment badge (Sample / Live), the Live/Sample switch and a user/role chip on the right.
  On phones the tabs become a horizontally scrolling strip under the bar.
- Under the bar, each screen opens with a **docket header**: serif title, a one-line description, a
  thin "case reference" line (business date, record count, source), and the Snowflake capability chips.
- Content sits in a 12-column grid, max 1360 px. Density is medium-high: 13 px tables, 8 px row padding.
- The queue opens complaints in a **right-hand drawer** (quick view) with a link to the full case file.

### Charts

Recharts with flat fills, no gradients on bars, 2 px lines, hairline grid only on the value axis,
custom tooltip cards with the same paper and rule tokens, and legends at the top left. Sparklines in
KPI tiles and theme rows. Every chart has an `aria-label` that states the key numbers.

### Motion

- Page content fades up 8 px (220 ms). KPI values count up on first render (600 ms ease-out).
- Skeleton blocks (shimmering paper-2) for every loading table, chart and tile.
- Drawer slides in from the right (240 ms). Hover lifts table rows with a burgundy left rule.
- AI work shows a staged "reasoning ledger" with real counts, then the answer streams in word by
  word, then citations appear. All motion is off under `prefers-reduced-motion`.

## How this differs from the live catalog

Checked against the landing pages and Try apps of Workforce Intelligence (cream + coral on deep
violet, sidebar), Auto Finance Portfolio Analytics (night navy + lime, monospace display), Loss
Triangle Analysis (purple + cyan, sidebar), Credit Risk Model Studio (dark green + amber + coral),
Contact Driver Analytics, Wealth Advisor Assistant, and KYC Onboarding Workbench (the shared
Snowflake-blue sidebar template, which v1 of this pack also used).

What this pack avoids:

- No left sidebar: every one of those apps uses one. Tallowmark uses a top bar and a drawer.
- No Snowflake-blue, violet, lime or coral as the main color. Burgundy + teal on stone is not used
  by any live pack.
- No gradient hero banner and no dark hero on the landing page: the landing page is a light,
  editorial "case file" page with a serif headline, a tally-mark rule, and a stacked "docket" of
  screenshots.
- No monospace display type; serif headings instead.

## Accessibility

AA contrast for all text; focus rings in `--signal`; tables use `th scope`; the drawer traps focus,
closes on Escape and returns focus; every chart and screenshot has text that states what it shows.
