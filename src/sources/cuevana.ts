import * as cheerio from 'cheerio';
import type { Ctx } from '../ctx.js';
import type { CountryCode, Meta, SourceResult } from '../types.js';
import { fetchText } from '../fetcher.js';
import { Source } from './source.js';

/**
 * Cuevana3 (www3.cuevana3.is) — new Next-era frontend.
 *
 * Search results and episode lists are server-rendered. The player tab
 * lists (`.open_submenu > .sub-tab-lang > .clili[data-tr]`) are only
 * present when Cloudflare does not gate the request, so this source
 * degrades gracefully to no results.
 */
export class Cuevana extends Source {
  public readonly id = 'cuevana';
  public readonly label = 'Cuevana3';
  public readonly contentTypes: ('movie' | 'series')[] = ['movie', 'series'];
  public readonly baseUrl = 'https://www3.cuevana3.is';

  protected async scrape(ctx: Ctx): Promise<SourceResult[]> {
    const names = await ctx.getNames();
    if (!names) return [];

    let pageUrl = await this.fetchPageUrl(names.name, names.year);
    if (!pageUrl) {
      if (names.originalName && names.originalName !== names.name) {
        pageUrl = await this.fetchPageUrl(names.originalName, names.year);
      }
      if (!pageUrl) return [];
    }

    let title = names.name;

    if (ctx.imdbId.season !== undefined) {
      title += ` ${ctx.imdbId.formatSeasonAndEpisode()}`;
      const episodeUrl = await this.fetchEpisodeUrl(
        pageUrl,
        ctx.imdbId.season,
        ctx.imdbId.episode ?? 0,
      );
      if (!episodeUrl) return [];
      pageUrl = episodeUrl;
    } else {
      title += ` (${names.year})`;
    }

    const html = (await fetchText(pageUrl, { headers: { Referer: pageUrl.origin } })).text;
    const $ = cheerio.load(html);

    const results: { url: URL; countryCodes: CountryCode[]; title?: string }[] = [];

    // New theme: player tabs hold clili items with data-tr / data-video links
    $('.open_submenu, .sub-tab-lang').each((_i, el) => {
      $(el)
        .find('.clili, [data-tr], [data-video]')
        .each((_j, sub) => {
          const raw = $(sub).attr('data-tr') ?? $(sub).attr('data-video');
          if (!raw) return;
          const text = $(sub).text().toLowerCase();
          let countryCodes: CountryCode[];
          if (text.includes('latino')) countryCodes = ['mx'];
          else if (text.includes('castellano') || text.includes('español') || text.includes('spanish'))
            countryCodes = ['es'];
          else countryCodes = ['mx', 'es'];
          try {
            results.push({ url: new URL(raw, pageUrl.origin), countryCodes });
          } catch {
            // ignore malformed links
          }
        });
    });

    return Promise.all(
      results.map(async ({ url, countryCodes }): Promise<SourceResult> => {
        const meta: Meta = {
          sourceId: this.id,
          sourceLabel: this.label,
          countryCodes,
          referer: pageUrl.href,
          title,
        };
        if (!url.host.includes('cuevana3')) return { url, meta };

        // cuevana goto links: /ir/goto_ddh.php?h=... → tiny page with url = '...'
        const res = await fetchText(url, { headers: { Referer: pageUrl.origin } });
        const urlMatch = res.text.match(/url ?= ?'(.*)'/);
        if (!urlMatch) return { url, meta };
        return { url: new URL(urlMatch[1]), meta };
      }),
    );
  }

  private async fetchPageUrl(name: string, year: number): Promise<URL | undefined> {
    const searchUrl = new URL(`/search/${encodeURIComponent(name)}/`, this.baseUrl);
    const html = (await fetchText(searchUrl, { headers: { Referer: searchUrl.origin } })).text;
    const $ = cheerio.load(html);

    let href: string | undefined;

    $('.TPost a[href]').each((_i, a) => {
      if (href) return;
      const text = $(a).find('h2.Title').first().text().trim();
      if (!text) return;
      const nameOk = text.toLowerCase().includes(name.toLowerCase());
      const yearOk = year ? text.includes(String(year)) : true;
      if (nameOk && yearOk) {
        href = $(a).attr('href');
      }
    });

    if (!href) return undefined;
    return new URL(href, searchUrl.origin);
  }

  private async fetchEpisodeUrl(
    pageUrl: URL,
    season: number,
    episode: number,
  ): Promise<URL | undefined> {
    const html = (await fetchText(pageUrl, { headers: { Referer: pageUrl.origin } })).text;
    const $ = cheerio.load(html);
    const needle = `${season}x${episode}`;

    let href: string | undefined;
    $('.all-episodes .TPost .Year, .TPost .Year').each((_i, el) => {
      if (!href && $(el).text().trim() === needle) {
        href = $(el).closest('a').attr('href');
      }
    });

    return href !== undefined ? new URL(href, pageUrl.origin) : undefined;
  }
}
