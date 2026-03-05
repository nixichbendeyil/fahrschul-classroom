-- supabase/migrations/004_admin_role.sql
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;
