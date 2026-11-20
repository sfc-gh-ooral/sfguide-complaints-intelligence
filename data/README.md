# Synthetic data

Everything here comes from `scripts/generate-data.mjs` (seeded, so every run writes the same rows).
Fictional bank "Northwind Bank". Customer names are invented, phone numbers use the fictional 555-01xx
range, and email addresses use `example.com`.

| File | Rows | What it is |
| --- | --- | --- |
| `complaints.csv` | 40,141 | One complaint each from calls (transcript snippets), emails, branch notes, social posts, and regulator portal-style submissions, October 5 to November 15, 2026. Products: Deposits, Credit card, Mortgage, Auto loan. Received date, response due date (received + 15 days, illustrative), status, resolution |
| `taxonomy.csv` | 20 | Internal subcategory, category, and regulator-style issue (illustrative) |
| `regulator_products.csv` | 4 | Internal product to regulator-style product |

The AI labels are not in the CSVs: Snowflake computes them in `CI.COMPLAINT_AI`.

## Planted stories

| # | Story | How it is planted | What to look for |
| --- | --- | --- | --- |
| 1 | Overdraft fees after an app update | 2,560 extra deposit complaints from Tuesday, October 20 (week 3) that mention the app update or version 7.2 and a wrong balance, tapering off in weeks 4 to 6 | Emerging themes: Overdraft or NSF fee · Deposits, +1,010% in week 3 |
| 2 | Discrimination allegations | 27 complaints, mostly mortgage and auto loans, alleging different treatment on age, sex, pregnancy, national origin, race (redlining), disability, language, or public assistance | Queue: Fair-lending review (27) |
| 3 | Escrow deadlines | 34 open mortgage escrow complaints received November 2 to 4, due November 17 to 19 (plus background escrow complaints in the same window) | Overview: deadlines in the next 3 days by subcategory |
| 4 | Repeat complaints | 48 customers who send the same complaint through two or three channels within a few days | Queue: Likely duplicates; complaint detail: Same customer |

About 400 other customers also have two unrelated complaints, so a shared customer ID alone doesn't
make a duplicate.
