import type { ContentType, SourceResult } from '../types.js';
import type { Ctx } from '../ctx.js';
import { getCached, setCached } from '../cache.js';

export abstract class Source {
  public abstract readonly id: string;
  public abstract readonly label: string;
  public abstract readonly contentTypes: ContentType[];
  public abstract readonly baseUrl: string;

  /** Cache TTL for the raw (pre-extraction) source results. */
  public readonly ttlMs: number = 6 * 3600 * 1000;

  protected abstract scrape(ctx: Ctx): Promise<SourceResult[]>;

  public async handle(ctx: Ctx): Promise<SourceResult[]> {
    if (!this.contentTypes.includes(ctx.type)) return [];
    const cacheKey = `source:${this.id}:${ctx.imdbId.toString()}`;

    const cached = await getCached<{ url: string; meta: SourceResult['meta'] }[]>(cacheKey);
    if (cached) {
      return cached.map((r) => ({ url: new URL(r.url), meta: r.meta }));
    }

    let results: SourceResult[] = [];
    try {
      results = await this.scrape(ctx);
    } catch {
      results = [];
    }

    await setCached(
      cacheKey,
      results.map((r) => ({ url: r.url.href, meta: r.meta })),
      this.ttlMs,
    );
    return results;
  }
}
