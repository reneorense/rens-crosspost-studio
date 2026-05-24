import { PlatformConnector } from './types';
import { FacebookConnector } from './facebook';
import { InstagramConnector } from './instagram';
import { TikTokConnector } from './tiktok';
import { XConnector } from './x';
import { LinkedInConnector } from './linkedin';
import { YouTubeConnector } from './youtube';
import { PinterestConnector } from './pinterest';
import { ThreadsConnector } from './threads';

export const Connectors: Record<string, PlatformConnector> = {
  facebook: FacebookConnector,
  instagram: InstagramConnector,
  tiktok: TikTokConnector,
  x: XConnector,
  linkedin: LinkedInConnector,
  youtube: YouTubeConnector,
  pinterest: PinterestConnector,
  threads: ThreadsConnector
};

export function getConnector(platform: string): PlatformConnector {
  const connector = Connectors[platform.toLowerCase()];
  if (!connector) {
    throw new Error(`Unsupported visual platform connector: ${platform}`);
  }
  return connector;
}
