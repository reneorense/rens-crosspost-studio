import { getConnector } from './connectors/index';
import { db } from './db';
import { ConnectedAccount } from '../../src/types';

export const makeOauthStartHandler = (platform: string) => {
  return async (req: any, res: any) => {
    try {
      const prefix = platform.toUpperCase();
      const clientId = process.env[`${prefix}_CLIENT_ID`];
      if (!clientId) {
        throw new Error(`Client configuration for ${platform} is incomplete. Missing ${prefix}_CLIENT_ID.`);
      }

      const connector = getConnector(platform);
      const hostUrl = process.env.APP_URL || `http://localhost:3000`;
      
      const redirectUriFromEnv = process.env[`${prefix}_REDIRECT_URI`];
      const redirectUri = redirectUriFromEnv || `${hostUrl}/api/oauth/${platform}/callback`;
      
      const state = `state_${platform}_${Math.random().toString(36).substring(2)}`;
      const url = connector.getOAuthUrl(redirectUri, state);
      
      res.writeHead(302, { Location: url });
      res.end();
    } catch (err: any) {
      console.error(`[OAuth Start] ${platform} error:`, err);
      res.status(500).setHeader('Content-Type', 'text/html').send(`
        <html>
          <body style="background:#0b0f19; color:#f3f4f6; font-family:sans-serif; text-align:center; padding:50px;">
            <h1 style="color:#ef4444;">API Setup Missing ${platform.toUpperCase()}</h1>
            <p style="color:#cbd5e1; max-width:500px; margin:20px auto; line-height:1.6;">
              Please configure the environment keys <strong>${platform.toUpperCase()}_CLIENT_ID</strong> and <strong>${platform.toUpperCase()}_CLIENT_SECRET</strong> in your environment variables.
            </p>
            <p style="color:#94a3b8; font-size:12px;">Root cause: ${err.message}</p>
            <a href="/" style="background:#4f46e5; color:white; padding:10px 20px; border-radius:8px; text-decoration:none; display:inline-block; margin-top:20px;">Return to dashboard</a>
          </body>
        </html>
      `);
    }
  };
};

export const makeOauthCallbackHandler = (platform: string) => {
  return async (req: any, res: any) => {
    const code = req.query?.code;
    
    if (!code) {
      res.writeHead(302, {
        Location: `/?oauth=failed&platform=${platform}&reason=${encodeURIComponent('No authorization code received from provider')}`
      });
      res.end();
      return;
    }

    try {
      const connector = getConnector(platform);
      const hostUrl = process.env.APP_URL || `http://localhost:3000`;
      const redirectUriFromEnv = process.env[`${platform.toUpperCase()}_REDIRECT_URI`];
      const redirectUri = redirectUriFromEnv || `${hostUrl}/api/oauth/${platform}/callback`;

      const callbackResult = await connector.handleOAuthCallback(code, redirectUri);
      const accId = `acc_${platform}_${Date.now()}`;
      
      // Save Token securely in Supabase
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

      // Save Connected Account Profile
      const newAccount: ConnectedAccount = {
        id: accId,
        user_id: 'u1',
        platform,
        platform_account_id: callbackResult.platform_account_id,
        display_name: callbackResult.display_name,
        avatar_url: callbackResult.avatar_url || 'https://images.unsplash.com/photo-1511367461989-f85a21fda167?auto=format&fit=crop&w=150&q=80',
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

      res.status(200).setHeader('Content-Type', 'text/html').send(`
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
      console.error(`OAuth Callback failure for ${platform}:`, err);
      res.writeHead(302, {
        Location: `/?oauth=failed&platform=${platform}&reason=${encodeURIComponent(err.message || 'Unknown integration error')}`
      });
      res.end();
    }
  };
};
