import fs from 'fs';
import path from 'path';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { 
  ConnectedAccount, 
  Post, 
  PostTarget, 
  ScheduledPost, 
  MediaAsset, 
  PostLog 
} from '../types';

export interface OAuthToken {
  id: string;
  connected_account_id: string;
  platform: string;
  access_token: string;
  refresh_token?: string;
  expires_at?: string;
  created_at: string;
  updated_at: string;
}

const DB_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DB_DIR, 'database.json');

interface Schema {
  connected_accounts: ConnectedAccount[];
  posts: Post[];
  post_targets: PostTarget[];
  scheduled_posts: ScheduledPost[];
  media_assets: MediaAsset[];
  post_logs: PostLog[];
}

// Global lazy-loaded Supabase client instance
let supabaseInstance: SupabaseClient | null = null;
let supabaseInitialized = false;

function getSupabase(): SupabaseClient | null {
  if (supabaseInitialized) return supabaseInstance;
  
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
  
  if (supabaseUrl && supabaseKey) {
    try {
      console.log('[Supabase] Initializing connection to:', supabaseUrl);
      supabaseInstance = createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: false }
      });
    } catch (err) {
      console.error('[Supabase] Failed to initialize client:', err);
    }
  } else {
    console.warn('[Supabase] SUPABASE_URL or SUPABASE_KEY/SUPABASE_SERVICE_ROLE_KEY missing. Local fallback active.');
  }
  supabaseInitialized = true;
  return supabaseInstance;
}

// Keep a local file-based database schema for seamless startup & offline dev fallback
class FileDatabase {
  private schema: Schema;

  constructor() {
    this.schema = {
      connected_accounts: [],
      posts: [],
      post_targets: [],
      scheduled_posts: [],
      media_assets: [],
      post_logs: []
    };
    this.init();
  }

  public init() {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }

    if (fs.existsSync(DB_FILE)) {
      try {
        const fileContent = fs.readFileSync(DB_FILE, 'utf-8');
        this.schema = JSON.parse(fileContent);
      } catch (err) {
        this.seed();
      }
    } else {
      this.seed();
    }
  }

  private seed() {
    // Initial static empty states for design preview
    this.schema = {
      connected_accounts: [],
      posts: [],
      post_targets: [],
      scheduled_posts: [],
      media_assets: [],
      post_logs: []
    };
    this.save();
  }

  public save() {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(this.schema, null, 2), 'utf-8');
    } catch (e) {
      console.error('Error writing fallback database file:', e);
    }
  }

  getSchema() {
    return this.schema;
  }
}

const fileDB = new FileDatabase();

// Local store for token records during local fallback mode
const fallbackOAuthTokens: Record<string, OAuthToken> = {};

