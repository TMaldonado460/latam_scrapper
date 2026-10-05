import type { Ctx } from '../ctx.js';
import type { Meta } from '../types.js';
import { Extracted, Extractor, mediaFlowUrl } from './extractor.js';

export class External extends Extractor {
  public readonly id = 'external';
  public readonly label = 'External';

  public supports(_url: URL): boolean {
    return true;
  }

  public async extract(url: URL, meta: Meta, ctx: Ctx): Promise<Extracted[]> {
    if (!ctx.config.showExternal) return [];
    const wrapped = mediaFlowUrl(url, 'redirect', ctx, {});
    return [
      {
        url: wrapped ?? url,
        format: 'unknown',
        label: url.host,
        meta,
        needsReferer: Boolean(wrapped),
      },
    ];
  }
}
