import { PlatformConnector } from './types';

export const InstagramConnector: PlatformConnector = {
  getOAuthUrl(redirectUri: string, state: string): string {
    const clientId = process.env.INSTAGRAM_CLIENT_ID || '';
    if (!clientId) {
      throw new Error('INSTAGRAM_CLIENT_ID environment variable is missing.');
    }
    const scopes = ['instagram_basic', 'instagram_content_publish', 'pages_show_list', 'public_profile'];
    return `https://www.facebook.com/v19.0/dialog/oauth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&scope=${encodeURIComponent(scopes.join(','))}`;
  },

  async handleOAuthCallback(code: string, redirectUri: string) {
    const clientId = process.env.INSTAGRAM_CLIENT_ID;
    const clientSecret = process.env.INSTAGRAM_CLIENT_SECRET;
    
    if (!clientId || !clientSecret) {
      throw new Error('Instagram Client ID or Client Secret is not configured in settings.');
    }

    const tokenUrl = `https://graph.facebook.com/v19.0/oauth/access_token?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${clientSecret}&code=${code}`;
    const tokenRes = await fetch(tokenUrl);
    
    if (!tokenRes.ok) {
      throw new Error('Instagram token exchange failed.');
    }
    const tokenData = await tokenRes.json() as { access_token: string; expires_in?: number };
    
    const accountsUrl = `https://graph.facebook.com/v19.0/me/accounts?fields=instagram_business_account{id,name,username,profile_picture_url}&access_token=${tokenData.access_token}`;
    const accountsRes = await fetch(accountsUrl);
    if (!accountsRes.ok) {
      throw new Error('Failed to retrieve linked Facebook pages/Instagram business accounts.');
    }
    const accountsData = await accountsRes.json() as { data?: Array<{ instagram_business_account?: { id: string; name: string; username: string; profile_picture_url?: string } }> };
    
    const linkedIg = accountsData.data?.find(a => a.instagram_business_account)?.instagram_business_account;
    if (!linkedIg) {
      throw new Error('No Instagram Professional Account found linked to your Facebook Pages.');
    }

    return {
      access_token: tokenData.access_token,
      expires_in: tokenData.expires_in,
      platform_account_id: linkedIg.id,
      display_name: linkedIg.name || `@${linkedIg.username}`,
      avatar_url: linkedIg.profile_picture_url || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=150&q=80'
    };
  },

  async refreshToken(refreshTokenVal: string) {
    return { access_token: refreshTokenVal, expires_in: 5184000 };
  },

  async validateConnection(accessToken: string): Promise<boolean> {
    try {
      const res = await fetch(`https://graph.facebook.com/v19.0/me?access_token=${accessToken}`);
      return res.ok;
    } catch {
      return false;
    }
  },

  async publishPost(accessToken: string, caption: string, mediaUrls: string[]) {
    if (!mediaUrls || mediaUrls.length === 0) {
      throw new Error('Instagram requires at least one image or video URL.');
    }
    
    const accountsRes = await fetch(`https://graph.facebook.com/v19.0/me/accounts?fields=instagram_business_account&access_token=${accessToken}`);
    const accounts = await accountsRes.json() as { data?: Array<{ instagram_business_account?: { id: string } }> };
    const igId = accounts.data?.find(a => a.instagram_business_account)?.instagram_business_account?.id;
    
    if (!igId) {
      throw new Error('Could not resolve linked Instagram Account ID.');
    }

    const isVideo = mediaUrls[0].endsWith('.mp4') || mediaUrls[0].includes('video');
    const containerUrl = `https://graph.facebook.com/v19.0/${igId}/media?access_token=${accessToken}`;
    
    const containerBody: Record<string, string> = {
      image_url: mediaUrls[0],
      caption: caption
    };
    
    if (isVideo) {
      containerBody.media_type = 'VIDEO';
      containerBody.video_url = mediaUrls[0];
      delete containerBody.image_url;
    }

    const containerRes = await fetch(containerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(containerBody)
    });
    
    if (!containerRes.ok) {
      const err = await containerRes.json().catch(() => ({}));
      throw new Error(err.error?.message || 'Instagram media container creation failed.');
    }
    
    const containerData = await containerRes.json() as { id: string };
    const containerId = containerData.id;

    if (isVideo) {
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }

    const publishRes = await fetch(`https://graph.facebook.com/v19.0/${igId}/media_publish?creation_id=${containerId}&access_token=${accessToken}`, {
      method: 'POST'
    });
    
    if (!publishRes.ok) {
      const err = await publishRes.json().catch(() => ({}));
      throw new Error(err.error?.message || 'Instagram media publication failed.');
    }
    
    const publishData = await publishRes.json() as { id: string };
    
    return {
      platform_post_id: publishData.id,
      platform_post_url: `https://instagram.com/p/${publishData.id}`
    };
  },

  async publishMedia(accessToken: string, fileUrl: string, mediaType: 'image' | 'video', title?: string, caption?: string) {
    return this.publishPost(accessToken, caption || title || '', [fileUrl]);
  }
};
