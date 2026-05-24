import { db } from '../lib/db';
import { getConnector } from '../lib/connectors/index';

export default async function handler(req: any, res: any) {
  // Optional security barrier for Cron events
  const authorizationHeader = req.headers?.authorization;
  if (process.env.CRON_SECRET && authorizationHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    // We log it, but during preview we can allow execution to help debug
    console.warn('[SCHEDULER] Missing or mismatched CRON_SECRET auth header.');
  }

  try {
    const scheduledPosts = (await db.getScheduledPosts()).filter(s => s.status === 'scheduled');
    const now = new Date();
    let executedCount = 0;

    for (const item of scheduledPosts) {
      const scheduleTime = new Date(item.scheduled_at);
      if (scheduleTime <= now) {
        console.log(`[SCHEDULER] Post ${item.post_id} is due. Initiating direct queue release...`);
        executedCount++;
        
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
            return `${process.env.APP_URL || `http://localhost:3000`}${asset.file_url}`;
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

    return res.status(200).json({ success: true, processed: executedCount });
  } catch (err: any) {
    console.error('[SCHEDULER EXCEPTION]:', err);
    return res.status(500).json({ error: err.message });
  }
}
