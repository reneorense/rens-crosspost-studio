import { PlatformConnector } from './types';

export const ThreadsConnector: PlatformConnector = {
  getOAuthUrl(redirectUri: string, state: string): string {
    const clientId = process.env.THREADS_CLIENT_ID || '';
    if (!clientId) {
      throw new Error('THREADS_CLIENT_ID environment variable is missing.');
    }
    const scopes = ['threads_basic', 'threads_content_publish'];
    return `https://threads.net/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes.join(','))}&response_type=code&state=${state}`;
  },

  async handleOAuthCallback(code: string, redirectUri: string) {
    const clientId = process.env.THREADS_CLIENT_ID;
    const clientSecret = process.env.THREADS_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error('Threads credentials are not fully configured.');
    }

    const res = await fetch('https://graph.threads.net/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
        code: code
      }).toString()
    });

    if (!res.ok) {
      throw new Error('Threads OAuth exchange failed.');
    }

    const data = await res.json() as { access_token: string; user_id: string; expires_in?: number };

    const profileRes = await fetch(`https://graph.threads.net/v1.0/me?fields=id,username,threads_profile_picture_url&access_token=${data.access_token}`);
    
    let display_name = 'Threads Member';
    let avatar_url = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80';

    if (profileRes.ok) {
      const profileData = await profileRes.json() as { id: string; username?: string; threads_profile_picture_url?: string };
      display_name = profileData.username ? `@${profileData.username}` : display_name;
      avatar_url = profileData.threads_profile_picture_url || avatar_url;
    }

    return {
      access_token: data.access_token,
      expires_in: data.expires_in || 7200,
      platform_account_id: data.user_id,
      display_name,
      avatar_url
    };
  },

  async refreshToken(refreshTokenVal: string) {
    return {
      access_token: refreshTokenVal,
      expires_in: 5184000
    };
  },

  async validateConnection(accessToken: string): Promise<boolean> {
    const res = await fetch(`https://graph.threads.net/v1.0/me?fields=id&access_token=${accessToken}`);
    return res.ok;
  },

  async publishPost(accessToken: string, caption: string, mediaUrls: string[]) {
    const meRes = await fetch(`https://graph.threads.net/v1.0/me?fields=id&access_token=${accessToken}`);
    if (!meRes.ok) throw new Error('Unresolved Threads member profile credentials.');
    const meData = await meRes.json() as { id: string };
    const threadsUserId = meData.id;

    const isVideo = mediaUrls && mediaUrls.length > 0 && (mediaUrls[0].endsWith('.mp4') || mediaUrls[0].includes('video'));
    const containerUrl = `https://graph.threads.net/v1.0/${threadsUserId}/threads`;
    
    const containerBody: Record<string, string> = {
      media_type: 'TEXT',
      text: caption
    };

    if (mediaUrls && mediaUrls.length > 0) {
      if (isVideo) {
        containerBody.media_type = 'VIDEO';
        containerBody.video_url = mediaUrls[0];
      } else {
        containerBody.media_type = 'IMAGE';
        containerBody.image_url = mediaUrls[0];
      }
    }

    const containerRes = await fetch(containerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(containerBody)
    });

    if (!containerRes.ok) {
      const err = await containerRes.json().catch(() => ({}));
      throw new Error(err.error?.message || 'Threads media/text container initialization failed.');
    }

    const containerData = await containerRes.json() as { id: string };
    const creationId = containerData.id;

    if (isVideo) {
      await new Promise(resolve => setTimeout(resolve, 3500));
    }

    const publishRes = await fetch(`https://graph.threads.net/v1.0/${threadsUserId}/threads_publish?creation_id=${creationId}&access_token=${accessToken}`, {
      method: 'POST'
    });

    if (!publishRes.ok) {
      const err = await publishRes.json().catch(() => ({}));
      throw new Error(err.error?.message || 'Failed to publish threads collection.');
    }

    const publishData = await publishRes.json() as { id: string };

    return {
      platform_post_id: publishData.id,
      platform_post_url: `https://www.threads.net/@creator/post/${publishData.id}`
    };
  },

  async publishMedia(accessToken: string, fileUrl: string, mediaType: 'image' | 'video', title?: string, caption?: string) {
    return this.publishPost(accessToken, caption || title || '', [fileUrl]);
  }
};
