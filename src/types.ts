export interface User {
  id: string;
  username: string;
  email: string;
}

export interface ConnectedAccount {
  id: string;
  user_id: string;
  platform: string;
  platform_account_id: string;
  display_name: string;
  avatar_url: string;
  status: 'active' | 'expired' | 'needs_setup' | 'unavailable';
  access_token_reference: string;
  refresh_token_reference: string;
  token_expires_at: string;
  created_at: string;
  updated_at: string;
  posts_count?: number; // Calculated dynamically in the UI helper/backend
  last_post_date?: string; // Calculated dynamically
}

export interface Post {
  id: string;
  user_id: string;
  title: string;
  caption: string;
  media_asset_ids: string[];
  status: 'draft' | 'scheduled' | 'posted' | 'failed';
  created_at: string;
  updated_at: string;
}

export interface PostTarget {
  id: string;
  post_id: string;
  platform: string;
  connected_account_id: string;
  platform_post_id: string | null;
  platform_post_url: string | null;
  status: 'pending' | 'success' | 'failed'; // "posted" or "failed" or "pending"
  error_message: string | null;
  posted_at: string | null;
}

export interface ScheduledPost {
  id: string;
  post_id: string;
  scheduled_at: string;
  timezone: string;
  status: 'scheduled' | 'posting' | 'posted' | 'failed' | 'canceled';
  created_at: string;
  updated_at: string;
}

export interface MediaAsset {
  id: string;
  user_id: string;
  file_url: string; // Base64 or local server static path
  file_type: 'image' | 'video';
  file_name: string;
  file_size: number;
  mime_type: string;
  created_at: string;
}

export interface PostLog {
  id: string;
  post_id: string;
  platform: string;
  action: string;
  status: string;
  message: string;
  created_at: string;
}

export interface PlatformConfig {
  id: string;
  name: string;
  icon: string;
  supportedMedia: string[];
  scopes: string[];
  envVars: string[];
  isConfigured: boolean;
  setupNotes: string;
}
