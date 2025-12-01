-- Initialize database
CREATE DATABASE IF NOT EXISTS flowbuilder;
USE flowbuilder;

-- This file is executed by MySQL container on first startup
-- The actual schema is created by migrations
-- 
-- Migration Order (001-020):
--   001-006: Core tables (roles, companies, users, suppliers, projects)
--   007-008: Categories and materials
--   009-011: RFQ workflow (rfqs, rfq_suppliers, rfq_materials)
--   012-014: Quote and PO workflow (quotes, quote_items, pos)
--   015-016: Support tables (sessions, notifications)
--   017-020: ETL integration extensions (extend suppliers/materials/quote_items, supplier_materials)
--
-- Seed Order (001-019):
--   001-009: Base application data (roles, companies, users, suppliers, etc.)
--   010-019: ETL historical data (project, suppliers, materials, RFQ workflow)
--
-- All migrations and seeds are automatically executed by src/utils/migrate.js
