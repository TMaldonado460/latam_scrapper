import type { Ctx } from '../ctx.js';
import type { SourceResult } from '../types.js';
import { Source } from './source.js';

/**
 * Unlimplay is a dooplay-ecosystem player host used by CineHDPlus and
 * many other latino sites. It IP-blocks datacenter traffic, so instead
 * of extracting anything we hand the embed URL to the client as an
 * external link — the user's own device opens it directly.
 *
 * Embed patterns:
 *   TV:     https://unlimplay.com/f/embed/tv/{imdb}/{season}/{episode}
 *   Movie:  https://unlimplay.com/f/embed/movie/{imdb}
 */
export class Unlimplay extends Source {
  public readonly id = 'unlimplay';
  public readonly label = 'Unlimplay';
  public readonly contentTypes: ('movie' | 'series')[] = ['movie', 'series'];
  public readonly baseUrl = 'https://unlimplay.com';

  protected async scrape(ctx: Ctx): Promise<SourceResult[]> {
    const imdbId = ctx.imdbId;
    let path: string;
    if (imdbId.season !== undefined) {
      path = `/f/embed/tv/${imdbId.id}/${imdbId.season}/${imdbId.episode}`;
    } else {
      path = `/f/embed/movie/${imdbId.id}`;
    }
    const url = new URL(path, this.baseUrl);
    const title = imdbId.season !== undefined
      ? `${imdbId.id} ${imdbId.formatSeasonAndEpisode()}`
      : imdbId.id;

    return [
      {
        url,
        meta: {
          sourceId: this.id,
          sourceLabel: this.label,
          countryCodes: ['mx', 'es'],
          title,
          isExternal: true,
        },
      },
    ];
  }
}
