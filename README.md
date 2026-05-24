# REN's CrossPost Studio

A production-ready full-stack, single-user social media cross-posting and scheduling application built with a Vercel Serverless backend and a responsive Tailwind dark-mode React frontend.

## Supported Social Platforms

- **Facebook Pages** (via Meta Graph API)
- **Instagram Professional Accounts** (via Meta Content Publishing API)
- **TikTok** (via TikTok Content Posting API)
- **X / Twitter** (via X API v2 Tweets)
- **LinkedIn Member Profiles** (via LinkedIn UGC API)
- **YouTube & YouTube Shorts** (via YouTube Data API v3 upload)
- **Pinterest Board Pins** (via Pinterest API v5 Pins)
- **Threads** (via Meta Threads API)

## Architecture Overview

1. **Vite React Frontend**: Styled with utility classes, Lucide icons, and state transitions.
2. **Vercel Serverless backend**: Centralized Serverless endpoints inside `/api/*` for robust, high-performance execution.
3. **Supabase PostgreSQL**: Replaces mock & local storage to persist Connected Accounts, secure OAuth Tokens, Posts, Targets, Scheduled Posts, and Logs.
4. **Supabase Storage**: Media file uploads are saved directly using secure pre-signed URLs, preventing serverless memory timeout issues.
5. **Vercel Cron Worker**: Executes `/api/cron/publish-scheduled` every 5 minutes to release queued posts.

## Production Setup & Deployment

### 1. Supabase Database Schema
1. Log in to your **Supabase Dashboard** and create a brand new project.
2. Go to the **SQL Editor** panel in Supabase.
3. Open and copy the SQL statements located in `/supabase/schema.sql` inside this repo.
4. Paste and click **Run** to execute the statements and create your tables.

### 2. Configure Storage Bucket
1. In the Supabase Dashboard, go to **Storage**.
2. Create a new bucket named exactly **`media`**.
3. Toggle the visibility mode to **Public** so that external APIs can download files during publication.

### 3. Setup Vercel Environment variables

Configure these server-side or in your Vercel Dashboard secrets panel:

```env
APP_URL="https://your-vercel-domain.vercel.app"
SESSION_SECRET="your_long_session_cookie_signer"

# Supabase Keys (Never expose the Service Role key to frontend!)
SUPABASE_URL="https://your-supabase-project.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="your_service_role_key_value"
SUPABASE_ANON_KEY="your_anon_key_value"

# Meta APIs
FACEBOOK_CLIENT_ID="xxx"
FACEBOOK_CLIENT_SECRET="xxx"
INSTAGRAM_CLIENT_ID="xxx"
INSTAGRAM_CLIENT_SECRET="xxx"
THREADS_CLIENT_ID="xxx"
THREADS_CLIENT_SECRET="xxx"

# X / Twitter
X_CLIENT_ID="xxx"
X_CLIENT_SECRET="xxx"

# TikTok
TIKTOK_CLIENT_ID="xxx"
TIKTOK_CLIENT_SECRET="xxx"

# LinkedIn
LINKEDIN_CLIENT_ID="xxx"
LINKEDIN_CLIENT_SECRET="xxx"

# Google YouTube
YOUTUBE_CLIENT_ID="xxx"
YOUTUBE_CLIENT_SECRET="xxx"

# Pinterest v5
PINTEREST_CLIENT_ID="xxx"
PINTEREST_CLIENT_SECRET="xxx"
```

### 4. Redirect URIs for Social Developer Portals
For each social platform developer application, configure the OAuth 2.0 Web Redirect URI as follows:
- **Facebook**: `https://your-vercel-domain.vercel.app/api/oauth/facebook/callback`
- **Instagram**: `https://your-vercel-domain.vercel.app/api/oauth/instagram/callback`
- **TikTok**: `https://your-vercel-domain.vercel.app/api/oauth/tiktok/callback`
- **X / Twitter**: `https://your-vercel-domain.vercel.app/api/oauth/x/callback`
- **LinkedIn**: `https://your-vercel-domain.vercel.app/api/oauth/linkedin/callback`
- **YouTube**: `https://your-vercel-domain.vercel.app/api/oauth/youtube/callback`
- **Pinterest**: `https://your-vercel-domain.vercel.app/api/oauth/pinterest/callback`
- **Threads**: `https://your-vercel-domain.vercel.app/api/oauth/threads/callback`

### 5. Deploying to Vercel
Push this repository directly to GitHub and link it to your Vercel account, or install the Vercel CLI and run:
```bash
vercel deploy --prod
```
The build configuration `npm run build` will build the static assets into `dist/` and expose the API routes under `/api/*` automatically.

