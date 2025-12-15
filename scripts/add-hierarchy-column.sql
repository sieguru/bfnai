-- Migration: Add hierarchy_json column to documents table
-- Run this if upgrading from a previous version

ALTER TABLE documents ADD COLUMN hierarchy_json JSON AFTER metadata;
