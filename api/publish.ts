import { db } from './lib/db';
import { getConnector } from './lib/connectors/index';
import { Post, PostTarget, ScheduledPost } from '../src/types';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { title, caption, media_asset_ids, platforms, scheduleDate, timezone } = req.body || {};

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
        const hostUrl = process.env.APP_URL || `http://localhost:3000`;
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

      return res.status(200).json({ success: true, post: newPost, scheduled: schedPost });
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

        let publishResult;
        if (tokenObj.access_token.startsWith('mock_')) {
          console.log(`[Publisher] Simulating successful publish to ${acc.platform} (Demo/Preview Mode)...`);
          publishResult = {
            platform_post_id: `${acc.platform}_sim_${Date.now()}`,
            platform_post_url: `https://www.${acc.platform === 'x' ? 'twitter' : acc.platform}.com/p/sim_${Date.now()}`
          };
        } else {
          const connector = getConnector(acc.platform);
          console.log(`[Publisher] Releasing post to ${acc.platform} via modular connector...`);
          publishResult = await connector.publishPost(tokenObj.access_token, caption, mediaUrls);
        }

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

    return res.status(200).json({
      success: overallSuccess,
      post: newPost,
      targets: publishResults
    });
  } catch (err: any) {
    console.error(`[Publish] Critical publisher error:`, err);
    return res.status(500).json({ error: err.message });
  }
}
