import type { Ctx } from '../ctx.js';
import type { Meta } from '../types.js';
import { fetchText, HttpError, NotFoundError } from '../fetcher.js';
import { Extracted, Extractor } from './extractor.js';

const STREAMTAPE_HOST_RE =
  /(^|\.)(streamtape|strtape|streamta|strcloud|strtpe|scloud|stape|shavetape|streamadblockplus|streamadblocker|tapewithadblock|adblocktape|antiadtape|tapeblocker|streamnoads|tapeadvertisement|tapeadsenjoyer|watchadsontape|tpead|advertape|gettapeads|advtpe)\.(com|cloud|net|pe|site|link|cc|online|fun|cash|to|xyz|org|wiki|club|me|art)$/;

function decodeSrc(raw: string): string {
  const cleaned = raw.replace(/["']/g, '"').replace(/^"|"$/g, '');
  const parts = cleaned.split('+');
  let out = '';
  for (const part of parts) {
    const p1 = part.match(/"([^"]*)/)?.[1] ?? '';
    let p2 = 0;
    for (const sub of part.matchAll(/substring\((\d+)\)/g)) {
      p2 += parseInt(sub[1], 10);
    }
    out += p1.slice(p2);
  }
  return out;
}

export class Streamtape extends Extractor {
  public readonly id = 'streamtape';
  public readonly label = 'Streamtape';

  public supports(url: URL): boolean {
    return STREAMTAPE_HOST_RE.test(url.host) || url.host === 'streamtape.com';
  }

  public async extract(url: URL, meta: Meta, _ctx: Ctx): Promise<Extracted[]> {
    const videoId = url.pathname.replace(/\/+$/, '').split('/').pop();
    if (!videoId) return [];
    const host = url.host;
    const webUrl = new URL(`https://${host}/e/${videoId}`);
    const headers = { Referer: `https://${host}/` };

    let html: string;
    try {
      html = (await fetchText(webUrl, { headers })).text;
    } catch (e) {
      if (e instanceof HttpError && e.status === 503) {
        throw new Error('Streamtape: Cloudflare DDOS protection');
      }
      throw new NotFoundError('Streamtape: video deleted or removed');
    }

    const matches = Array.from(html.matchAll(/ById\('.+?=\s*(["']\/\/[^;<]+)/g));
    const raw = matches.length ? matches[matches.length - 1][1] : undefined;
    if (!raw) throw new NotFoundError('Streamtape: video cannot be located');

    let srcUrl = decodeSrc(raw);
    srcUrl += '&stream=1';
    if (srcUrl.startsWith('//')) srcUrl = `https:${srcUrl}`;

    const res = await fetchText(srcUrl, { headers: { Referer: webUrl.href } });
    if (!/\.(mp4|m3u8)(\?|$)/.test(res.url)) {
      throw new NotFoundError('Streamtape: no playable URL after redirect');
    }
    return [{ url: new URL(res.url), format: 'mp4', meta, label: 'Streamtape' }];
  }
}
