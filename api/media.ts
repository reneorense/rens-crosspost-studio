import { db } from './lib/db';
import { supabaseAdmin } from './lib/supabaseAdmin';

export default async function handler(req: any, res: any) {
  const method = req.method;
  const idValue = req.query?.id;

  if (method === 'GET') {
    try {
      const media = await db.getMediaAssets();
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      return res.status(200).json(media);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (method === 'DELETE') {
    if (!idValue) {
      return res.status(400).json({ error: 'Missing media asset ID parameter.' });
    }

    try {
      const mediaAssets = await db.getMediaAssets();
      const asset = mediaAssets.find(a => a.id === idValue);
      if (asset) {
        if (asset.file_url.includes('storage/v1/object/public/media')) {
          try {
            const parts = asset.file_url.split('/public/media/');
            if (parts.length > 1) {
              const storagePath = parts[1];
              await supabaseAdmin.storage.from('media').remove([storagePath]);
              console.log(`[Storage] Deleted file from Supabase storage bucket: ${storagePath}`);
            }
          } catch (storageErr) {
            console.warn('[Storage] Could not delete from Supabase bucket:', storageErr);
          }
        }
        await db.removeMediaAsset(idValue);
      }

      return res.status(200).json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (method === 'POST') {
    try {
      const { action, fileName, fileType, fileSize, id, fileUrl, mimeType } = req.body || {};

      if (action === 'get-signed-url' || req.query?.action === 'create-upload-url') {
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
          console.error('[Supabase Storage] Error generating signed upload URL:', error);
          return res.status(500).json({ error: error?.message || 'Failed to generate secure signed upload token.' });
        }

        const publicUrl = `${url}/storage/v1/object/public/media/${cleanPath}`;

        return res.status(200).json({
          signedUrl: data.signedUrl,
          token: data.token,
          filePath: cleanPath,
          publicUrl
        });
      }

      if (action === 'save-asset') {
        const newAsset = {
          id: id || `media_${Date.now()}`,
          user_id: 'u1',
          file_url: fileUrl,
          file_type: (fileType === 'video' ? 'video' : 'image') as 'image' | 'video',
          file_name: fileName || 'unnamed_upload',
          file_size: fileSize || 0,
          mime_type: mimeType || 'image/jpeg',
          created_at: new Date().toISOString()
        };

        await db.saveMediaAsset(newAsset);
        return res.status(201).json(newAsset);
      }

      // Legacy fallback
      const { base64Data } = req.body || {};
      if (base64Data) {
        const fallbackUrl = base64Data;
        const newAsset = {
          id: `media_${Date.now()}`,
          user_id: 'u1',
          file_url: fallbackUrl,
          file_type: (fileType?.startsWith('video') ? 'video' : 'image') as 'image' | 'video',
          file_name: fileName || 'unnamed_legacy',
          file_size: fileSize || 0,
          mime_type: fileType || 'image/jpeg',
          created_at: new Date().toISOString()
        };

        await db.saveMediaAsset(newAsset);
        return res.status(201).json(newAsset);
      }

      return res.status(400).json({ error: 'Invalid payload action or upload data missing.' });

    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
