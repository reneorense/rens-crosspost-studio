export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const platforms = [
    {
      id: 'facebook',
      name: 'Facebook Pages',
      icon: 'Facebook',
      supportedMedia: ['image', 'video'],
      scopes: ['pages_manage_posts', 'pages_read_engagement', 'publish_video'],
      envVars: ['FACEBOOK_CLIENT_ID', 'FACEBOOK_CLIENT_SECRET'],
      isConfigured: !!(process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET),
      setupNotes: 'Requires Meta Business Developer credentials and standard App Review clearance.'
    },
    {
      id: 'instagram',
      name: 'Instagram Pro',
      icon: 'Instagram',
      supportedMedia: ['image', 'video'],
      scopes: ['instagram_basic', 'instagram_content_publish'],
      envVars: ['INSTAGRAM_CLIENT_ID', 'INSTAGRAM_CLIENT_SECRET'],
      isConfigured: !!(process.env.INSTAGRAM_CLIENT_ID && process.env.INSTAGRAM_CLIENT_SECRET),
      setupNotes: 'Requires Meta Business Access enabled for professional Creator or Creator business entities.'
    },
    {
      id: 'tiktok',
      name: 'TikTok Pro',
      icon: 'Video',
      supportedMedia: ['video'],
      scopes: ['video.publish', 'user.info.basic'],
      envVars: ['TIKTOK_CLIENT_ID', 'TIKTOK_CLIENT_SECRET'],
      isConfigured: !!(process.env.TIKTOK_CLIENT_ID && process.env.TIKTOK_CLIENT_SECRET),
      setupNotes: 'Requires registered TikTok Developer Account credentials, with live publishing scopes validated.'
    },
    {
      id: 'x',
      name: 'X (Twitter)',
      icon: 'Twitter',
      supportedMedia: ['image', 'video'],
      scopes: ['tweet.read', 'tweet.write', 'users.read', 'offline.access'],
      envVars: ['X_CLIENT_ID', 'X_CLIENT_SECRET'],
      isConfigured: !!(process.env.X_CLIENT_ID && process.env.X_CLIENT_SECRET),
      setupNotes: 'Requires standard OAuth 2.0 Client credentials under Twitter Developer dashboard settings.'
    },
    {
      id: 'linkedin',
      name: 'LinkedIn Professional',
      icon: 'Linkedin',
      supportedMedia: ['image', 'video'],
      scopes: ['w_member_social', 'openid', 'profile'],
      envVars: ['LINKEDIN_CLIENT_ID', 'LINKEDIN_CLIENT_SECRET'],
      isConfigured: !!(process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET),
      setupNotes: 'Requires Developer Portal application with "Share on LinkedIn" verification enabled.'
    },
    {
      id: 'youtube',
      name: 'YouTube Channel',
      icon: 'Youtube',
      supportedMedia: ['video'],
      scopes: ['https://www.googleapis.com/auth/youtube.upload'],
      envVars: ['YOUTUBE_CLIENT_ID', 'YOUTUBE_CLIENT_SECRET'],
      isConfigured: !!(process.env.YOUTUBE_CLIENT_ID && process.env.YOUTUBE_CLIENT_SECRET),
      setupNotes: 'Requires Google Cloud Console Project with YouTube Data API v3 integration activated.'
    },
    {
      id: 'pinterest',
      name: 'Pinterest Board',
      icon: 'Bookmark',
      supportedMedia: ['image', 'video'],
      scopes: ['boards:read', 'pins:read', 'pins:write'],
      envVars: ['PINTEREST_CLIENT_ID', 'PINTEREST_CLIENT_SECRET'],
      isConfigured: !!(process.env.PINTEREST_CLIENT_ID && process.env.PINTEREST_CLIENT_SECRET),
      setupNotes: 'Requires Pinterest Developer App ID registration with standard pin board scope approvals.'
    },
    {
      id: 'threads',
      name: 'Threads Profile',
      icon: 'MessageSquare',
      supportedMedia: ['image', 'video'],
      scopes: ['threads_basic', 'threads_content_publish'],
      envVars: ['THREADS_CLIENT_ID', 'THREADS_CLIENT_SECRET'],
      isConfigured: !!(process.env.THREADS_CLIENT_ID && process.env.THREADS_CLIENT_SECRET),
      setupNotes: 'Requires Meta Developer portal Threads access credentials with production publish settings.'
    }
  ];

  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.status(200).json({ platforms });
}
