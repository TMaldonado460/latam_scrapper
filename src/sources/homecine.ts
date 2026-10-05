import * as cheerio from 'cheerio';
import type { Ctx } from '../ctx.js';
import type { CountryCode, Meta, SourceResult } from '../types.js';
import { fetchText } from '../fetcher.js';
import { levenshtein } from '../utils.js';
import { Source } from './source.js';

/**
 * HomeCine (www3.homecine.to) — WordPress theme with tabbed players.
 * Server-rendered: search (`a[oldtitle]`), seasons (`#seasons a`) and
 * player tabs (`#tabN .movieplay iframe`).
 */
export class HomeCine extends Source {
  public readonly id = 'homecine';
  public readonly label = 'HomeCine';
  public readonly contentTypes: ('movie' | 'series')[] = ['movie', 'series'];
  public readonly baseUrl = 'https://www3.homecine.to';

  protected async scrape(ctx: Ctx): Promise<SourceResult[]> {
    const names = await ctx.getNames();
    if (!names) return [];

    let pageUrl = await this.fetchPageUrl(names.name);
    if (!pageUrl) {
      pageUrl = await this.fetchPageUrl(names.originalName);
      if (!pageUrl) return [];
    }

    let pageHtml = (await fetchText(pageUrl)).text;

    let title = names.name;
    if (ctx.imdbId.season !== undefined) {
      title += ` ${ctx.imdbId.formatSeasonAndEpisode()}`;
      const episodeUrl = this.fetchEpisodeUrl(
        pageHtml,
        ctx.imdbId.season,
        ctx.imdbId.episode ?? 0,
      );
      if (!episodeUrl) return [];
      pageUrl = episodeUrl;
      pageHtml = (await fetchText(pageUrl)).text;
    } else {
      title += ` (${names.year})`;
    }

    const $ = cheerio.load(pageHtml);
    const results: { url: URL; countryCodes: CountryCode[]; height?: number }[] = [];

    // Tabs: .player_nav .les-content a href="#tabN" with text "HD 1080p - Latino"
    const tabIndexes: { index: string; countryCodes: CountryCode[]; height?: number }[] = [];
    $('.player_nav .les-content a').each((_i, a) => {
      const tabId = $(a).attr('href');
      const text = $(a).text().toLowerCase();
      if (!tabId || !tabId.startsWith('#')) return;

      let countryCodes: CountryCode[] | undefined;
      if (text.includes('latino')) countryCodes = ['mx'];
      else if (text.includes('castellano')) countryCodes = ['es'];
      if (!countryCodes) return;

      const heightMatch = text.match(/(\d{3,4})p/);
      tabIndexes.push({
        index: tabId.slice(1),
        countryCodes,
        ...(heightMatch && { height: parseInt(heightMatch[1], 10) }),
      });
    });

    for (const tab of tabIndexes) {
      const iframeSrc = $(`#${tab.index} .movieplay iframe`).attr('src');
      if (!iframeSrc) continue;
      try {
        results.push({
          url: new URL(iframeSrc.startsWith('//') ? `https:${iframeSrc}` : iframeSrc, pageUrl.origin),
          countryCodes: tab.countryCodes,
          ...(tab.height && { height: tab.height }),
        });
      } catch {
        // ignore
      }
    }

    return results.map(
      ({ url, countryCodes, height }): SourceResult => ({
        url,
        meta: {
          sourceId: this.id,
          sourceLabel: this.label,
          countryCodes,
          referer: pageUrl.href,
          title,
          ...(height && { height }),
        },
      }),
    );
  }

  private async fetchPageUrl(name: string): Promise<URL | undefined> {
    const searchUrl = new URL(`/?s=${encodeURIComponent(name)}`, this.baseUrl);
    const html = (await fetchText(searchUrl)).text;
    const $ = cheerio.load(html);

    const keywords = [...new Set([name, name.replace('-', '–')])];

    let urls: URL[] = [];

    for (const keyword of keywords) {
      urls = urls.concat(
        $(`a[oldtitle="${keyword}"]`)
          .map((_i, el) => new URL($(el).attr('href') as string, this.baseUrl))
          .toArray(),
      );
    }

    if (!urls.length) {
      for (const keyword of keywords) {
        urls = urls.concat(
          $('a[oldtitle]')
            .filter((_i, el) => levenshtein(($(el).attr('oldtitle') as string).trim(), keyword) < 5)
            .map((_i, el) => new URL($(el).attr('href') as string, this.baseUrl))
            .toArray(),
        );
      }
    }

    return urls[0];
  }

  private fetchEpisodeUrl(pageHtml: string, season: number, episode: number): URL | undefined {
    const $ = cheerio.load(pageHtml);
    const needle = `-temporada-${season}-capitulo-${episode}`;
    const href = $('#seasons a')
      .map((_i, el) => $(el).attr('href') as string)
      .toArray()
      .find((url) => url.endsWith(needle));
    return href !== undefined ? new URL(href, this.baseUrl) : undefined;
  }
}
