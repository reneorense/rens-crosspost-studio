# Supabase Setup Guide for Social Media Post Manager

This document provides step-by-step instructions for provisioning and configuring Supabase as your serverless database and binary media storage engine.

## Step 1: Create a Supabase Project

1. Navigate to [Supabase Dashboard](https://supabase.com).
2. Sign in or create a new account.
3. Click on **New Project** and select or create an organization.
4. Provide a project name, a strong database password, and choose a region closest to your Vercel deployment location.
5. Click **Create New Project** and wait for provisioning to complete.

## Step 2: Apply the SQL Schema

1. Once the project dashboard is loaded, click on **SQL Editor** in the left-hand navigation bar (represented by the console code icon).
2. Click **New Query**.
3. Copy the contents of the `/supabase/schema.sql` file in this directory.
4. Paste it into the SQL workspace editor.
5. Click **Run** on the bottom right. You should see a success message indicating queries were processed and tables were created.

## Step 3: Configure Storage Buckets for Media Uploads

1. Click on **Storage** in the left-hand navigation sidebar (represented by the bucket or folder icon).
2. Click **New Bucket**.
3. Set the Bucket Name to exactly: `media`.
4. Make the bucket **Public** (check the public toggle) so uploaded images and videos can be accessed publicly via URLs when posted to social feeds.
5. Click **Save** or **Create Bucket**.
6. Set up a storage policy to ensure Vercel backend serverless calls and users can upload and delete items. Under storage settings or policies:
   - Click **Add Policy** or **New Policy** next to the `media` bucket.
   - Choose "Allow full access (insert, update, select, delete) to authenticated and anonymous users" or customize appropriate permissions.

## Step 4: Retrieve Project Keys and Connection Strings

1. Click on **Settings** (gear icon) on the left panel, and navigate to **API** under Project Settings.
2. Here, you will find the required credentials:
   - **Project URL**: Found in the *Project URL* section. This is your `SUPABASE_URL`.
   - **Anon Public API Key**: Under *Project API keys* as `anon public`. This is your `SUPABASE_ANON_KEY`.
   - **Service Role Secret Key**: Under *Project API keys* as `service_role secret` (Click *Reveal* to view). This is your `SUPABASE_SERVICE_ROLE_KEY`. **CRITICAL: NEVER expose this key in your client-side files or frontend UI.**

## Step 5: Required Environment Variables

Configure these variables inside your **Vercel Project Settings** or local `.env` file (never commit confidential secrets to git):

```env
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ...
SUPABASE_MEDIA_BUCKET=media
```
