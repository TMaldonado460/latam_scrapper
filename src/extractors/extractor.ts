import type { Format, Meta } from '../types.js';
import type { Ctx } from '../ctx.js';

export interface Extracted {
  url: URL;
  format: Format;
  label?: string;
  meta: Meta;
  needsReferer?: boolean;
}

export abstract class Extractor {
  public abstract readonly id: string;
  public abstract readonly label: string;

  public abstract supports(url: URL): boolean;

  public abstract extract(url: URL, meta: Meta, ctx: Ctx): Promise<Extracted[]>;
}

export function mediaFlowUrl(
  target: URL,
  kind: 'redirect' | 'stream',
  ctx: Ctx,
  headers: Record<string, string>,
): URL | undefined {
  const mfp = ctx.config.mediaflowUrl;
  if (!mfp) return undefined;
  const url = new URL(mfp);
  const apiPassword = url.searchParams.get('api_password');
  url.searchParams.delete('api_password');
  const query = new URLSearchParams();
  query.set('d', target.href);
  for (const [k, v] of Object.entries(headers)) query.set(`h_${k}`, v);
  if (apiPassword) query.set('api_password', apiPassword);
  if (kind === 'redirect') {
    url.pathname = url.pathname.replace(/\/+$/, '') + '/proxy/redirect';
  } else {
    url.pathname = url.pathname.replace(/\/+$/, '') + '/proxy/hls/manifest.m3u8';
  }
  url.search = query.toString();
  return url;
}
