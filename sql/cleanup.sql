-- =============================================================================
-- Complaints Intelligence: remove everything sql/setup.sql created.
-- Run as a user that holds ACCOUNTADMIN. Touches nothing else.
-- =============================================================================
-- Objects inside the database are owned by CI_DEMO_ROLE, so drop them with that role first.
USE ROLE CI_DEMO_ROLE;
DROP DATABASE IF EXISTS COMPLAINTS_INTEL_DEMO;   -- tables, Dynamic Tables, views, semantic view, agent, Git repository
DROP WAREHOUSE IF EXISTS CI_WH;

USE ROLE ACCOUNTADMIN;
DROP INTEGRATION IF EXISTS CI_GIT_API;
DROP ROLE IF EXISTS CI_DEMO_ROLE;

-- Confirm nothing is left (each should return no rows):
SHOW DATABASES LIKE 'COMPLAINTS_INTEL_DEMO';
SHOW WAREHOUSES LIKE 'CI_WH';
SHOW INTEGRATIONS LIKE 'CI_GIT_API';
SHOW ROLES LIKE 'CI_DEMO_ROLE';
