import { PlatformConnector } from './types';

export const LinkedInConnector: PlatformConnector = {
  getOAuthUrl(redirectUri: string, state: string): string {
    const clientId = process.env.LINKEDIN_CLIENT_ID || '';
    if (!clientId) {
      throw new Error('LINKEDIN_CLIENT_ID environment variable is missing.');
    }
    const scopes = ['w_member_social', 'r_liteprofile'];
    return `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&scope=${encodeURIComponent(scopes.join(' '))}`;
  },

  async handleOAuthCallback(code: string, redirectUri: string) {
    const clientId = process.env.LINKEDIN_CLIENT_ID;
    const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
    
    if (!clientId || !clientSecret) {
      throw new Error('LinkedIn client credentials are not configured.');
    }

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret
    });

    const res = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString()
    });

    if (!res.ok) {
      throw new Error('LinkedIn access token exchange failed.');
    }

    const data = await res.json() as { access_token: string; expires_in?: number; refresh_token?: string };

    const profileRes = await fetch('https://api.linkedin.com/v2/me', {
      headers: { 'Authorization': `Bearer ${data.access_token}` }
    });

    let display_name = 'LinkedIn Member';
    let platform_account_id = 'li_member';
    let avatar_url = 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=150&q=80';

    if (profileRes.ok) {
      const profileData = await profileRes.json() as { id: string; localizedFirstName?: string; localizedLastName?: string };
      display_name = `${profileData.localizedFirstName || ''} ${profileData.localizedLastName || ''}`.trim() || display_name;
      platform_account_id = profileData.id;
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
    const clientId = process.env.LINKEDIN_CLIENT_ID || '';
    const clientSecret = process.env.LINKEDIN_CLIENT_SECRET || '';
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshTokenVal,
      client_id: clientId,
      client_secret: clientSecret
    });

    const res = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString()
    });

    if (!res.ok) throw new Error('LinkedIn token refresh failed.');
    const data = await res.json() as { access_token: string; refresh_token?: string; expires_in?: number };
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in
    };
  },

  async validateConnection(accessToken: string): Promise<boolean> {
    const res = await fetch('https://api.linkedin.com/v2/me', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    return res.ok;
  },

  async publishPost(accessToken: string, caption: string, mediaUrls: string[]) {
    const meRes = await fetch('https://api.linkedin.com/v2/me', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    if (!meRes.ok) throw new Error('Unresolved LinkedIn Member identifier.');
    const meData = await meRes.json() as { id: string };
    const personUrn = `urn:li:person:${meData.id}`;

    const shareBody = {
      author: personUrn,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: {
            text: caption
          },
          shareMediaCategory: 'NONE'
        }
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC'
      }
    };

    if (mediaUrls && mediaUrls.length > 0) {
      shareBody.specificContent['com.linkedin.ugc.ShareContent'].shareMediaCategory = 'IMAGE';
      (shareBody.specificContent['com.linkedin.ugc.ShareContent'] as any).media = [
        {
          status: 'READY',
          description: { text: caption.substring(0, 100) },
          originalUrl: mediaUrls[0],
          title: { text: 'CrossPost Media Share' }
        }
      ];
    }

    const postRes = await fetch('https://api.linkedin.com/v2/ugcPosts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0'
      },
      body: JSON.stringify(shareBody)
    });

    if (!postRes.ok) {
      const err = await postRes.json().catch(() => ({}));
      throw new Error(err.message || 'LinkedIn UGC Post creation failed.');
    }

    const postData = await postRes.json() as { id: string };

    return {
      platform_post_id: postData.id,
      platform_post_url: `https://www.linkedin.com/feed/update/${postData.id}`
    };
  },

  async publishMedia(accessToken: string, fileUrl: string, mediaType: 'image' | 'video', title?: string, caption?: string) {
    return this.publishPost(accessToken, caption || title || '', [fileUrl]);
  }
};
