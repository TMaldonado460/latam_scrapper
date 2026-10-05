import type { Config, ContentType } from './types.js';
import { ImdbId, TmdbId } from './id.js';
import { getTmdbIdFromImdbId, getTmdbNameAndYear } from './tmdb.js';
import { getCinemetaMeta } from './cinemeta.js';

export interface Names {
  name: string;
  year: number;
  originalName: string;
}

/**
 * Per-request context: caches metadata lookups so all sources
 * share the same TMDB / Cinemeta results.
 */
export class Ctx {
  public readonly imdbId: ImdbId;
  public readonly type: ContentType;
  public readonly config: Config;
  public readonly remoteIp?: string;

  private tmdbPromise?: Promise<TmdbId | undefined>;
  private namesPromise?: Promise<Names | undefined>;

  public constructor(imdbId: ImdbId, type: ContentType, config: Config, remoteIp?: string) {
    this.imdbId = imdbId;
    this.type = type;
    this.config = config;
    this.remoteIp = remoteIp;
  }

  public getTmdbId(): Promise<TmdbId | undefined> {
    if (!this.tmdbPromise) {
      this.tmdbPromise = getTmdbIdFromImdbId(this.imdbId);
    }
    return this.tmdbPromise;
  }

  public getNames(): Promise<Names | undefined> {
    if (!this.namesPromise) {
      this.namesPromise = (async () => {
        const tmdbId = await this.getTmdbId();
        if (tmdbId) {
          const names = await getTmdbNameAndYear(tmdbId, 'es');
          if (names && names[0]) return { name: names[0], year: names[1], originalName: names[2] };
          if (names) {
            const meta = await getCinemetaMeta(this.imdbId);
            if (meta) return { name: meta.name, year: meta.year, originalName: meta.name };
          }
        }
        const meta = await getCinemetaMeta(this.imdbId);
        if (!meta) return undefined;
        return { name: meta.name, year: meta.year, originalName: meta.name };
      })();
    }
    return this.namesPromise;
  }
}
