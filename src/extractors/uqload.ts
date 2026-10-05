import type { Ctx } from '../ctx.js';
import type { Meta } from '../types.js';
import { fetchText, NotFoundError } from '../fetcher.js';
import { Extracted, Extractor } from './extractor.js';

export class Uqload extends Extractor {
  public readonly id = 'uqload';
  public readonly label = 'Uqload';

  public supports(url: URL): boolean {
    return /(^|\.)uqload\./.test(url.host);
  }

  public async extract(url: URL, meta: Meta, _ctx: Ctx): Promise<Extracted[]> {
    const videoId = url.pathname.replace(/\/+$/, '').split('/').pop();
    if (!videoId) return [];

    const html = (await fetchText(`https://uqload.vc/embed-${videoId}.html`)).text;
    if (/File Not Found/i.test(html)) throw new NotFoundError('Uqload: file not found');

    const match = html.match(/sources:\s*\[{\s*file:\s*['"]([^'"]+)['"]/);
    if (!match) throw new NotFoundError('Uqload: stream link not found');
    return [{ url: new URL(match[1]), format: 'mp4', meta, label: 'Uqload' }];
  }
}
