import { PlatformConnector } from './types';

export const PinterestConnector: PlatformConnector = {
  getOAuthUrl(redirectUri: string, state: string): string {
    const clientId = process.env.PINTEREST_CLIENT_ID || '';
    if (!clientId) {
      throw new Error('PINTEREST_CLIENT_ID environment variable is missing.');
    }
    const scopes = ['boards:read', 'pins:read', 'pins:write'];
    return `https://www.pinterest.com/oauth/?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scopes.join(','))}&state=${state}`;
  },

  async handleOAuthCallback(code: string, redirectUri: string) {
    const clientId = process.env.PINTEREST_CLIENT_ID;
    const clientSecret = process.env.PINTEREST_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error('Pinterest client credentials are not configured.');
    }

    const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri
    });

    const res = await fetch('https://api.pinterest.com/v5/oauth/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authHeader}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: body.toString()
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Pinterest token exchange failed: ${err.message || res.statusText}`);
    }

    const data = await res.json() as { access_token: string; refresh_token?: string; expires_in?: number };

    const profileRes = await fetch('https://api.pinterest.com/v5/user_account', {
      headers: { 'Authorization': `Bearer ${data.access_token}` }
    });

    let display_name = 'Pinterest Creator';
    let platform_account_id = 'pinterest_user';
    let avatar_url = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=150&q=80';

    if (profileRes.ok) {
      const profileData = await profileRes.json() as { username?: string; profile_image?: string };
      display_name = profileData.username ? `@${profileData.username}` : display_name;
      platform_account_id = profileData.username || platform_account_id;
      avatar_url = profileData.profile_image || avatar_url;
    }

    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in,
      platform_account_id,
      display_name,
      avatar_url
    };
  },

  async refreshToken(refreshTokenVal: string) {
    const clientId = process.env.PINTEREST_CLIENT_ID || '';
    const clientSecret = process.env.PINTEREST_CLIENT_SECRET || '';
    const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshTokenVal
    });

    const res = await fetch('https://api.pinterest.com/v5/oauth/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authHeader}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: body.toString()
    });

    if (!res.ok) throw new Error('Pinterest token refresh failed.');
    const data = await res.json() as { access_token: string; refresh_token?: string; expires_in?: number };
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in
    };
  },

  async validateConnection(accessToken: string): Promise<boolean> {
    const res = await fetch('https://api.pinterest.com/v5/user_account', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    return res.ok;
  },

  async publishPost(accessToken: string, caption: string, mediaUrls: string[]) {
    if (!mediaUrls || mediaUrls.length === 0) {
      throw new Error('Pinterest requires an image or video URL to create a Pin.');
    }
    
    const boardsRes = await fetch('https://api.pinterest.com/v5/boards', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    let boardId = '';
    if (boardsRes.ok) {
      const boardsData = await boardsRes.json() as { items?: Array<{ id: string }> };
      if (boardsData.items && boardsData.items.length > 0) {
        boardId = boardsData.items[0].id;
      }
    }

    if (!boardId) {
      const createBoardRes = await fetch('https://api.pinterest.com/v5/boards', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: 'My CrossPosts',
          privacy: 'PUBLIC'
        })
      });
      if (!createBoardRes.ok) {
        throw new Error('Pinterest requires an existing Board. Failed to build default board.');
      }
      const boardData = await createBoardRes.json() as { id: string };
      boardId = boardData.id;
    }

    const pinRes = await fetch('https://api.pinterest.com/v5/pins', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        link: 'https://crosspost.studio',
        title: caption.substring(0, 100),
        description: caption,
        board_id: boardId,
        media_source: {
          source_type: 'image_url',
          url: mediaUrls[0]
        }
      })
    });

    if (!pinRes.ok) {
      const err = await pinRes.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to publish Pin to Pinterest.');
    }

    const pinData = await pinRes.json() as { id: string };

    return {
      platform_post_id: pinData.id,
      platform_post_url: `https://www.pinterest.com/pin/${pinData.id}`
    };
  },

  async publishMedia(accessToken: string, fileUrl: string, mediaType: 'image' | 'video', title?: string, caption?: string) {
    return this.publishPost(accessToken, caption || title || '', [fileUrl]);
  }
};
