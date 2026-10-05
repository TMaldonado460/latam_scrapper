import type { Ctx } from '../ctx.js';
import type { Meta } from '../types.js';
import { fetchText, NotFoundError } from '../fetcher.js';
import { Extracted, Extractor } from './extractor.js';

const DOOD_HOSTS = new Set(['doodstream.com', 'myvidplay.com', 'playmogo.com']);
const DOOD_DOMAIN_RE =
  /(^|\.)(dood|d0000?d|d0o0d|do0od|doood|doooood|doods?|ds2play|ds2video|dsvplay|vidply|all3do|do7go|doply|vide0|vvide0|d-s)\.(to|watch|so|cx|la|ws|sh|pm|wf|re|yt|li|work|pro|stream|com|co|net|club)$/;

export class DoodStream extends Extractor {
  public readonly id = 'doodstream';
  public readonly label = 'DoodStream';

  public supports(url: URL): boolean {
    return DOOD_DOMAIN_RE.test(url.host) || url.host === 'dood.to';
  }

  public async extract(url: URL, meta: Meta, _ctx: Ctx): Promise<Extracted[]> {
    const videoId = url.pathname.replace(/\/+$/, '').split('/').pop();
    if (!videoId) return [];
    let host = url.host;
    if (!DOOD_HOSTS.has(host)) host = 'playmogo.com';

    let webUrl = new URL(`https://${host}/d/${videoId}`);
    const baseReferer = `https://${host}/`;

    let res = await fetchText(webUrl, { headers: { Referer: baseReferer } });

    if (res.url !== webUrl.href) {
      const finalHost = new URL(res.url).host;
      webUrl = new URL(`https://${finalHost}/d/${videoId}`);
      res = await fetchText(webUrl, { headers: { Referer: `https://${finalHost}/` } });
    }

    let html = res.text;

    const iframeMatch = html.match(/<iframe\s*src="([^"]+)"/);
    if (iframeMatch) {
      const iframeUrl = new URL(iframeMatch[1], webUrl);
      html = (await fetchText(iframeUrl, { headers: { Referer: webUrl.href } })).text;
    } else {
      html = (await fetchText(webUrl.href.replace('/d/', '/e/'), { headers: { Referer: webUrl.href } })).text;
    }

    const match = html.match(
      /dsplayer\.hotkeys[^']+'([^']+).+?function\s*makePlay.+?return[^?]+([^"]+)/s,
    );
    if (!match) {
      if (/Video not found/i.test(html)) throw new NotFoundError('DoodStream video not found');
      throw new Error('DoodStream: video link not found');
    }

    const token = match[2];
    const passUrl = new URL(match[1], webUrl);
    const passHtml = (await fetchText(passUrl, { headers: { Referer: webUrl.href } })).text;

    let src: string;
    if (passHtml.includes('cloudflarestorage.')) {
      src = passHtml.trim();
    } else {
      src = passHtml + token + String(Date.now());
    }

    if (!/^https?:/.test(src)) throw new NotFoundError('DoodStream: invalid stream URL');
    return [{ url: new URL(src), format: 'mp4', meta, label: 'DoodStream' }];
  }
}
