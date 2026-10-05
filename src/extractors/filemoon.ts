import type { Ctx } from '../ctx.js';
import type { Meta } from '../types.js';
import { fetchText, NotFoundError } from '../fetcher.js';
import { unpackEval } from '../utils.js';
import { Extracted, Extractor } from './extractor.js';

const FILEMOON_HOST_RE =
  /(^|\.)(filemoon\.(sx|art|com|org|net|info|xyz|top|cc|to)|1azayf9w\.xyz|222i8x\.lol|81u6xl9d\.xyz|8mhlloqo\.fun|96ar\.com|bf0skv\.org|boosteradx\.online|c1z39\.com|cinegrab\.com|f51rm\.com|furher\.in|kerapoxy\.cc|l1afav\.net|moonmov\.pro|smdfs40r\.skin|xcoic\.com|z1ekv717\.fun)$/;

export class FileMoon extends Extractor {
  public readonly id = 'filemoon';
  public readonly label = 'FileMoon';

  public supports(url: URL): boolean {
    return FILEMOON_HOST_RE.test(url.host);
  }

  public async extract(url: URL, meta: Meta, _ctx: Ctx): Promise<Extracted[]> {
    const host = url.host;
    const pathId = url.pathname.replace(/\/+$/, '').replace(/^\/(e|d)\//, '').replace(/\//g, '/');
    const headers = { Referer: meta.referer ?? `https://${host}/` };

    let html: string;
    try {
      html = (await fetchText(`https://${host}/d/${pathId}`, { headers })).text;
    } catch (e) {
      if (e instanceof NotFoundError) {
        // new-style player path: https://{host}/{id}/stream
        const res = await fetchText(`https://${host}/${pathId}/stream`, { headers });
        const linkMatch = res.text.match(/<a\s*href="([^"]+)"/);
        if (linkMatch && /m3u8|\.mp4/.test(linkMatch[1])) {
          const streamUrl = new URL(linkMatch[1].replace(/&amp;/g, '&'));
          return [
            {
              url: streamUrl,
              format: streamUrl.href.includes('m3u8') ? 'hls' : 'mp4',
              meta,
              label: 'FileMoon',
            },
          ];
        }
      }
      throw e;
    }

    if (/Page not found/i.test(html)) throw new NotFoundError('FileMoon: page not found');

    // Follow nested iframes (adblock catchers)
    const iframes = Array.from(html.matchAll(/iframe.*?src=["'](.*?)["']/g));
    if (iframes.length) {
      const last = iframes[iframes.length - 1][1];
      const iframeUrl = new URL(last, `https://${host}/`);
      html = (await fetchText(iframeUrl, { headers })).text;
    }

    const unpacked = unpackEval(html);
    const fileMatch = unpacked.match(/file:\s*["']([^"']+)["']/);
    if (!fileMatch) throw new NotFoundError('FileMoon: stream link not found');
    const streamUrl = new URL(fileMatch[1].replace(/\\\//g, '/'));

    const heightMatch = unpacked.match(/(\d{3,})p/);
    return [
      {
        url: streamUrl,
        format: 'hls',
        meta: {
          ...meta,
          ...(heightMatch && { height: parseInt(heightMatch[1], 10) }),
        },
        label: 'FileMoon',
      },
    ];
  }
}