// Unified Hybrid Database Engine
export const db = {
  // Clear or reset local mock data
  async clearAllfallbackData() {
    fileDB.getSchema().connected_accounts = [];
    fileDB.getSchema().posts = [];
    fileDB.getSchema().post_targets = [];
    fileDB.getSchema().scheduled_posts = [];
    fileDB.getSchema().media_assets = [];
    fileDB.getSchema().post_logs = [];
    fileDB.save();
  },

  // Connected Accounts
  async getAccounts(): Promise<ConnectedAccount[]> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('connected_accounts')
          .select('*')
          .order('created_at', { ascending: false });
        if (!error && data) {
          // Exclude and strip token credentials before leaving server boundaries
          return data.map(acc => ({
            ...acc,
            access_token_reference: '',
            refresh_token_reference: ''
          }));
        }
        console.warn('[Supabase] getAccounts error matching table, using file fallback:', error?.message);
      } catch (err: any) {
        console.warn('[Supabase] getAccounts exception, using file fallback:', err.message);
      }
    }
    fileDB.init();
    // Exclude actual references if fallback also was holding anything
    return fileDB.getSchema().connected_accounts.map(acc => ({
      ...acc,
      access_token_reference: '',
      refresh_token_reference: ''
    }));
  },

  async getAccountById(id: string): Promise<ConnectedAccount | null> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('connected_accounts')
          .select('*')
          .eq('id', id)
          .maybeSingle();
        if (!error && data) {
          return data;
        }
      } catch (err: any) {
        console.warn('[Supabase] getAccountById error:', err.message);
      }
    }
    fileDB.init();
    return fileDB.getSchema().connected_accounts.find(a => a.id === id) || null;
  },

  async saveAccount(account: ConnectedAccount): Promise<void> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { error } = await supabase
          .from('connected_accounts')
          .upsert({
            id: account.id,
            user_id: account.user_id,
            platform: account.platform,
            platform_account_id: account.platform_account_id,
            display_name: account.display_name,
            avatar_url: account.avatar_url,
            status: account.status,
            created_at: account.created_at,
            updated_at: account.updated_at,
            posts_count: account.posts_count || 0,
            last_post_date: account.last_post_date || ''
          });
        if (!error) return;
        console.warn('[Supabase] saveAccount table insert failed, using fallback:', error.message);
      } catch (err: any) {
        console.warn('[Supabase] saveAccount exception, using fallback:', err.message);
      }
    }
    fileDB.init();
    const schema = fileDB.getSchema();
    const idx = schema.connected_accounts.findIndex(a => a.id === account.id);
    if (idx !== -1) {
      schema.connected_accounts[idx] = { ...account, updated_at: new Date().toISOString() };
    } else {
      schema.connected_accounts.push(account);
    }
    fileDB.save();
  },

  async removeAccount(id: string): Promise<void> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { error: err1 } = await supabase.from('oauth_tokens').delete().eq('connected_account_id', id);
        const { error: err2 } = await supabase.from('connected_accounts').delete().eq('id', id);
        if (!err1 && !err2) return;
      } catch (err: any) {
        console.warn('[Supabase] removeAccount exception:', err.message);
      }
    }
    fileDB.init();
    const schema = fileDB.getSchema();
    schema.connected_accounts = schema.connected_accounts.filter(a => a.id !== id);
    delete fallbackOAuthTokens[id];
    fileDB.save();
  },

  // Token Security Management (Strictly Server-Side)
  async saveOAuthToken(token: OAuthToken): Promise<void> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { error } = await supabase
          .from('oauth_tokens')
          .upsert({
            id: token.id,
            connected_account_id: token.connected_account_id,
            platform: token.platform,
            access_token: token.access_token,
            refresh_token: token.refresh_token || '',
            expires_at: token.expires_at || '',
            created_at: token.created_at,
            updated_at: token.updated_at
          });
        if (!error) return;
        console.warn('[Supabase] saveOAuthToken failed:', error.message);
      } catch (err: any) {
        console.warn('[Supabase] saveOAuthToken exception:', err.message);
      }
    }
    fallbackOAuthTokens[token.connected_account_id] = token;
  },

  async getOAuthToken(accountId: string): Promise<OAuthToken | null> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('oauth_tokens')
          .select('*')
          .eq('connected_account_id', accountId)
          .maybeSingle();
        if (!error && data) {
          return data;
        }
      } catch (err: any) {
        console.warn('[Supabase] getOAuthToken exception:', err.message);
      }
    }
    return fallbackOAuthTokens[accountId] || null;
  },

  // Posts
  async getPosts(): Promise<Post[]> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('posts')
          .select('*')
          .order('created_at', { ascending: false });
        if (!error && data) return data;
      } catch (err: any) {
        console.warn('[Supabase] getPosts exception:', err.message);
      }
    }
    fileDB.init();
    return fileDB.getSchema().posts;
  },

  async savePost(post: Post): Promise<void> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { error } = await supabase
          .from('posts')
          .upsert({
            id: post.id,
            user_id: post.user_id,
            title: post.title,
            caption: post.caption,
            media_asset_ids: post.media_asset_ids,
            status: post.status,
            created_at: post.created_at,
            updated_at: post.updated_at
          });
        if (!error) return;
      } catch (err: any) {
        console.warn('[Supabase] savePost exception:', err.message);
      }
    }
    fileDB.init();
    const schema = fileDB.getSchema();
    const idx = schema.posts.findIndex(p => p.id === post.id);
    if (idx !== -1) {
      schema.posts[idx] = { ...post, updated_at: new Date().toISOString() };
    } else {
      schema.posts.push(post);
    }
    fileDB.save();
  },

  async removePost(id: string): Promise<void> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase.from('post_logs').delete().eq('post_id', id);
        await supabase.from('scheduled_posts').delete().eq('post_id', id);
        await supabase.from('post_targets').delete().eq('post_id', id);
        const { error } = await supabase.from('posts').delete().eq('id', id);
        if (!error) return;
      } catch (err: any) {
        console.warn('[Supabase] removePost exception:', err.message);
      }
    }
    fileDB.init();
    const schema = fileDB.getSchema();
    schema.posts = schema.posts.filter(p => p.id !== id);
    schema.post_targets = schema.post_targets.filter(t => t.post_id !== id);
    schema.scheduled_posts = schema.scheduled_posts.filter(s => s.post_id !== id);
    schema.post_logs = schema.post_logs.filter(l => l.post_id !== id);
    fileDB.save();
  },

  // Post Targets
  async getPostTargets(postId?: string): Promise<PostTarget[]> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        let query = supabase.from('post_targets').select('*');
        if (postId) {
          query = query.eq('post_id', postId);
        }
        const { data, error } = await query;
        if (!error && data) return data;
      } catch (err: any) {
        console.warn('[Supabase] getPostTargets exception:', err.message);
      }
    }
    fileDB.init();
    const schema = fileDB.getSchema();
    if (postId) {
      return schema.post_targets.filter(t => t.post_id === postId);
    }
    return schema.post_targets;
  },

  async savePostTarget(target: PostTarget): Promise<void> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { error } = await supabase
          .from('post_targets')
          .upsert({
            id: target.id,
            post_id: target.post_id,
            platform: target.platform,
            connected_account_id: target.connected_account_id,
            platform_post_id: target.platform_post_id,
            platform_post_url: target.platform_post_url,
            status: target.status,
            error_message: target.error_message,
            posted_at: target.posted_at
          });
        if (!error) return;
      } catch (err: any) {
        console.warn('[Supabase] savePostTarget exception:', err.message);
      }
    }
    fileDB.init();
    const schema = fileDB.getSchema();
    const idx = schema.post_targets.findIndex(t => t.id === target.id);
    if (idx !== -1) {
      schema.post_targets[idx] = target;
    } else {
      schema.post_targets.push(target);
    }
    fileDB.save();
  },

  // Scheduled Posts
  async getScheduledPosts(): Promise<ScheduledPost[]> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('scheduled_posts')
          .select('*')
          .order('scheduled_at', { ascending: true });
        if (!error && data) return data;
      } catch (err: any) {
        console.warn('[Supabase] getScheduledPosts exception:', err.message);
      }
    }
    fileDB.init();
    return fileDB.getSchema().scheduled_posts;
  },

  async saveScheduledPost(sched: ScheduledPost): Promise<void> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { error } = await supabase
          .from('scheduled_posts')
          .upsert({
            id: sched.id,
            post_id: sched.post_id,
            scheduled_at: sched.scheduled_at,
            timezone: sched.timezone,
            status: sched.status,
            created_at: sched.created_at,
            updated_at: sched.updated_at
          });
        if (!error) return;
      } catch (err: any) {
        console.warn('[Supabase] saveScheduledPost exception:', err.message);
      }
    }
    fileDB.init();
    const schema = fileDB.getSchema();
    const idx = schema.scheduled_posts.findIndex(s => s.id === sched.id);
    if (idx !== -1) {
      schema.scheduled_posts[idx] = { ...sched, updated_at: new Date().toISOString() };
    } else {
      schema.scheduled_posts.push(sched);
    }
    fileDB.save();
  },

  async removeScheduledPost(id: string): Promise<void> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { error } = await supabase.from('scheduled_posts').delete().eq('id', id);
        if (!error) return;
      } catch (err: any) {
        console.warn('[Supabase] removeScheduledPost exception:', err.message);
      }
    }
    fileDB.init();
    const schema = fileDB.getSchema();
    schema.scheduled_posts = schema.scheduled_posts.filter(s => s.id !== id);
    fileDB.save();
  },

  // Media Assets
  async getMediaAssets(): Promise<MediaAsset[]> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('media_assets')
          .select('*')
          .order('created_at', { ascending: false });
        if (!error && data) return data;
      } catch (err: any) {
        console.warn('[Supabase] getMediaAssets exception:', err.message);
      }
    }
    fileDB.init();
    return fileDB.getSchema().media_assets;
  },

  async saveMediaAsset(asset: MediaAsset): Promise<void> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { error } = await supabase
          .from('media_assets')
          .upsert({
            id: asset.id,
            user_id: asset.user_id,
            file_url: asset.file_url,
            file_type: asset.file_type,
            file_name: asset.file_name,
            file_size: asset.file_size,
            mime_type: asset.mime_type,
            created_at: asset.created_at
          });
        if (!error) return;
      } catch (err: any) {
        console.warn('[Supabase] saveMediaAsset exception:', err.message);
      }
    }
    fileDB.init();
    fileDB.getSchema().media_assets.push(asset);
    fileDB.save();
  },

  async removeMediaAsset(id: string): Promise<void> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { error } = await supabase.from('media_assets').delete().eq('id', id);
        if (!error) return;
      } catch (err: any) {
        console.warn('[Supabase] removeMediaAsset exception:', err.message);
      }
    }
    fileDB.init();
    const schema = fileDB.getSchema();
    schema.media_assets = schema.media_assets.filter(m => m.id !== id);
    fileDB.save();
  },

  // Post Logs
  async getLogs(postId?: string): Promise<PostLog[]> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        let query = supabase.from('post_logs').select('*').order('created_at', { ascending: false });
        if (postId) {
          query = query.eq('post_id', postId);
        }
        const { data, error } = await query;
        if (!error && data) return data;
      } catch (err: any) {
        console.warn('[Supabase] getLogs exception:', err.message);
      }
    }
    fileDB.init();
    const schema = fileDB.getSchema();
    if (postId) {
      return schema.post_logs.filter(l => l.post_id === postId);
    }
    return schema.post_logs;
  },

  async addLog(log: PostLog): Promise<void> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { error } = await supabase
          .from('post_logs')
          .insert({
            id: log.id,
            post_id: log.post_id,
            platform: log.platform,
            action: log.action,
            status: log.status,
            message: log.message,
            created_at: log.created_at
          });
        if (!error) return;
      } catch (err: any) {
        console.warn('[Supabase] addLog exception:', err.message);
      }
    }
    fileDB.init();
    fileDB.getSchema().post_logs.push(log);
    fileDB.save();
  }
};
