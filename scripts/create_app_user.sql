-- ============================================================
-- Society OS — Restricted App User SQL Migration
-- Run as: neondb_owner in Neon Console SQL Editor
-- Purpose: Create a restricted PostgreSQL role (app_user) that
--          CANNOT bypass Row Level Security. This is the P0 fix
--          for the RLS bypass via neondb_owner connection.
--
-- AFTER running this script:
--   1. Update .env: APP_DATABASE_URL to use app_user credentials
--   2. Keep DATABASE_URL as neondb_owner (for drizzle-kit migrations only)
-- ============================================================

-- Step 1: Create the application role
-- NOBYPASSRLS is critical — prevents this role from bypassing RLS policies.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user WITH
      LOGIN
      PASSWORD 'REPLACE_WITH_STRONG_RANDOM_PASSWORD'
      NOINHERIT
      NOCREATEDB
      NOCREATEROLE
      NOBYPASSRLS;
  END IF;
END
$$;

-- Step 2: Grant connect on the database
GRANT CONNECT ON DATABASE neondb TO app_user;

-- Step 3: Grant schema usage
GRANT USAGE ON SCHEMA public TO app_user;

-- Step 4: Grant full DML on all current tables
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;

-- Step 5: Grant sequence usage (for UUID/serial generation)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- Step 6: Ensure future tables also get the same grants automatically
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO app_user;

-- Step 7: RESTRICT audit_logs to INSERT-only for app_user
-- This enforces append-only semantics at the DB layer, making audit logs immutable.
-- Even if application code tries UPDATE or DELETE on audit_logs, it will be rejected.
REVOKE UPDATE, DELETE ON audit_logs FROM app_user;

-- Step 8: Verify the setup
SELECT
  grantee,
  table_name,
  privilege_type
FROM information_schema.role_table_grants
WHERE grantee = 'app_user'
ORDER BY table_name, privilege_type;

-- Expected: audit_logs has SELECT + INSERT only (no UPDATE/DELETE).
-- All other tables: SELECT, INSERT, UPDATE, DELETE.

-- ============================================================
-- .env update required after running this script:
--
-- # Migration pool - owner credentials (drizzle-kit only)
-- DATABASE_URL="postgresql://neondb_owner:...@.../neondb?sslmode=require"
--
-- # Application runtime pool - restricted app_user (RLS enforced)
-- APP_DATABASE_URL="postgresql://app_user:REPLACE_WITH_STRONG_RANDOM_PASSWORD@.../neondb?sslmode=require"
-- ============================================================
