import type { Ctx } from '../ctx.js';
import type { Meta } from '../types.js';
import { fetchText, NotFoundError } from '../fetcher.js';
import { unpackEval } from '../utils.js';
import { resolveHlsMaster } from './hlsMaster.js';
import { Extracted, Extractor } from './extractor.js';

/**
 * Fastream.to — the player host used by HomeCine.
 *
 * Master playlist tokens are single-use, so we resolve the best variant
 * here (variant playlists are reusable) and never ship the raw master.
 * Metadata (size) comes from the /d/{id} info page.
 */
export class Fastream extends Extractor {
  public readonly id = 'fastream';
  public readonly label = 'Fastream';

  public supports(url: URL): boolean {
    return url.host.includes('fastream');
  }

  public async extract(url: URL, meta: Meta, _ctx: Ctx): Promise<Extracted[]> {
    const headers = { Referer: meta.referer ?? url.origin };
    const embedUrl = new URL(url.href.replace('/e/', '/embed-').replace('/d/', '/embed-'));
    const id = url.pathname
      .replace(/\/+$/, '')
      .split('/')
      .pop()
      ?.replace(/^embed-/, '')
      .replace(/\.html$/, '');

    const html = (await fetchText(embedUrl, { headers })).text;
    if (/No such file/i.test(html)) throw new NotFoundError('Fastream: no such file');

    const unpacked = unpackEval(html);
    const fileMatch = unpacked.match(/file:\s*["'](https:[^"']+)["']/);
    if (!fileMatch) throw new NotFoundError('Fastream: stream link not found');
    const masterUrl = new URL(fileMatch[1]);

    const { url: streamUrl, height } = await resolveHlsMaster(masterUrl, headers.Referer);

    // Metadata from the /d/{id} page (does not consume the stream token)
    let bytes: number | undefined;
    try {
      const infoHtml = (await fetchText(`https://${url.host}/d/${id}`, { headers })).text;
      const sizeMatch = infoHtml.match(/([\d.]+ ?[GM]B)/);
      if (sizeMatch) {
        const num = parseFloat(sizeMatch[1]);
        bytes = Math.round(num * (sizeMatch[1].includes('G') ? 1024 * 1024 * 1024 : 1024 * 1024));
      }
    } catch {
      // info page is best-effort
    }

    return [
      {
        url: streamUrl,
        format: 'hls',
        meta: {
          ...meta,
          ...(height !== undefined && { height }),
          ...(bytes !== undefined && { bytes }),
        },
        label: 'Fastream',
      },
    ];
  }
}
