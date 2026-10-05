import { fetchText } from '../fetcher.js';

export interface ResolvedHls {
  url: URL;
  height?: number;
}

/**
 * Master playlists on fastream-style CDNs (acek-cdn, dramiyos-cdn, s40.fastream.to…)
 * have single-use tokens, but the variant playlists listed inside are reusable.
 * To survive player retries we resolve the best variant here and return it
 * directly. If the master fetch fails for any reason we fall back to the
 * master URL itself (the player's first fetch would still succeed).
 */
export async function resolveHlsMaster(masterUrl: URL, referer?: string): Promise<ResolvedHls> {
  try {
    const res = await fetchText(masterUrl, {
      timeout: 8000,
      ...(referer && { headers: { Referer: referer } }),
    });
    const variants = Array.from(
      res.text.matchAll(/RESOLUTION=(\d+)x(\d+)[^\n]*\n([^\n]+)/g),
      (m) => ({
        height: parseInt(m[2], 10),
        url: m[3].trim(),
      }),
    ).filter((v) => v.url && !v.url.startsWith('#'));
    if (!variants.length) return { url: masterUrl };
    const best = variants.reduce((a, b) => (a.height > b.height ? a : b));
    return { url: new URL(best.url, masterUrl), height: best.height };
  } catch {
    return { url: masterUrl };
  }
}
