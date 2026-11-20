-- =============================================================================
-- Complaints Intelligence: Snowflake setup
-- Synthetic data only (fictional "Northwind Bank"). The taxonomy, regulatory flags, and response
-- windows are illustrative, not an official regulator list. Not legal, regulatory, or compliance advice.
--
-- Run top to bottom in a Snowsight SQL worksheet (about 3 minutes on an XSMALL warehouse; most of it
-- is the first refresh of the AI classification Dynamic Table over 40,141 complaints).
--
-- COST: that first refresh used about 51 AI credits per run in our tests (AI_CLASSIFY about 42.5,
-- AI_SENTIMENT about 8.5). To try it for less, add a filter such as WHERE received_date >= '2026-11-02'
-- to the COMPLAINT_AI definition below. See the README for measured costs.
-- Requirements (see README): Cortex AI functions AI_CLASSIFY, AI_SENTIMENT, AI_EMBED, AI_AGG,
-- AI_REDACT, and AI_COMPLETE (llama3.3-70b) in your region or with cross-region inference, Cortex
-- Agents, and a role that can create roles, warehouses, databases, and API integrations.
--
-- Creates (and sql/cleanup.sql drops):
--   role        CI_DEMO_ROLE (owns everything below; the app connects with it)
--   warehouse   CI_WH (XSMALL, AUTO_SUSPEND = 60)
--   database    COMPLAINTS_INTEL_DEMO (schemas SRC, CI)
--   integration CI_GIT_API (read-only access to the public example repository)
-- It changes nothing that already exists.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Part 1. Account-level objects (ACCOUNTADMIN)
-- -----------------------------------------------------------------------------
USE ROLE ACCOUNTADMIN;

CREATE ROLE IF NOT EXISTS CI_DEMO_ROLE COMMENT = 'Complaints Intelligence example: object owner and app role';
GRANT ROLE CI_DEMO_ROLE TO ROLE SYSADMIN;
SET my_user = CURRENT_USER();
GRANT ROLE CI_DEMO_ROLE TO USER IDENTIFIER($my_user);

CREATE WAREHOUSE IF NOT EXISTS CI_WH
  WAREHOUSE_SIZE = XSMALL AUTO_SUSPEND = 60 AUTO_RESUME = TRUE INITIALLY_SUSPENDED = TRUE
  COMMENT = 'Complaints Intelligence example';
GRANT OWNERSHIP ON WAREHOUSE CI_WH TO ROLE CI_DEMO_ROLE;

CREATE DATABASE IF NOT EXISTS COMPLAINTS_INTEL_DEMO COMMENT = 'Complaints Intelligence example (synthetic data)';
GRANT OWNERSHIP ON DATABASE COMPLAINTS_INTEL_DEMO TO ROLE CI_DEMO_ROLE;

-- Cortex AI functions, Cortex Analyst, and Cortex Agents.
GRANT DATABASE ROLE SNOWFLAKE.CORTEX_USER TO ROLE CI_DEMO_ROLE;

-- Read-only access to the public GitHub repository that holds the synthetic CSVs.
CREATE API INTEGRATION IF NOT EXISTS CI_GIT_API
  API_PROVIDER = git_https_api
  API_ALLOWED_PREFIXES = ('https://github.com/sfc-gh-ooral/')
  ENABLED = TRUE
  COMMENT = 'Complaints Intelligence example: public repository, read only';
GRANT USAGE ON INTEGRATION CI_GIT_API TO ROLE CI_DEMO_ROLE;

-- -----------------------------------------------------------------------------
-- Part 2. Everything else runs as the least-privilege owner role
-- -----------------------------------------------------------------------------
USE ROLE CI_DEMO_ROLE;
USE WAREHOUSE CI_WH;
USE DATABASE COMPLAINTS_INTEL_DEMO;
CREATE SCHEMA IF NOT EXISTS SRC COMMENT = 'Complaints as received from every channel (synthetic)';
CREATE SCHEMA IF NOT EXISTS CI COMMENT = 'AI classification, themes, workflow, and evidence';

