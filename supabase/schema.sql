-- Supabase Schema for Social Post Manager

-- Enable UUID extension if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Insert a default user for local or simple authenticated use
INSERT INTO users (id, email)
VALUES ('u1', 'user@example.com')
ON CONFLICT (id) DO NOTHING;

-- 2. Connected Accounts Table
CREATE TABLE IF NOT EXISTS connected_accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT DEFAULT 'u1',
  platform TEXT NOT NULL,
  platform_account_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  status TEXT DEFAULT 'active',
  posts_count INTEGER DEFAULT 0,
  last_post_date TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 3. OAuth Tokens Table
CREATE TABLE IF NOT EXISTS oauth_tokens (
  id TEXT PRIMARY KEY,
  connected_account_id TEXT NOT NULL REFERENCES connected_accounts(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 4. Posts Table
CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  user_id TEXT DEFAULT 'u1',
  title TEXT,
  caption TEXT,
  media_asset_ids TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'pending',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 5. Post Targets Table
CREATE TABLE IF NOT EXISTS post_targets (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  connected_account_id TEXT NOT NULL REFERENCES connected_accounts(id) ON DELETE CASCADE,
  platform_post_id TEXT,
  platform_post_url TEXT,
  status TEXT DEFAULT 'pending',
  error_message TEXT,
  posted_at TEXT
);

-- 6. Scheduled Posts Table
CREATE TABLE IF NOT EXISTS scheduled_posts (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  scheduled_at TEXT NOT NULL,
  timezone TEXT DEFAULT 'UTC',
  status TEXT DEFAULT 'scheduled',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 7. Media Assets Table
CREATE TABLE IF NOT EXISTS media_assets (
  id TEXT PRIMARY KEY,
  user_id TEXT DEFAULT 'u1',
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL DEFAULT 'image',
  file_name TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type TEXT,
  created_at TEXT NOT NULL
);

-- 8. Post Logs Table
CREATE TABLE IF NOT EXISTS post_logs (
  id TEXT PRIMARY KEY,
  post_id TEXT,
  platform TEXT NOT NULL,
  action TEXT NOT NULL,
  status TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- RLS (Row Level Security) - Simplified for social automation or configured appropriately
-- To make quick testing easier, RLS can be enabled or bypassable by service role key APIs
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE connected_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_logs ENABLE ROW LEVEL SECURITY;

-- Dynamic Policies for service role bypass / public authenticated access
CREATE POLICY "Allow all access for authenticated users to users" ON users FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow all access for authenticated users to connected_accounts" ON connected_accounts FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow all access for authenticated users to oauth_tokens" ON oauth_tokens FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow all access for authenticated users to posts" ON posts FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow all access for authenticated users to post_targets" ON post_targets FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow all access for authenticated users to scheduled_posts" ON scheduled_posts FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow all access for authenticated users to media_assets" ON media_assets FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow all access for authenticated users to post_logs" ON post_logs FOR ALL TO authenticated USING (true);

-- Allow anonymous checkouts/access for simpler client/server access if auth session is empty (using service role bypass or anon-authenticated fallback)
CREATE POLICY "Bypass RLS for service_role to users" ON users FOR ALL USING (true);
CREATE POLICY "Bypass RLS for service_role to connected_accounts" ON connected_accounts FOR ALL USING (true);
CREATE POLICY "Bypass RLS for service_role to oauth_tokens" ON oauth_tokens FOR ALL USING (true);
CREATE POLICY "Bypass RLS for service_role to posts" ON posts FOR ALL USING (true);
CREATE POLICY "Bypass RLS for service_role to post_targets" ON post_targets FOR ALL USING (true);
CREATE POLICY "Bypass RLS for service_role to scheduled_posts" ON scheduled_posts FOR ALL USING (true);
CREATE POLICY "Bypass RLS for service_role to media_assets" ON media_assets FOR ALL USING (true);
CREATE POLICY "Bypass RLS for service_role to post_logs" ON post_logs FOR ALL USING (true);
