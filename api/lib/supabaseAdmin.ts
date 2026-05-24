import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || '';

export let supabaseAdmin: SupabaseClient | null = null;

if (supabaseUrl && supabaseServiceKey) {
  try {
    console.log('[Supabase Admin] Initializing admin client with URL:', supabaseUrl);
    supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
  } catch (err) {
    console.error('[Supabase Admin] Failed to initialize admin client:', err);
  }
} else {
  console.warn('[Supabase Admin] WARNING: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing. Operating in local demo mode.');
}