-- 2a. Load the synthetic data ---------------------------------------------------
USE SCHEMA SRC;
CREATE OR REPLACE GIT REPOSITORY CI_REPO
  API_INTEGRATION = CI_GIT_API
  ORIGIN = 'https://github.com/sfc-gh-ooral/sfguide-complaints-intelligence.git';
CREATE STAGE IF NOT EXISTS CI_DATA COMMENT = 'Synthetic CSVs copied from the repository';
COPY FILES INTO @CI_DATA FROM @CI_REPO/branches/main/data/ PATTERN = '.*[.]csv';
CREATE OR REPLACE FILE FORMAT CI_CSV TYPE = CSV SKIP_HEADER = 1 FIELD_OPTIONALLY_ENCLOSED_BY = '"' EMPTY_FIELD_AS_NULL = TRUE;

-- One row per complaint from calls (transcript snippets), emails, branch notes, social posts, and
-- regulator portal-style submissions. The text is the only thing the AI reads; it contains PII.
CREATE OR REPLACE TABLE COMPLAINTS (complaint_id VARCHAR, customer_id VARCHAR, received_date DATE, channel VARCHAR,
  product VARCHAR, complaint_text VARCHAR, status VARCHAR, due_date DATE, resolved_date DATE, resolution VARCHAR)
  CHANGE_TRACKING = TRUE COMMENT = 'Complaints as received (synthetic). complaint_text contains PII';
COPY INTO COMPLAINTS FROM @CI_DATA/complaints.csv FILE_FORMAT = (FORMAT_NAME = CI_CSV);
-- Internal taxonomy: subcategory -> category -> regulator-style issue (illustrative).
CREATE OR REPLACE TABLE TAXONOMY (subcategory VARCHAR, category VARCHAR, regulator_issue VARCHAR, description VARCHAR);
COPY INTO TAXONOMY FROM @CI_DATA/taxonomy.csv FILE_FORMAT = (FORMAT_NAME = CI_CSV);
CREATE OR REPLACE TABLE REGULATOR_PRODUCTS (product VARCHAR, regulator_product VARCHAR);
COPY INTO REGULATOR_PRODUCTS FROM @CI_DATA/regulator_products.csv FILE_FORMAT = (FORMAT_NAME = CI_CSV);

-- 2b. Continuous AI classification (Dynamic Table, incremental) ---------------------
USE SCHEMA CI;
-- The business clock is frozen so deadlines and aging match the bundled sample.
CREATE OR REPLACE TABLE CONFIG (as_of DATE, window_start DATE, due_days NUMBER, duplicate_threshold FLOAT);
INSERT INTO CONFIG VALUES ('2026-11-16', '2026-10-05', 15, 0.55);

-- New complaints are classified as they land. Only the immutable text is read, so status updates in
-- the workflow tables never trigger re-classification. To use your own taxonomy, edit the label list.
CREATE OR REPLACE DYNAMIC TABLE COMPLAINT_AI
  TARGET_LAG = '1 hour' WAREHOUSE = CI_WH REFRESH_MODE = INCREMENTAL
  COMMENT = 'AI_CLASSIFY subcategory and regulatory flags, AI_SENTIMENT, and AI_EMBED per complaint'
