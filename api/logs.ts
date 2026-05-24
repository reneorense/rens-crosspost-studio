import { db } from './lib/db';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const logs = await db.getLogs();
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    return res.status(200).json(logs);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
