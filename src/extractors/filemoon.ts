import type { Ctx } from '../ctx.js';
import type { Meta } from '../types.js';
import { fetchText, NotFoundError } from '../fetcher.js';
import { unpackEval } from '../utils.js';
import { resolveHlsMaster } from './hlsMaster.js';
import { Extracted, Extractor } from './extractor.js';

const FILEMOON_HOST_RE =
  /(^|\.)(filemoon\.(sx|art|com|org|net|info|xyz|top|cc|to)|1azayf9w\.xyz|222i8x\.lol|81u6xl9d\.xyz|8mhlloqo\.fun|96ar\.com|bf0skv\.org|boosteradx\.online|c1z39\.com|cinegrab\.com|f51rm\.com|furher\.in|kerapoxy\.cc|l1afav\.net|moonmov\.pro|smdfs40r\.skin|xcoic\.com|z1ekv717\.fun)$/;

/** Filemoon clones rotate through .lol domains (e.g. cuevana3k's Hyper server). */
const FILEMOON_CLONE_RE = /\.lol$/;

export class FileMoon extends Extractor {
  public readonly id = 'filemoon';
  public readonly label = 'FileMoon';

  public supports(url: URL): boolean {
    return FILEMOON_HOST_RE.test(url.host) || FILEMOON_CLONE_RE.test(url.host);
  }

  public async extract(url: URL, meta: Meta, _ctx: Ctx): Promise<Extracted[]> {
    const host = url.host;
    const isClone = FILEMOON_CLONE_RE.test(host) && !FILEMOON_HOST_RE.test(host);
    const pathId = url.pathname
      .replace(/\/+$/, '')
      .replace(/^\/(e|d|v)\//, '');
    const headers = { Referer: meta.referer ?? `https://${host}/` };

    let html: string;

    if (isClone) {
      // clones embed directly at /v/{id} or /e/{id}
      const embedPath = url.pathname.startsWith('/v/')
        ? `/v/${pathId}`
        : `/e/${pathId}`;
      try {
        html = (await fetchText(`https://${host}${embedPath}`, { headers })).text;
      } catch (e) {
        if (e instanceof NotFoundError) throw new NotFoundError('FileMoon: file not found');
        throw e;
      }
    } else {
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

    let fileMatch = unpacked.match(/file:\s*["']((?:https?:)?\/\/[^"']+\.m3u8[^"']*)["']/);
    if (!fileMatch) {
      // classic filemoon: file:"https://..." (any extension)
      fileMatch = unpacked.match(/file:\s*["'](https?:\/\/[^"']+)["']/);
    }
    if (!fileMatch) {
      // pixibay-style clones: var links={"hls2":"https://...m3u8?...","hls3":"...master.txt"}
      fileMatch = unpacked.match(/["']hls\d+["']\s*:\s*["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/);
    }
    if (!fileMatch) throw new NotFoundError('FileMoon: stream link not found');

    let rawStreamUrl = fileMatch[1].replace(/\\\//g, '/');
    if (rawStreamUrl.startsWith('//')) rawStreamUrl = `https:${rawStreamUrl}`;
    const masterUrl = new URL(rawStreamUrl);

    // Resolve the best variant (master tokens are single-use on these CDNs)
    const { url: streamUrl, height } = await resolveHlsMaster(masterUrl, headers.Referer);

    return [
      {
        url: streamUrl,
        format: 'hls',
        meta: {
          ...meta,
          ...(height !== undefined && { height }),
        },
        label: 'FileMoon',
      },
    ];
  }
}