AS
SELECT complaint_id,
  AI_CLASSIFY(complaint_text,
    ['Overdraft or NSF fee', 'Monthly maintenance fee', 'Funds availability or hold', 'Online or mobile banking access',
     'Unauthorized transaction', 'Account closed unexpectedly', 'Interest rate or APR', 'Late fee', 'Purchase dispute',
     'Rewards not credited', 'Credit limit decrease', 'Credit reporting error', 'Escrow analysis or shortage',
     'Payment not applied', 'Hardship or modification', 'Application denied', 'Closing costs or fees at origination',
     'Repossession', 'GAP or add-on product refund', 'Customer service'],
    {'task_description': 'Classify a bank customer complaint by its main issue.'}):labels[0]::VARCHAR AS subcategory,
  AI_CLASSIFY(complaint_text,
    [{'label': 'UDAAP', 'description': 'possible unfair, deceptive, or abusive practice: unexpected fees, misleading balances or terms, charges not agreed to'},
     {'label': 'Fair lending', 'description': 'alleges discrimination based on race, color, national origin, religion, sex, pregnancy, marital status, age, disability, or public assistance'},
     {'label': 'Servicing', 'description': 'mortgage or auto loan servicing error: payment application, escrow, taxes, insurance, loss mitigation, repossession'}],
    {'task_description': 'Flag regulatory risks raised by a bank customer complaint. Choose every label that applies, or none.', 'output_mode': 'multi'}):labels AS flags,
  AI_SENTIMENT(complaint_text):categories[0]:sentiment::VARCHAR AS sentiment,
  AI_EMBED('snowflake-arctic-embed-m-v1.5', complaint_text) AS embedding
FROM COMPLAINTS_INTEL_DEMO.SRC.COMPLAINTS;

-- Likely duplicates: the same customer and AI subcategory within 14 days, with similar meaning (AI_EMBED
-- vectors). Channel framing (call scripts, social posts) lowers similarity, so the floor is 0.55; on this
-- synthetic data that finds the planted repeats and no unrelated pairs. Tune it for your data.
CREATE OR REPLACE DYNAMIC TABLE DUPLICATE_PAIRS
  TARGET_LAG = '1 hour' WAREHOUSE = CI_WH
  COMMENT = 'Pairs of complaints from one customer with the same AI subcategory and cosine similarity of at least 0.55'
AS
SELECT a.complaint_id AS complaint_id, b.complaint_id AS duplicate_of, a.customer_id,
  ROUND(VECTOR_COSINE_SIMILARITY(ea.embedding, eb.embedding), 3) AS similarity
FROM COMPLAINTS_INTEL_DEMO.SRC.COMPLAINTS a
JOIN COMPLAINTS_INTEL_DEMO.SRC.COMPLAINTS b
  ON a.customer_id = b.customer_id AND a.complaint_id > b.complaint_id AND ABS(DATEDIFF(day, a.received_date, b.received_date)) <= 14
JOIN COMPLAINT_AI ea ON ea.complaint_id = a.complaint_id
JOIN COMPLAINT_AI eb ON eb.complaint_id = b.complaint_id AND eb.subcategory = ea.subcategory
WHERE VECTOR_COSINE_SIMILARITY(ea.embedding, eb.embedding) >= 0.55;

-- 2c. Workflow tables (people make every decision) -----------------------------------
CREATE OR REPLACE TABLE CASE_UPDATES (complaint_id VARCHAR, status VARCHAR, resolution VARCHAR, routed_to VARCHAR,
  note VARCHAR, updated_by VARCHAR, updated_ts TIMESTAMP_NTZ) COMMENT = 'Status changes and routing decisions; latest row wins';
CREATE OR REPLACE TABLE THEME_ISSUES (issue_id VARCHAR, theme_id VARCHAR, owner VARCHAR, note VARCHAR,
  created_by VARCHAR, created_ts TIMESTAMP_NTZ) COMMENT = 'Root-cause issues opened from emerging themes';
CREATE OR REPLACE TABLE THEME_INSIGHTS (theme_id VARCHAR, week NUMBER, summary VARCHAR, quotes ARRAY, model VARCHAR,
  created_ts TIMESTAMP_NTZ) COMMENT = 'AI_AGG theme summaries and AI_REDACT example quotes, cached';
CREATE OR REPLACE TABLE REDACTIONS (complaint_id VARCHAR, redacted_text VARCHAR, created_ts TIMESTAMP_NTZ)
  COMMENT = 'AI_REDACT output per complaint, computed when a person opens it';
