import { supabaseAdmin } from '../lib/supabaseAdmin';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { fileName } = req.body || req.query || {};
    const url = process.env.SUPABASE_URL || '';
    if (!url) {
      return res.status(400).json({ error: 'Supabase credentials are not configured.' });
    }

    const fileExt = fileName ? fileName.split('.').pop() : 'bin';
    const cleanPath = `uploads/${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;

    const { data, error } = await supabaseAdmin.storage
      .from('media')
      .createSignedUploadUrl(cleanPath);

    if (error || !data) {
      console.error('[Supabase Storage] Error generating signed upload URL via dedicated endpoint:', error);
      return res.status(500).json({ error: error?.message || 'Failed to generate secure signed upload token.' });
    }

    const publicUrl = `${url}/storage/v1/object/public/media/${cleanPath}`;

    return res.status(200).json({
      signedUrl: data.signedUrl,
      token: data.token,
      filePath: cleanPath,
      publicUrl
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
