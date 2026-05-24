import { PlatformConnector } from './types';

export const XConnector: PlatformConnector = {
  getOAuthUrl(redirectUri: string, state: string): string {
    const clientId = process.env.X_CLIENT_ID || '';
    if (!clientId) {
      throw new Error('X_CLIENT_ID environment variable is missing.');
    }
    const scopes = ['tweet.read', 'tweet.write', 'users.read', 'offline.access'];
    return `https://twitter.com/i/oauth2/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes.join(' '))}&state=${state}&code_challenge=challenge&code_challenge_method=plain`;
  },

  async handleOAuthCallback(code: string, redirectUri: string) {
    const clientId = process.env.X_CLIENT_ID;
    const clientSecret = process.env.X_CLIENT_SECRET;
    
    if (!clientId) {
      throw new Error('X Client ID is not configured.');
    }

    const tokenUrl = 'https://api.twitter.com/2/oauth2/token';
    const body = new URLSearchParams({
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
      code_verifier: 'challenge',
      client_id: clientId
    });

    const headers: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded'
    };

    if (clientSecret) {
      const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
      headers['Authorization'] = `Basic ${credentials}`;
    }

    const res = await fetch(tokenUrl, {
      method: 'POST',
      headers,
      body: body.toString()
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`X OAuth exchange failed: ${err.error_description || res.statusText}`);
    }

    const data = await res.json() as { access_token: string; refresh_token?: string; expires_in?: number };

    // Fetch user profile
    const profileRes = await fetch('https://api.twitter.com/2/users/me?user.fields=profile_image_url', {
      headers: { 'Authorization': `Bearer ${data.access_token}` }
    });

    let display_name = 'X Creator';
    let avatar_url = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80';
    let platform_account_id = 'x_user';

    if (profileRes.ok) {
      const profileData = await profileRes.json() as { data?: { id: string; name: string; username: string; profile_image_url?: string } };
      if (profileData.data) {
        platform_account_id = profileData.data.id;
        display_name = `@${profileData.data.username}`;
        avatar_url = profileData.data.profile_image_url || avatar_url;
      }
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
    const clientId = process.env.X_CLIENT_ID || '';
    const clientSecret = process.env.X_CLIENT_SECRET || '';
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshTokenVal,
      client_id: clientId
    });
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded'
    };

    if (clientSecret) {
      const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
      headers['Authorization'] = `Basic ${credentials}`;
    }

    const res = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers,
      body: body.toString()
    });

    if (!res.ok) throw new Error('X refresh token exchange failed.');
    const data = await res.json() as { access_token: string; refresh_token?: string; expires_in?: number };
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in
    };
  },

  async validateConnection(accessToken: string): Promise<boolean> {
    const res = await fetch('https://api.twitter.com/2/users/me', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    return res.ok;
  },

  async publishPost(accessToken: string, caption: string, mediaUrls: string[]) {
    const res = await fetch('https://api.twitter.com/2/tweets', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: caption
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to submit tweet to X API.');
    }

    const data = await res.json() as { data: { id: string; text: string } };

    return {
      platform_post_id: data.data.id,
      platform_post_url: `https://x.com/user/status/${data.data.id}`
    };
  },

  async publishMedia(accessToken: string, fileUrl: string, mediaType: 'image' | 'video', title?: string, caption?: string) {
    return this.publishPost(accessToken, caption || title || '', [fileUrl]);
  }
};