CREATE OR REPLACE TABLE RESPONSE_DRAFTS (complaint_id VARCHAR, draft VARCHAR, model VARCHAR, created_ts TIMESTAMP_NTZ)
  COMMENT = 'AI_COMPLETE response drafts; a person edits and approves before anything is sent';
CREATE OR REPLACE TABLE ACTIVITY_LOG (action VARCHAR, object_type VARCHAR, object_id VARCHAR, detail VARCHAR,
  ai_assisted BOOLEAN, actor VARCHAR, ts TIMESTAMP_NTZ) COMMENT = 'Evidence: every action taken in the app';

-- 2d. One view for every screen ---------------------------------------------------
CREATE OR REPLACE VIEW COMPLAINTS_V COMMENT = 'Complaints with AI classification, regulator mapping, workflow status, and aging' AS
WITH u AS (SELECT * FROM CASE_UPDATES QUALIFY ROW_NUMBER() OVER (PARTITION BY complaint_id ORDER BY updated_ts DESC) = 1),
d AS (SELECT complaint_id, MAX(duplicate_of) AS duplicate_of, MAX(similarity) AS duplicate_similarity FROM DUPLICATE_PAIRS GROUP BY 1)
SELECT c.complaint_id, c.customer_id, c.received_date, c.channel, c.product, c.due_date,
  FLOOR(DATEDIFF(day, cfg.window_start, c.received_date) / 7) + 1 AS week,
  COALESCE(u.status, c.status) AS status,
  COALESCE(u.resolution, c.resolution) AS resolution,
  IFF(u.status = 'Resolved', u.updated_ts::DATE, c.resolved_date) AS resolved_date,
  u.routed_to,
  a.subcategory, t.category, t.regulator_issue, rp.regulator_product,
  a.flags, ARRAY_SIZE(a.flags) > 0 AS high_risk,
  ARRAY_CONTAINS('UDAAP'::VARIANT, a.flags) AS flag_udaap,
  ARRAY_CONTAINS('Fair lending'::VARIANT, a.flags) AS flag_fair_lending,
  ARRAY_CONTAINS('Servicing'::VARIANT, a.flags) AS flag_servicing,
  a.sentiment,
  d.duplicate_of, d.duplicate_similarity,
  COALESCE(u.status, c.status) <> 'Resolved' AS is_open,
  DATEDIFF(day, cfg.as_of, c.due_date) AS days_to_due,
  DATEDIFF(day, c.received_date, cfg.as_of) AS age_days,
  IFF(COALESCE(u.status, c.status) = 'Resolved', IFF(u.status = 'Resolved', u.updated_ts::DATE, c.resolved_date) <= c.due_date, NULL) AS resolved_on_time
FROM COMPLAINTS_INTEL_DEMO.SRC.COMPLAINTS c
CROSS JOIN CONFIG cfg
JOIN COMPLAINT_AI a ON a.complaint_id = c.complaint_id
LEFT JOIN COMPLAINTS_INTEL_DEMO.SRC.TAXONOMY t ON t.subcategory = a.subcategory
LEFT JOIN COMPLAINTS_INTEL_DEMO.SRC.REGULATOR_PRODUCTS rp ON rp.product = c.product
LEFT JOIN u ON u.complaint_id = c.complaint_id
LEFT JOIN d ON d.complaint_id = c.complaint_id;

-- Themes: AI subcategory x product, counted by week.
CREATE OR REPLACE VIEW THEME_WEEKLY COMMENT = 'Complaint counts per AI theme (subcategory x product) per week' AS
SELECT subcategory || ' | ' || product AS theme_id, subcategory, product, category, week, COUNT(*) AS complaints,
  COUNT_IF(high_risk) AS high_risk
FROM COMPLAINTS_V GROUP BY ALL;

