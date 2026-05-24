import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { db } from './src/backend/db';
import { getConnector } from './src/backend/connectors';
import { ConnectedAccount, Post, PostTarget, ScheduledPost, MediaAsset } from './src/types';
import dotenv from 'dotenv';

// Load variables
dotenv.config();

const isProd = process.env.NODE_ENV === 'production';
const PORT = 3000;

async function startServer() {
  const app = express();
  
  // Parse larger payloads for image uploading base64
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // Create local folders
  const uploadsDir = path.join(process.cwd(), 'data', 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  // Serve static uploads
  app.use('/uploads', express.static(uploadsDir));

  // --- API ROUTING UNDER /api ---

  // Configuration check for platform configs page
  app.get('/api/config', (req: Request, res: Response) => {
    const platforms = [
      { id: 'facebook', name: 'Facebook Pages', envs: ['FACEBOOK_CLIENT_ID', 'FACEBOOK_CLIENT_SECRET'] },
      { id: 'instagram', name: 'Instagram Professional', envs: ['INSTAGRAM_CLIENT_ID', 'INSTAGRAM_CLIENT_SECRET'] },
      { id: 'tiktok', name: 'TikTok', envs: ['TIKTOK_CLIENT_ID', 'TIKTOK_CLIENT_SECRET'] },
      { id: 'x', name: 'X / Twitter', envs: ['X_CLIENT_ID', 'X_CLIENT_SECRET'] },
      { id: 'linkedin', name: 'LinkedIn', envs: ['LINKEDIN_CLIENT_ID', 'LINKEDIN_CLIENT_SECRET'] },
      { id: 'youtube', name: 'YouTube / YouTube Shorts', envs: ['YOUTUBE_CLIENT_ID', 'YOUTUBE_CLIENT_SECRET'] },
      { id: 'pinterest', name: 'Pinterest', envs: ['PINTEREST_CLIENT_ID', 'PINTEREST_CLIENT_SECRET'] },
      { id: 'threads', name: 'Threads', envs: ['THREADS_CLIENT_ID', 'THREADS_CLIENT_SECRET'] }
    ];

    const result = platforms.map(p => {
      const missing = p.envs.filter(env => !process.env[env]);
      return {
        id: p.id,
        name: p.name,
        envVars: p.envs,
        isConfigured: missing.length === 0,
        missingVars: missing
      };
    });

    res.json({ platforms: result });
  });

  // Accounts
  app.get('/api/accounts', async (req: Request, res: Response) => {
    try {
      const accounts = await db.getAccounts();
      res.json(accounts);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/accounts/:id', async (req: Request, res: Response) => {
    try {
      await db.removeAccount(req.params.id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- PLATFORM DIRECT OAUTH & PUBLISH ROUTES ---
  
  const SUPPORTED_PLATFORMS = ['facebook', 'instagram', 'tiktok', 'x', 'linkedin', 'youtube', 'pinterest', 'threads'];

  // Route 1: OAuth Start
  app.get('/api/oauth/:platform/start', async (req: Request, res: Response) => {
    const { platform } = req.params;
    if (!SUPPORTED_PLATFORMS.includes(platform.toLowerCase())) {
      return res.status(400).send(`
        <html>
          <body style="background:#0b0f19; color:#f3f4f6; font-family:sans-serif; text-align:center; padding:50px;">
            <h1 style="color:#ef4444;">Error</h1>
            <p>Platform "${platform}" is not supported.</p>
            <a href="/" style="color:#a855f7; text-decoration:none;">Return to studio dashboard</a>
          </body>
        </html>
      `);
    }

    try {
      // Validate client configurations exist
      const prefix = platform.toUpperCase();
      const clientId = process.env[`${prefix}_CLIENT_ID`];
      const clientSecret = process.env[`${prefix}_CLIENT_SECRET`];

      if (!clientId) {
        throw new Error(`Client configuration for ${platform} is incomplete. Missing ${prefix}_CLIENT_ID.`);
      }

      const connector = getConnector(platform);
      const hostUrl = process.env.APP_URL || `http://localhost:${PORT}`;
      
      // Let the redirect URI come from process.env or construct the standard callback route
      const redirectUriEnv = process.env[`${prefix}_REDIRECT_URI`];
      const redirectUri = redirectUriEnv || `${hostUrl}/api/oauth/${platform}/callback`;
      
      const state = `state_${platform}_${Math.random().toString(36).substring(2)}`;
      const url = connector.getOAuthUrl(redirectUri, state);
      
      console.log(`[OAuth] Redirecting to ${platform} start URL: ${url}`);
      res.redirect(url);
    } catch (err: any) {
      console.error(`[OAuth] Error starting ${platform}:`, err);
      res.status(500).send(`
        <html>
          <body style="background:#0b0f19; color:#f3f4f6; font-family:sans-serif; text-align:center; padding:50px;">
            <h1 style="color:#ef4444;">API Setup Missing $^{platform.toUpperCase()}</h1>
            <p style="color:#cbd5e1; max-width:500px; margin:20px auto; line-height:1.6;">
              Please configure the environment keys <strong>${platform.toUpperCase()}_CLIENT_ID</strong> and <strong>${platform.toUpperCase()}_CLIENT_SECRET</strong> in your AI Studio secrets panel first.
            </p>
            <p style="color:#94a3b8; font-size:12px;">Root cause: ${err.message}</p>
            <a href="/" style="background:#4f46e5; color:white; padding:10px 20px; border-radius:8px; text-decoration:none; display:inline-block; margin-top:20px;">Return to dashboard</a>
          </body>
        </html>
      `);
    }
  });

  // Route 2: OAuth Callback
  app.get('/api/oauth/:platform/callback', async (req: Request, res: Response) => {
    const { platform } = req.params;
    const { code } = req.query;

    if (!SUPPORTED_PLATFORMS.includes(platform.toLowerCase())) {
      return res.status(400).send('Unsupported platform callback.');
    }

    if (!code || typeof code !== 'string') {
      return res.redirect(`/?oauth=failed&platform=${platform}&reason=No+authorization+code+received+from+provider`);
    }

    try {
      const connector = getConnector(platform);
      const hostUrl = process.env.APP_URL || `http://localhost:${PORT}`;
      const redirectUriEnv = process.env[`${platform.toUpperCase()}_REDIRECT_URI`];
      const redirectUri = redirectUriEnv || `${hostUrl}/api/oauth/${platform}/callback`;

      const callbackResult = await connector.handleOAuthCallback(code, redirectUri);

      // Create new account reference
      const accId = `acc_${platform}_${Date.now()}`;
      
      // Save Token securely in oauth_tokens table (never return this to frontend)
      await db.saveOAuthToken({
        id: `tok_${platform}_${Date.now()}`,
        connected_account_id: accId,
        platform,
        access_token: callbackResult.access_token,
        refresh_token: callbackResult.refresh_token || '',
        expires_at: callbackResult.expires_in 
          ? new Date(Date.now() + callbackResult.expires_in * 1000).toISOString() 
          : new Date(Date.now() + 86400000 * 30).toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      // Save public account metadata profile (excluding raw tokens)
      const newAccount: ConnectedAccount = {
        id: accId,
        user_id: 'u1',
        platform,
        platform_account_id: callbackResult.platform_account_id,
        display_name: callbackResult.display_name,
        avatar_url: callbackResult.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80',
        status: 'active',
        access_token_reference: '', 
        refresh_token_reference: '',
        token_expires_at: callbackResult.expires_in 
          ? new Date(Date.now() + callbackResult.expires_in * 1000).toISOString() 
          : new Date(Date.now() + 86400000 * 30).toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        posts_count: 0,
        last_post_date: ''
      };

      await db.saveAccount(newAccount);

      await db.addLog({
        id: `log_${Date.now()}_auth`,
        post_id: '',
        platform,
        action: 'oauth_connect',
        status: 'success',
        message: `Successfully linked account "${callbackResult.display_name}" via secure OAuth.`,
        created_at: new Date().toISOString()
      });

      // Show parent postMessage success and redirect back
      res.send(`
        <html>
          <body style="background:#0b0f19; color:#f3f4f6; font-family:sans-serif; text-align:center; padding:50px;">
            <h2 style="color: #10b981;">Authentication Successful!</h2>
            <p>Linked account <strong>${callbackResult.display_name}</strong> successfully.</p>
            <p style="color:#94a3b8; font-size:13px;">Returning to workspace...</p>
            <script>
              if (window.opener) {
                window.opener.postMessage({ 
                  type: 'OAUTH_AUTH_SUCCESS', 
                  platform: '${platform}', 
                  name: '${encodeURIComponent(callbackResult.display_name)}' 
                }, '*');
                window.close();
              } else {
                window.location.href = '/?oauth=success&platform=${platform}&name=${encodeURIComponent(callbackResult.display_name)}';
              }
            </script>
          </body>
        </html>
      `);
    } catch (err: any) {
      console.error('OAuth Callback failure:', err);
      res.redirect(`/?oauth=failed&platform=${platform}&reason=${encodeURIComponent(err.message || 'Unknown integration error')}`);
    }
  });

  // Route 3: Connection Validation
  app.get('/api/:platform/validate-connection', async (req: Request, res: Response) => {
    const { platform } = req.params;
    const { accountId } = req.query;

    if (!SUPPORTED_PLATFORMS.includes(platform.toLowerCase())) {
      return res.status(400).json({ error: 'Unsupported platform.' });
    }

    if (!accountId || typeof accountId !== 'string') {
      return res.status(400).json({ error: 'accountId is a required parameter.' });
    }

    try {
      const tokenObj = await db.getOAuthToken(accountId);
      if (!tokenObj || !tokenObj.access_token) {
        return res.json({ success: false, status: 'expired', error: 'No secure access token found in database records.' });
      }

      const connector = getConnector(platform);
      const isConnectionValid = await connector.validateConnection(tokenObj.access_token);
      
      const account = await db.getAccountById(accountId);
      if (account) {
        account.status = isConnectionValid ? 'active' : 'expired';
        await db.saveAccount(account);
      }

      res.json({
        success: isConnectionValid,
        status: isConnectionValid ? 'active' : 'expired'
      });
    } catch (err: any) {
      console.error(`[Validation] Error validating ${platform}:`, err);
      res.json({ success: false, status: 'expired', error: err.message });
    }
  });

  // Route 4: Direct Post Publish
  app.post('/api/:platform/publish', async (req: Request, res: Response) => {
    const { platform } = req.params;
    const { accountId, caption, mediaUrls } = req.body;

    if (!SUPPORTED_PLATFORMS.includes(platform.toLowerCase())) {
      return res.status(400).json({ error: 'Unsupported platform.' });
    }

    if (!accountId) {
      return res.status(400).json({ error: 'accountId parameter is required.' });
    }

    if (!caption) {
      return res.status(400).json({ error: 'caption is required.' });
    }

    try {
      const tokenObj = await db.getOAuthToken(accountId);
      if (!tokenObj || !tokenObj.access_token) {
        return res.status(401).json({ error: 'Direct token expired or decouple event logged on database side.' });
      }

      const connector = getConnector(platform);
      console.log(`[Publish API] Publishing text & media directly onto platform service: ${platform}`);
      const result = await connector.publishPost(tokenObj.access_token, caption, mediaUrls || []);
      
      res.json({
        success: true,
        platform_post_id: result.platform_post_id,
        platform_post_url: result.platform_post_url
      });
    } catch (err: any) {
      console.error(`[Publish API] Direct publish exception on ${platform}:`, err);
      res.status(500).json({ error: err.message || 'Third party API request failed.' });
    }
  });

  // Posts listing
  app.get('/api/posts', async (req: Request, res: Response) => {
    try {
      const posts = await db.getPosts();
      const targets = await db.getPostTargets();
      const scheduled = await db.getScheduledPosts();
      
      // Hydrate targets and schedules
      const hydrated = posts.map(p => {
        const postTargets = targets.filter(t => t.post_id === p.id);
        const schedule = scheduled.find(s => s.post_id === p.id);
        return {
          ...p,
          targets: postTargets,
          schedule
        };
      });

      res.json(hydrated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Create post (both publish direct and scheduling)
  app.post('/api/posts', async (req: Request, res: Response) => {
    const { title, caption, media_asset_ids, platforms, scheduleDate, timezone } = req.body;

    if (!platforms || !Array.isArray(platforms) || platforms.length === 0) {
      return res.status(400).json({ error: 'Please choose at least one social account platform.' });
    }

    const accounts = await db.getAccounts();
    const selectedAccounts = accounts.filter(acc => platforms.includes(acc.id));

    if (selectedAccounts.length === 0) {
      return res.status(400).json({ error: 'No matching active accounts resolved.' });
    }

    const shouldSchedule = !!scheduleDate;
    const postStatus = shouldSchedule ? 'scheduled' : 'posted';

    const postId = `post_${Date.now()}`;
    const newPost: Post = {
      id: postId,
      user_id: 'u1',
      title: title || 'Untitled Post',
      caption: caption || '',
      media_asset_ids: media_asset_ids || [],
      status: postStatus,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    await db.savePost(newPost);

    // Resolve media URLs
    const mediaAssets = await db.getMediaAssets();
    const mediaUrls = (media_asset_ids || []).map((id: string) => {
      const asset = mediaAssets.find(a => a.id === id);
      if (asset) {
        if (asset.file_url.startsWith('http')) {
          return asset.file_url;
        }
        const hostUrl = process.env.APP_URL || `http://localhost:${PORT}`;
        return `${hostUrl}${asset.file_url}`;
      }
      return '';
    }).filter(Boolean);

    // Setup scheduling
    if (shouldSchedule) {
      const schedId = `sched_${Date.now()}`;
      const schedPost: ScheduledPost = {
        id: schedId,
        post_id: postId,
        scheduled_at: scheduleDate,
        timezone: timezone || 'UTC',
        status: 'scheduled',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      await db.saveScheduledPost(schedPost);

      for (const acc of selectedAccounts) {
        const target: PostTarget = {
          id: `tgt_${postId}_${acc.platform}`,
          post_id: postId,
          platform: acc.platform,
          connected_account_id: acc.id,
          platform_post_id: null,
          platform_post_url: null,
          status: 'pending',
          error_message: null,
          posted_at: null
        };
        await db.savePostTarget(target);
      }

      await db.addLog({
        id: `log_${Date.now()}_sched`,
        post_id: postId,
        platform: 'all',
        action: 'schedule_post',
        status: 'scheduled',
        message: `Post successfully queued for ${scheduleDate}`,
        created_at: new Date().toISOString()
      });

      return res.json({ success: true, post: newPost, scheduled: schedPost });
    }

    // Direct Instant Post Publishing
    const publishResults = [];
    let overallSuccess = true;

    for (const acc of selectedAccounts) {
      const targetId = `tgt_${postId}_${acc.platform}`;
      const target: PostTarget = {
        id: targetId,
        post_id: postId,
        platform: acc.platform,
        connected_account_id: acc.id,
        platform_post_id: null,
        platform_post_url: null,
        status: 'pending',
        error_message: null,
        posted_at: null
      };

      try {
        const tokenObj = await db.getOAuthToken(acc.id);
        if (!tokenObj || !tokenObj.access_token) {
          throw new Error('No authorization token present in database. Connect standard profile first.');
        }

        const connector = getConnector(acc.platform);
        console.log(`[Publisher] Releasing post to ${acc.platform} via modular connector...`);
        const publishResult = await connector.publishPost(tokenObj.access_token, caption, mediaUrls);

        target.status = 'success';
        target.platform_post_id = publishResult.platform_post_id;
        target.platform_post_url = publishResult.platform_post_url;
        target.posted_at = new Date().toISOString();

        acc.posts_count = (acc.posts_count || 0) + 1;
        acc.last_post_date = new Date().toISOString();
        await db.saveAccount(acc);

        await db.addLog({
          id: `log_${Date.now()}_${acc.platform}`,
          post_id: postId,
          platform: acc.platform,
          action: 'publish_post',
          status: 'success',
          message: `Post successfully published to ${acc.platform}! Post ID: ${publishResult.platform_post_id}`,
          created_at: new Date().toISOString()
        });

      } catch (err: any) {
        console.error(`Direct failure posting to ${acc.platform}:`, err);
        overallSuccess = false;
        target.status = 'failed';
        target.error_message = err.message || 'Direct platform API publish failed.';

        await db.addLog({
          id: `log_${Date.now()}_${acc.platform}_err`,
          post_id: postId,
          platform: acc.platform,
          action: 'publish_post',
          status: 'failed',
          message: `Error sending to ${acc.platform}: ${err.message || 'Unknown connection error'}`,
          created_at: new Date().toISOString()
        });
      }

      await db.savePostTarget(target);
      publishResults.push(target);
    }

    newPost.status = overallSuccess ? 'posted' : 'failed';
    await db.savePost(newPost);

    res.json({
      success: overallSuccess,
      post: newPost,
      targets: publishResults
    });
  });

  // Retry failed post targets
  app.post('/api/posts/:id/retry', async (req: Request, res: Response) => {
    const postId = req.params.id;
    const posts = await db.getPosts();
    const post = posts.find(p => p.id === postId);
    if (!post) {
      return res.status(404).json({ error: 'Post record not found.' });
    }

    const targets = (await db.getPostTargets(postId)).filter(t => t.status === 'failed');
    if (targets.length === 0) {
      return res.status(400).json({ error: 'No failed targets to retry.' });
    }

    const mediaAssets = await db.getMediaAssets();
    const mediaUrls = (post.media_asset_ids || []).map((id: string) => {
      const asset = mediaAssets.find(a => a.id === id);
      if (asset) {
        if (asset.file_url.startsWith('http')) return asset.file_url;
        const hostUrl = process.env.APP_URL || `http://localhost:${PORT}`;
        return `${hostUrl}${asset.file_url}`;
      }
      return '';
    }).filter(Boolean);

    for (const tgt of targets) {
      const acc = await db.getAccountById(tgt.connected_account_id);
      if (!acc) continue;

      try {
        const tokenObj = await db.getOAuthToken(acc.id);
        if (!tokenObj || !tokenObj.access_token) {
          throw new Error('Missing authorization token value.');
        }

        const connector = getConnector(acc.platform);
        const publishResult = await connector.publishPost(tokenObj.access_token, post.caption, mediaUrls);

        tgt.status = 'success';
        tgt.platform_post_id = publishResult.platform_post_id;
        tgt.platform_post_url = publishResult.platform_post_url;
        tgt.error_message = null;
        tgt.posted_at = new Date().toISOString();

        acc.posts_count = (acc.posts_count || 0) + 1;
        acc.last_post_date = new Date().toISOString();
        await db.saveAccount(acc);

        await db.addLog({
          id: `log_${Date.now()}_retry_${acc.platform}`,
          post_id: postId,
          platform: acc.platform,
          action: 'retry_failed_post',
          status: 'success',
          message: `Post successfully retried and published to ${acc.platform}!`,
          created_at: new Date().toISOString()
        });

      } catch (err: any) {
        tgt.error_message = err.message || 'Retry publisher attempt failed again.';
        await db.addLog({
          id: `log_${Date.now()}_retry_failed_${acc.platform}`,
          post_id: postId,
          platform: acc.platform,
          action: 'retry_failed_post',
          status: 'failed',
          message: `Retry error on ${acc.platform}: ${err.message}`,
          created_at: new Date().toISOString()
        });
      }
      await db.savePostTarget(tgt);
    }

    const allTargets = await db.getPostTargets(postId);
    const hasFailures = allTargets.some(t => t.status === 'failed');
    post.status = hasFailures ? 'failed' : 'posted';
    await db.savePost(post);

    res.json({ success: true, post, targets: allTargets });
  });

  app.delete('/api/posts/:id', async (req: Request, res: Response) => {
    try {
      await db.removePost(req.params.id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Scheduled endpoints to manage cancel/edit
  app.get('/api/scheduled', async (req: Request, res: Response) => {
    try {
      const list = await db.getScheduledPosts();
      res.json(list);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/scheduled/:id/cancel', async (req: Request, res: Response) => {
    const sId = req.params.id;
    const all = await db.getScheduledPosts();
    const item = all.find(s => s.id === sId);
    if (item) {
      item.status = 'canceled';
      await db.saveScheduledPost(item);

      const targets = await db.getPostTargets(item.post_id);
      for (const t of targets) {
        if (t.status === 'pending') {
          t.status = 'failed';
          t.error_message = 'Posting canceled by owner.';
          await db.savePostTarget(t);
        }
      }

      await db.addLog({
        id: `log_${Date.now()}_cancel`,
        post_id: item.post_id,
        platform: 'all',
        action: 'cancel_scheduled_post',
        status: 'canceled',
        message: 'Canceled scheduled release event.',
        created_at: new Date().toISOString()
      });

      res.json({ success: true, item });
    } else {
      res.status(404).json({ error: 'Schedule record not found' });
    }
  });

  // Media library
  app.get('/api/media', async (req: Request, res: Response) => {
    try {
      const assets = await db.getMediaAssets();
      res.json(assets);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/media', async (req: Request, res: Response) => {
    const { fileName, fileType, base64Data, fileSize } = req.body;
    if (!fileName || !base64Data) {
      return res.status(400).json({ error: 'Filename and base64 file content must be present.' });
    }

    try {
      const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      let dataBuffer: Buffer;
      let mime = 'image/jpeg';

      if (matches && matches.length === 3) {
        mime = matches[1];
        dataBuffer = Buffer.from(matches[2], 'base64');
      } else {
        dataBuffer = Buffer.from(base64Data, 'base64');
      }

      const hashName = `${Date.now()}_${fileName.replace(/\s+/g, '_')}`;
      const savePath = path.join(uploadsDir, hashName);
      
      fs.writeFileSync(savePath, dataBuffer);

      const mimeTypeClean = mime.toLowerCase();
      const detectedType = mimeTypeClean.startsWith('video') ? 'video' : 'image';

      const asset: MediaAsset = {
        id: `media_${Date.now()}`,
        user_id: 'u1',
        file_url: `/uploads/${hashName}`,
        file_type: detectedType as 'image' | 'video',
        file_name: fileName,
        file_size: fileSize || dataBuffer.length,
        mime_type: mimeTypeClean,
        created_at: new Date().toISOString()
      };

      await db.saveMediaAsset(asset);
      res.json(asset);
    } catch (e: any) {
      console.error(e);
      res.status(400).json({ error: `File conversion error: ${e.message}` });
    }
  });

  app.delete('/api/media/:id', async (req: Request, res: Response) => {
    const mediaId = req.params.id;
    const assets = await db.getMediaAssets();
    const asset = assets.find(a => a.id === mediaId);
    if (asset) {
      try {
        const localPath = path.join(process.cwd(), 'data', asset.file_url);
        if (fs.existsSync(localPath)) {
          fs.unlinkSync(localPath);
        }
      } catch (e) {
        console.warn('Physical file deletion warning:', e);
      }
      await db.removeMediaAsset(mediaId);
    }
    res.json({ success: true });
  });

  app.get('/api/logs', async (req: Request, res: Response) => {
    try {
      const logs = await db.getLogs();
      res.json(logs);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- AUTOMATIC BACKGROUND SCHEDULER (POLLING WORKER) ---
  // Periodically polls "scheduled" records that are overdue
  setInterval(async () => {
    try {
      const scheduledPosts = (await db.getScheduledPosts()).filter(s => s.status === 'scheduled');
      const now = new Date();

      for (const item of scheduledPosts) {
        const scheduleTime = new Date(item.scheduled_at);
        if (scheduleTime <= now) {
          console.log(`[SCHEDULER] Post ${item.post_id} is due. Initiating direct queue release...`);
          
          item.status = 'posting';
          await db.saveScheduledPost(item);

          const posts = await db.getPosts();
          const post = posts.find(p => p.id === item.post_id);
          if (!post) {
            item.status = 'failed';
            await db.saveScheduledPost(item);
            continue;
          }

          const targets = await db.getPostTargets(post.id);
          const accounts = await db.getAccounts();
          const mediaAssets = await db.getMediaAssets();
          const mediaUrls = (post.media_asset_ids || []).map((id: string) => {
            const asset = mediaAssets.find(a => a.id === id);
            if (asset) {
              if (asset.file_url.startsWith('http')) return asset.file_url;
              return `${process.env.APP_URL || `http://localhost:${PORT}`}${asset.file_url}`;
            }
            return '';
          }).filter(Boolean);

          let overallSuccess = true;

          for (const tgt of targets) {
            if (tgt.status !== 'pending') continue;

            const acc = accounts.find(a => a.id === tgt.connected_account_id);
            if (!acc) {
              tgt.status = 'failed';
              tgt.error_message = 'Associated social platform profile is missing.';
              await db.savePostTarget(tgt);
              continue;
            }

            try {
              const tokenObj = await db.getOAuthToken(acc.id);
              if (!tokenObj || !tokenObj.access_token) {
                throw new Error('Access credentials are missing or expired.');
              }

              const connector = getConnector(acc.platform);
              const publishResult = await connector.publishPost(tokenObj.access_token, post.caption, mediaUrls);

              tgt.status = 'success';
              tgt.platform_post_id = publishResult.platform_post_id;
              tgt.platform_post_url = publishResult.platform_post_url;
              tgt.posted_at = new Date().toISOString();

              acc.posts_count = (acc.posts_count || 0) + 1;
              acc.last_post_date = new Date().toISOString();
              await db.saveAccount(acc);

              await db.addLog({
                id: `log_${Date.now()}_sched_${acc.platform}`,
                post_id: post.id,
                platform: acc.platform,
                action: 'scheduler_publish',
                status: 'success',
                message: `Automated scheduler successfully posted to ${acc.platform}!`,
                created_at: new Date().toISOString()
              });

            } catch (err: any) {
              overallSuccess = false;
              tgt.status = 'failed';
              tgt.error_message = err.message || 'Scheduler publish block failed.';

              await db.addLog({
                id: `log_${Date.now()}_sched_fail_${acc.platform}`,
                post_id: post.id,
                platform: acc.platform,
                action: 'scheduler_publish',
                status: 'failed',
                message: `Scheduler job failed for ${acc.platform}: ${err.message}`,
                created_at: new Date().toISOString()
              });
            }

            await db.savePostTarget(tgt);
          }

          item.status = overallSuccess ? 'posted' : 'failed';
          await db.saveScheduledPost(item);

          post.status = overallSuccess ? 'posted' : 'failed';
          await db.savePost(post);
        }
      }
    } catch (err) {
      console.error('[SCHEDULER CRITICAL WORKER EXCEPTION]:', err);
    }
  }, 10000);

  // --- FRONTEND INTEGRATION & VITE STATIC SERVING ---

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom',
    });
    app.use(vite.middlewares);

    app.get('*', async (req: Request, res: Response, next) => {
      const url = req.originalUrl;
      try {
        let template = fs.readFileSync(
          path.resolve(process.cwd(), 'index.html'),
          'utf-8'
        );
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    // Production serving static bundles files
    app.use(express.static(path.resolve(process.cwd(), 'dist')));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.resolve(process.cwd(), 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[REN's CrossPost Studio] Backend online running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
