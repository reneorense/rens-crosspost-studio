import { supabaseAdmin } from './supabaseAdmin';
import { 
  ConnectedAccount, 
  Post, 
  PostTarget, 
  ScheduledPost, 
  MediaAsset, 
  PostLog 
} from '../../src/types';

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

// Memory Database for local fallback and offline preview mode
let memoAccounts: ConnectedAccount[] = [
  {
    id: 'demo_fb_1',
    user_id: 'u1',
    platform: 'facebook',
    platform_account_id: 'fb_123',
    display_name: 'Studio Tech Page (Demo)',
    avatar_url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150',
    status: 'active',
    access_token_reference: '',
    refresh_token_reference: '',
    token_expires_at: '',
    posts_count: 14,
    last_post_date: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
    created_at: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString()
  },
  {
    id: 'demo_ig_1',
    user_id: 'u1',
    platform: 'instagram',
    platform_account_id: 'ig_123',
    display_name: 'Aesthetic Design (Demo)',
    avatar_url: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=150',
    status: 'active',
    access_token_reference: '',
    refresh_token_reference: '',
    token_expires_at: '',
    posts_count: 28,
    last_post_date: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString(),
    created_at: new Date(Date.now() - 45 * 24 * 3600 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString()
  },
  {
    id: 'demo_x_1',
    user_id: 'u1',
    platform: 'x',
    platform_account_id: 'x_123',
    display_name: 'UI/UX CrossPost (Demo)',
    avatar_url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150',
    status: 'active',
    access_token_reference: '',
    refresh_token_reference: '',
    token_expires_at: '',
    posts_count: 5,
    last_post_date: new Date(Date.now() - 4 * 24 * 3600 * 1000).toISOString(),
    created_at: new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 4 * 24 * 3600 * 1000).toISOString()
  },
  {
    id: 'demo_yt_1',
    user_id: 'u1',
    platform: 'youtube',
    platform_account_id: 'yt_123',
    display_name: 'Indie Studio (Demo)',
    avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    status: 'expired',
    access_token_reference: '',
    refresh_token_reference: '',
    token_expires_at: '',
    posts_count: 2,
    last_post_date: new Date(Date.now() - 12 * 24 * 3600 * 1000).toISOString(),
    created_at: new Date(Date.now() - 20 * 24 * 3600 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 12 * 24 * 365 * 1000).toISOString()
  }
];

let memoPosts: Post[] = [
  {
    id: 'demo_post_1',
    user_id: 'u1',
    title: 'Aesthetic Interface Reveal',
    caption: 'Behold the newly crafted responsive dashboard layout for REN\'s CrossPost Studio! Directly deploy and synchronize content schedules cross-network. #BuildInPublic 🚀',
    media_asset_ids: ['demo_media_1'],
    status: 'posted',
    created_at: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString()
  },
  {
    id: 'demo_post_2',
    user_id: 'u1',
    title: 'Short Cinematic Mood Teaser',
    caption: 'Working on cinematic color grading assets for our YouTube channels. Super excited for this release next month.',
    media_asset_ids: ['demo_media_2'],
    status: 'failed',
    created_at: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString()
  }
];

let memoPostTargets: PostTarget[] = [
  {
    id: 'demo_tgt_1_fb',
    post_id: 'demo_post_1',
    platform: 'facebook',
    connected_account_id: 'demo_fb_1',
    platform_post_id: 'fb_post_99182',
    platform_post_url: 'https://facebook.com',
    status: 'success',
    error_message: null,
    posted_at: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString()
  },
  {
    id: 'demo_tgt_1_ig',
    post_id: 'demo_post_1',
    platform: 'instagram',
    connected_account_id: 'demo_ig_1',
    platform_post_id: 'ig_post_88319',
    platform_post_url: 'https://instagram.com',
    status: 'success',
    error_message: null,
    posted_at: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString()
  },
  {
    id: 'demo_tgt_2_fb',
    post_id: 'demo_post_2',
    platform: 'facebook',
    connected_account_id: 'demo_fb_1',
    platform_post_id: null,
    platform_post_url: null,
    status: 'failed',
    error_message: 'OAuth refresh validation failed. Please reconnect the Facebook Channel integration in setting tab.',
    posted_at: null
  }
];

