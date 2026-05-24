export interface PlatformConnector {
  getOAuthUrl(redirectUri: string, state: string): string;
  handleOAuthCallback(
    code: string, 
    redirectUri: string
  ): Promise<{ 
    access_token: string; 
    refresh_token?: string; 
    expires_in?: number; 
    platform_account_id: string; 
    display_name: string; 
    avatar_url: string; 
  }>;
  refreshToken(refreshTokenVal: string): Promise<{ 
    access_token: string; 
    refresh_token?: string; 
    expires_in?: number; 
  }>;
  validateConnection(accessToken: string): Promise<boolean>;
  publishPost(
    accessToken: string, 
    caption: string, 
    mediaUrls: string[]
  ): Promise<{ 
    platform_post_id: string; 
    platform_post_url: string; 
  }>;
  publishMedia(
    accessToken: string, 
    fileUrl: string, 
    mediaType: 'image' | 'video', 
    title?: string, 
    caption?: string
  ): Promise<{ 
    platform_post_id: string; 
    platform_post_url: string; 
  }>;
  getPostStats?(
    accessToken: string, 
    platformPostId: string
  ): Promise<{ 
    impressions: number; 
    engagement: number; 
    likes?: number; 
    shares?: number; 
    comments?: number; 
  }>;
}
