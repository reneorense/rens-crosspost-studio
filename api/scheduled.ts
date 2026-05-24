import { db } from './lib/db';

export default async function handler(req: any, res: any) {
  const method = req.method;
  const idValue = req.query?.id;

  if (method === 'GET') {
    try {
      const list = await db.getScheduledPosts();
      return res.status(200).json(list);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (method === 'POST') {
    if (!idValue) {
      return res.status(400).json({ error: 'Missing scheduled post ID parameter.' });
    }

    try {
      const all = await db.getScheduledPosts();
      const item = all.find(s => s.id === idValue);
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

        return res.status(200).json({ success: true, item });
      }

      return res.status(404).json({ error: 'Scheduled post record not found.' });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