-- 2e. Semantic view and Cortex Agent for questions -----------------------------------
CREATE OR REPLACE SEMANTIC VIEW COMPLAINTS_SV
  TABLES (
    c AS COMPLAINTS_INTEL_DEMO.CI.COMPLAINTS_V PRIMARY KEY (complaint_id) COMMENT = 'One row per complaint with AI classification and workflow status'
  )
  FACTS (
    c.days_to_due_fact AS days_to_due COMMENT = 'Days until the response is due; negative means overdue',
    c.age_days_fact AS age_days
  )
  DIMENSIONS (
    c.complaint_id AS complaint_id, c.customer_id AS customer_id,
    c.received_date AS received_date, c.due_date AS due_date,
    c.week AS week COMMENT = 'Week 1 starts Monday 2026-10-05; week 6 ends 2026-11-15',
    c.channel AS channel COMMENT = 'Call, Email, Branch, Social, or Regulator portal',
    c.product AS product COMMENT = 'Deposits, Credit card, Mortgage, or Auto loan',
    c.status AS status COMMENT = 'Open, In progress, or Resolved',
    c.resolution AS resolution,
    c.subcategory AS subcategory COMMENT = 'AI_CLASSIFY issue subcategory, for example Overdraft or NSF fee',
    c.category AS category, c.regulator_issue AS regulator_issue, c.regulator_product AS regulator_product,
    c.high_risk AS high_risk COMMENT = 'True when any regulatory flag applies',
    c.flag_udaap AS flag_udaap, c.flag_fair_lending AS flag_fair_lending, c.flag_servicing AS flag_servicing,
    c.sentiment AS sentiment COMMENT = 'AI_SENTIMENT: positive, negative, neutral, or mixed',
    c.is_open AS is_open, c.resolved_on_time AS resolved_on_time,
    c.duplicate_of AS duplicate_of COMMENT = 'Earlier complaint from the same customer about the same problem'
  )
  METRICS (
    c.complaint_count AS COUNT(c.complaint_id),
    c.open_count AS COUNT_IF(c.is_open),
    c.high_risk_count AS COUNT_IF(c.high_risk),
    c.on_time_rate AS COUNT_IF(c.resolved_on_time) / NULLIF(COUNT_IF(c.resolved_on_time IS NOT NULL), 0) COMMENT = 'Share of resolved complaints closed by the due date',
    c.overdue_count AS COUNT_IF(c.is_open AND c.days_to_due_fact < 0)
  )
  COMMENT = 'Complaints Intelligence: complaints, AI categories, regulatory flags, deadlines';

CREATE OR REPLACE AGENT COMPLAINTS_AGENT
  COMMENT = 'Complaints Intelligence: answers questions about complaint volumes, themes, flags, and deadlines'
  FROM SPECIFICATION
$$
models:
  orchestration: auto
instructions:
  orchestration: >
    You help the complaints team at Northwind Bank. Use complaints_analyst for every number. The business
    date is 2026-11-16 and the data covers weeks 1 to 6 (2026-10-05 to 2026-11-15). Never quote complaint text
    or customer details.
  response: >
    Answer in under 120 words. Lead with the number or finding, then one or two supporting facts. Use a small
    table only when comparing more than three items.
tools:
  - tool_spec: { type: cortex_analyst_text_to_sql, name: complaints_analyst, description: "Complaint counts, AI categories, regulatory flags, sentiment, channels, products, weeks, deadlines, and on-time resolution" }
tool_resources:
  complaints_analyst: { semantic_view: COMPLAINTS_INTEL_DEMO.CI.COMPLAINTS_SV, execution_environment: { type: warehouse, warehouse: CI_WH } }
$$;

-- Done. Quick check (the Dynamic Table's first refresh classified every complaint):
SELECT subcategory, COUNT(*) AS complaints, COUNT_IF(flag_fair_lending) AS fair_lending
FROM COMPLAINTS_V GROUP BY 1 ORDER BY 2 DESC;
