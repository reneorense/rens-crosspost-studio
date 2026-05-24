import { db } from './lib/db';
import { getConnector } from './lib/connectors/index';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { platform, accountId } = req.query || {};

  if (!platform || !accountId) {
    return res.status(400).json({ error: 'Missing platform or accountId parameter.' });
  }

  try {
    const tokenObj = await db.getOAuthToken(accountId);
    if (!tokenObj || !tokenObj.access_token) {
      return res.status(200).json({ success: false, status: 'expired', error: 'No secure access token found in database records.' });
    }

    let isConnectionValid = false;
    if (tokenObj.access_token.startsWith('mock_')) {
      isConnectionValid = true;
    } else {
      const connector = getConnector(platform);
      isConnectionValid = await connector.validateConnection(tokenObj.access_token);
    }
    
    const account = await db.getAccountById(accountId);
    if (account) {
      account.status = isConnectionValid ? 'active' : 'expired';
      await db.saveAccount(account);
    }

    return res.status(200).json({
      success: isConnectionValid,
      status: isConnectionValid ? 'active' : 'expired'
    });
  } catch (err: any) {
    console.error(`[Validation] Error validating ${platform}:`, err);
    return res.status(200).json({ success: false, status: 'expired', error: err.message });
  }
}