let memoScheduledPosts: ScheduledPost[] = [
  {
    id: 'demo_sched_1',
    post_id: 'demo_post_3',
    scheduled_at: new Date(Date.now() + 5 * 24 * 3600 * 1000).toISOString().split('T')[0] + 'T10:00:00.000Z',
    timezone: 'UTC',
    status: 'scheduled',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];

// Re-generate scheduled container post to keep it logical
let memoScheduledPostObjects: Post[] = [
  {
    id: 'demo_post_3',
    user_id: 'u1',
    title: 'Sunday Morning Newsletter Snippet',
    caption: 'Sharing some wisdom from our latest blog entry on automated marketing and multi-channel operations. Subscriptions are open! 💌',
    media_asset_ids: [],
    status: 'scheduled',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];

let memoMediaAssets: MediaAsset[] = [
  {
    id: 'demo_media_1',
    user_id: 'u1',
    file_url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600',
    file_type: 'image',
    file_name: 'interface_mockup_design.png',
    file_size: 1024 * 120,
    mime_type: 'image/png',
    created_at: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString()
  },
  {
    id: 'demo_media_2',
    user_id: 'u1',
    file_url: 'https://assets.mixkit.co/videos/preview/mixkit-cinematic-mountain-landscape-under-dark-clouds-42220-large.mp4',
    file_type: 'video',
    file_name: 'mountain_teaser_reel.mp4',
    file_size: 1024 * 1024 * 8.5,
    mime_type: 'video/mp4',
    created_at: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString()
  }
];

let memoPostLogs: PostLog[] = [
  {
    id: 'demo_log_1',
    post_id: 'demo_post_1',
    platform: 'facebook',
    action: 'publish_post',
    status: 'success',
    message: 'Post successfully published to Facebook Page "Studio Tech Page (Demo)"! Post ID: fb_post_99182',
    created_at: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString()
  },
  {
    id: 'demo_log_2',
    post_id: 'demo_post_1',
    platform: 'instagram',
    action: 'publish_post',
    status: 'success',
    message: 'Post successfully published to Instagram Creator "Aesthetic Design (Demo)"! Post ID: ig_post_88319',
    created_at: new Date(Date.now() - 1 * 24 * 3600 * 1000 + 100).toISOString()
  },
  {
    id: 'demo_log_3',
    post_id: 'demo_post_2',
    platform: 'facebook',
    action: 'publish_post',
    status: 'failed',
    message: 'Failed to publish to Facebook: OAuth token has expired and could not be requested silently.',
    created_at: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString()
  },
  {
    id: 'demo_log_4',
    post_id: '',
    platform: 'all',
    action: 'system_init',
    status: 'success',
    message: 'REN\'s CrossPost Studio backend successfully initialized. Hybrid database fallback loaded beautifully.',
    created_at: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString()
  }
];

let memoTokens: Record<string, OAuthToken> = {
  'demo_fb_1': {
    id: 'tok_fb_1',
    connected_account_id: 'demo_fb_1',
    platform: 'facebook',
    access_token: 'mock_fb_access_token',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  'demo_ig_1': {
    id: 'tok_ig_1',
    connected_account_id: 'demo_ig_1',
    platform: 'instagram',
    access_token: 'mock_ig_access_token',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  'demo_x_1': {
    id: 'tok_x_1',
    connected_account_id: 'demo_x_1',
    platform: 'x',
    access_token: 'mock_x_access_token',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
};

export const db = {
  // Connected Accounts
  async getAccounts(): Promise<ConnectedAccount[]> {
    if (supabaseAdmin) {
      const { data, error } = await supabaseAdmin
        .from('connected_accounts')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (!error && data) {
        return data;
      }
      console.warn('[DB] getAccounts failed or table missing, using fallbacks:', error?.message);
    }
    return memoAccounts;
  },

  async getAccountById(id: string): Promise<ConnectedAccount | null> {
    if (supabaseAdmin) {
      const { data, error } = await supabaseAdmin
        .from('connected_accounts')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (!error) {
        return data;
      }
    }
    return memoAccounts.find(acc => acc.id === id) || null;
  },

  async saveAccount(account: ConnectedAccount): Promise<void> {
    if (supabaseAdmin) {
      const { error } = await supabaseAdmin
        .from('connected_accounts')
        .upsert({
          id: account.id,
          user_id: account.user_id || 'u1',
          platform: account.platform,
          platform_account_id: account.platform_account_id,
          display_name: account.display_name,
          avatar_url: account.avatar_url,
          status: account.status,
          posts_count: account.posts_count || 0,
          last_post_date: account.last_post_date || '',
          created_at: account.created_at || new Date().toISOString(),
          updated_at: account.updated_at || new Date().toISOString()
        });

      if (!error) return;
      console.error('[DB] saveAccount failed:', error.message);
    }

    const idx = memoAccounts.findIndex(a => a.id === account.id);
    if (idx !== -1) {
      memoAccounts[idx] = { ...account, updated_at: new Date().toISOString() };
    } else {
      memoAccounts.push(account);
    }
  },

  async removeAccount(id: string): Promise<void> {
    if (supabaseAdmin) {
      await supabaseAdmin.from('oauth_tokens').delete().eq('connected_account_id', id);
      const { error } = await supabaseAdmin.from('connected_accounts').delete().eq('id', id);
      if (!error) return;
      console.error('[DB] removeAccount failed:', error.message);
    }

    memoAccounts = memoAccounts.filter(a => a.id !== id);
    delete memoTokens[id];
  },

  // OAuth Tokens
  async saveOAuthToken(token: OAuthToken): Promise<void> {
    if (supabaseAdmin) {
      const { error } = await supabaseAdmin
        .from('oauth_tokens')
        .upsert({
          id: token.id,
          connected_account_id: token.connected_account_id,
          platform: token.platform,
          access_token: token.access_token,
          refresh_token: token.refresh_token || '',
          expires_at: token.expires_at || '',
          created_at: token.created_at || new Date().toISOString(),
          updated_at: token.updated_at || new Date().toISOString()
        });

      if (!error) return;
      console.error('[DB] saveOAuthToken failed:', error.message);
    }

    memoTokens[token.connected_account_id] = token;
  },

  async getOAuthToken(accountId: string): Promise<OAuthToken | null> {
    if (supabaseAdmin) {
      const { data, error } = await supabaseAdmin
        .from('oauth_tokens')
        .select('*')
        .eq('connected_account_id', accountId)
        .maybeSingle();

      if (!error) {
        return data;
      }
    }
    return memoTokens[accountId] || null;
  },

  // Posts
  async getPosts(): Promise<Post[]> {
    if (supabaseAdmin) {
      const { data, error } = await supabaseAdmin
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        return data;
      }
      console.warn('[DB] getPosts failed, returning memory list:', error?.message);
    }

    // Blend standard list with mapped scheduled objects
    return [...memoPosts, ...memoScheduledPostObjects].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  },

  async savePost(post: Post): Promise<void> {
    if (supabaseAdmin) {
      try {
        const { error } = await supabaseAdmin
          .from('posts')
          .upsert({
            id: post.id,
            user_id: post.user_id || 'u1',
            title: post.title,
            caption: post.caption,
            media_asset_ids: post.media_asset_ids || [],
            status: post.status,
            created_at: post.created_at || new Date().toISOString(),
            updated_at: post.updated_at || new Date().toISOString()
          });

        if (!error) return;
        console.error('[DB] savePost failed:', error.message);
      } catch (err) {
        console.error('[DB] savePost error:', err);
      }
    }

    if (post.status === 'scheduled') {
      const idx = memoScheduledPostObjects.findIndex(p => p.id === post.id);
      if (idx !== -1) {
        memoScheduledPostObjects[idx] = post;
      } else {
        memoScheduledPostObjects.push(post);
      }
    } else {
      const idx = memoPosts.findIndex(p => p.id === post.id);
      if (idx !== -1) {
        memoPosts[idx] = post;
      } else {
        memoPosts.push(post);
      }
    }
  },

  async removePost(id: string): Promise<void> {
    if (supabaseAdmin) {
      await supabaseAdmin.from('post_logs').delete().eq('post_id', id);
      await supabaseAdmin.from('scheduled_posts').delete().eq('post_id', id);
      await supabaseAdmin.from('post_targets').delete().eq('post_id', id);
      const { error } = await supabaseAdmin.from('posts').delete().eq('id', id);
      if (!error) return;
      console.error('[DB] removePost failed:', error.message);
    }

    memoPosts = memoPosts.filter(p => p.id !== id);
    memoScheduledPostObjects = memoScheduledPostObjects.filter(p => p.id !== id);
    memoPostTargets = memoPostTargets.filter(t => t.post_id !== id);
    memoScheduledPosts = memoScheduledPosts.filter(s => s.post_id !== id);
    memoPostLogs = memoPostLogs.filter(l => l.post_id !== id);
  },

  // Post Targets
  async getPostTargets(postId?: string): Promise<PostTarget[]> {
    if (supabaseAdmin) {
      let query = supabaseAdmin.from('post_targets').select('*');
      if (postId) {
        query = query.eq('post_id', postId);
      }
      const { data, error } = await query;
      if (!error && data) {
        return data;
      }
    }

    if (postId) {
      return memoPostTargets.filter(t => t.post_id === postId);
    }
    return memoPostTargets;
  },

  async savePostTarget(target: PostTarget): Promise<void> {
    if (supabaseAdmin) {
      const { error } = await supabaseAdmin
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
      console.error('[DB] savePostTarget failed:', error.message);
    }

    const idx = memoPostTargets.findIndex(t => t.id === target.id);
    if (idx !== -1) {
      memoPostTargets[idx] = target;
    } else {
      memoPostTargets.push(target);
    }
  },

  // Scheduled Posts
  async getScheduledPosts(): Promise<ScheduledPost[]> {
    if (supabaseAdmin) {
      const { data, error } = await supabaseAdmin
        .from('scheduled_posts')
        .select('*')
        .order('scheduled_at', { ascending: true });

      if (!error && data) {
        return data;
      }
    }
    return memoScheduledPosts;
  },

  async saveScheduledPost(sched: ScheduledPost): Promise<void> {
    if (supabaseAdmin) {
      const { error } = await supabaseAdmin
        .from('scheduled_posts')
        .upsert({
          id: sched.id,
          post_id: sched.post_id,
          scheduled_at: sched.scheduled_at,
          timezone: sched.timezone,
          status: sched.status,
          created_at: sched.created_at || new Date().toISOString(),
          updated_at: sched.updated_at || new Date().toISOString()
        });

      if (!error) return;
      console.error('[DB] saveScheduledPost failed:', error.message);
    }

    const idx = memoScheduledPosts.findIndex(s => s.id === sched.id);
    if (idx !== -1) {
      memoScheduledPosts[idx] = { ...sched, updated_at: new Date().toISOString() };
    } else {
      memoScheduledPosts.push(sched);
    }
  },

  async removeScheduledPost(id: string): Promise<void> {
    if (supabaseAdmin) {
      const { error } = await supabaseAdmin.from('scheduled_posts').delete().eq('id', id);
      if (!error) return;
      console.error('[DB] removeScheduledPost failed:', error.message);
    }

    memoScheduledPosts = memoScheduledPosts.filter(s => s.id !== id);
  },

  // Media Assets
  async getMediaAssets(): Promise<MediaAsset[]> {
    if (supabaseAdmin) {
      const { data, error } = await supabaseAdmin
        .from('media_assets')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        return data;
      }
    }
    return memoMediaAssets;
  },

  async saveMediaAsset(asset: MediaAsset): Promise<void> {
    if (supabaseAdmin) {
      const { error } = await supabaseAdmin
        .from('media_assets')
        .upsert({
          id: asset.id,
          user_id: asset.user_id || 'u1',
          file_url: asset.file_url,
          file_type: asset.file_type,
          file_name: asset.file_name,
          file_size: asset.file_size,
          mime_type: asset.mime_type,
          created_at: asset.created_at || new Date().toISOString()
        });

      if (!error) return;
      console.error('[DB] saveMediaAsset failed:', error.message);
    }

    memoMediaAssets.push(asset);
  },

  async removeMediaAsset(id: string): Promise<void> {
    if (supabaseAdmin) {
      const { error } = await supabaseAdmin.from('media_assets').delete().eq('id', id);
      if (!error) return;
      console.error('[DB] removeMediaAsset failed:', error.message);
    }

    memoMediaAssets = memoMediaAssets.filter(m => m.id !== id);
  },

  // Post Logs
  async getLogs(postId?: string): Promise<PostLog[]> {
    if (supabaseAdmin) {
      let query = supabaseAdmin.from('post_logs').select('*').order('created_at', { ascending: false });
      if (postId) {
        query = query.eq('post_id', postId);
      }
      const { data, error } = await query;
      if (!error && data) {
        return data;
      }
    }

    if (postId) {
      return memoPostLogs.filter(l => l.post_id === postId);
    }
    return memoPostLogs;
  },

  async addLog(log: PostLog): Promise<void> {
    if (supabaseAdmin) {
      const { error } = await supabaseAdmin
        .from('post_logs')
        .insert({
          id: log.id,
          post_id: log.post_id || null,
          platform: log.platform,
          action: log.action,
          status: log.status,
          message: log.message,
          created_at: log.created_at || new Date().toISOString()
        });

      if (!error) return;
      console.error('[DB] addLog failed:', error.message);
    }

    memoPostLogs.unshift(log); // Prepend to show most recent log first in UI output stream
  }
};
