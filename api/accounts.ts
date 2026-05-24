import { db } from './lib/db';

export default async function handler(req: any, res: any) {
  const method = req.method;
  const idValue = req.query?.id;

  if (method === 'GET') {
    try {
      const accounts = await db.getAccounts();
      return res.status(200).json(accounts);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (method === 'DELETE') {
    if (!idValue) {
      return res.status(400).json({ error: 'Missing account ID parameter.' });
    }

    try {
      const account = await db.getAccountById(idValue);
      await db.removeAccount(idValue);
      if (account) {
        await db.addLog({
          id: `log_${Date.now()}_rm_${account.platform}`,
          post_id: '',
          platform: account.platform,
          action: 'disconnect_account',
          status: 'success',
          message: `Social channel account disconnected for "${account.display_name}".`,
          created_at: new Date().toISOString()
        });
      }
      return res.status(200).json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
