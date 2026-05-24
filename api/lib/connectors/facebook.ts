import { PlatformConnector } from './types';

export const FacebookConnector: PlatformConnector = {
  getOAuthUrl(redirectUri: string, state: string): string {
    const clientId = process.env.FACEBOOK_CLIENT_ID || '';
    if (!clientId) {
      throw new Error('FACEBOOK_CLIENT_ID environment variable is missing.');
    }
    const scopes = ['pages_show_list', 'pages_read_engagement', 'pages_manage_posts', 'public_profile'];
    return `https://www.facebook.com/v19.0/dialog/oauth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&scope=${encodeURIComponent(scopes.join(','))}`;
  },

  async handleOAuthCallback(code: string, redirectUri: string) {
    const clientId = process.env.FACEBOOK_CLIENT_ID;
    const clientSecret = process.env.FACEBOOK_CLIENT_SECRET;
    
    if (!clientId || !clientSecret) {
      throw new Error('Facebook Client ID or Client Secret is not configured in settings.');
    }

    const tokenUrl = `https://graph.facebook.com/v19.0/oauth/access_token?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${clientSecret}&code=${code}`;
    const tokenRes = await fetch(tokenUrl);
    
    if (!tokenRes.ok) {
      const errData = await tokenRes.json().catch(() => ({}));
      throw new Error(`Facebook OAuth token exchange failed: ${errData.error?.message || tokenRes.statusText}`);
    }
    
    const tokenData = await tokenRes.json() as { access_token: string; expires_in?: number };
    
    const profileUrl = `https://graph.facebook.com/me?fields=id,name,picture&access_token=${tokenData.access_token}`;
    const profileRes = await fetch(profileUrl);
    if (!profileRes.ok) {
      throw new Error('Failed to fetch Facebook account profile during callback.');
    }
    const profileData = await profileRes.json() as { id: string; name: string; picture?: { data?: { url?: string } } };

    return {
      access_token: tokenData.access_token,
      expires_in: tokenData.expires_in,
      platform_account_id: profileData.id,
      display_name: profileData.name,
      avatar_url: profileData.picture?.data?.url || 'https://images.unsplash.com/photo-1511367461989-f85a21fda167'
    };
  },

  async refreshToken(refreshTokenVal: string) {
    return {
      access_token: refreshTokenVal,
      expires_in: 5184000 // 60 days
    };
  },

  async validateConnection(accessToken: string): Promise<boolean> {
    try {
      const checkUrl = `https://graph.facebook.com/me?fields=id&access_token=${accessToken}`;
      const res = await fetch(checkUrl);
      return res.ok;
    } catch {
      return false;
    }
  },

  async publishPost(accessToken: string, caption: string, mediaUrls: string[]) {
    const pagesUrl = `https://graph.facebook.com/me/accounts?access_token=${accessToken}`;
    const pagesRes = await fetch(pagesUrl);
    if (!pagesRes.ok) {
      throw new Error('Failed to fetch Facebook Pages accessible by this token.');
    }
    const pagesData = await pagesRes.json() as { data?: Array<{ id: string; name: string; access_token: string }> };
    if (!pagesData.data || pagesData.data.length === 0) {
      throw new Error('No Facebook Pages found associated with this account token.');
    }
    
    const pageToken = pagesData.data[0].access_token;
    const pageId = pagesData.data[0].id;

    let pPostId = '';
    
    if (mediaUrls && mediaUrls.length > 0) {
      const publishUrl = `https://graph.facebook.com/v19.0/${pageId}/photos?access_token=${pageToken}`;
      const res = await fetch(publishUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: mediaUrls[0],
          caption: caption
        })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || 'Failed to publish photo post to Facebook Page.');
      }
      const data = await res.json() as { id: string; post_id?: string };
      pPostId = data.post_id || data.id;
    } else {
      const publishUrl = `https://graph.facebook.com/v19.0/${pageId}/feed?access_token=${pageToken}`;
      const res = await fetch(publishUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: caption })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || 'Failed to publish feed text post to Facebook Page.');
      }
      const data = await res.json() as { id: string };
      pPostId = data.id;
    }

    return {
      platform_post_id: pPostId,
      platform_post_url: `https://facebook.com/${pPostId}`
    };
  },

  async publishMedia(accessToken: string, fileUrl: string, mediaType: 'image' | 'video', title?: string, caption?: string) {
    return this.publishPost(accessToken, caption || title || '', [fileUrl]);
  }
};
