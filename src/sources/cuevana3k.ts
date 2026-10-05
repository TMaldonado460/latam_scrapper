import * as cheerio from 'cheerio';
import type { Ctx } from '../ctx.js';
import type { CountryCode, Meta, SourceResult } from '../types.js';
import { fetchText, NotFoundError } from '../fetcher.js';
import { b64Decode, normalizeName } from '../utils.js';
import { Source } from './source.js';

/**
 * Cuevana3K (cuevana3k.pro) — server-rendered frontend.
 *
 * Player tabs: `.tabs-video > li.tab-video-item` (Latino / Castellano / ...),
 * each holding `li[data-server]` entries:
 *  - ?token=...  "Servidor Hyper": XOR-encrypted link to a filemoon clone /
 *    dood.li file (decoded server-side, then handled by our extractors)
 *  - ?v=<base64> vidsrc-style player page (vsembed/vidlink/videasy/vidapi),
 *    returned as an external link — the user's browser plays it.
 */
export class Cuevana3k extends Source {
  public readonly id = 'cuevana3k';
  public readonly label = 'Cuevana3K';
  public readonly contentTypes: ('movie' | 'series')[] = ['movie', 'series'];
  public readonly baseUrl = 'https://cuevana3k.pro';

  protected async scrape(ctx: Ctx): Promise<SourceResult[]> {
    const names = await ctx.getNames();
    if (!names) return [];

    let pageUrl = await this.fetchPageUrl(names.name, names.year, ctx);
    if (!pageUrl) {
      if (names.originalName && names.originalName !== names.name) {
        pageUrl = await this.fetchPageUrl(names.originalName, names.year, ctx);
      }
      if (!pageUrl) return [];
    }

    let title = names.name;

    if (ctx.imdbId.season !== undefined) {
      title += ` ${ctx.imdbId.formatSeasonAndEpisode()}`;
      const episodeUrl = await this.fetchEpisodeUrl(pageUrl, ctx.imdbId.season, ctx.imdbId.episode ?? 0);
      if (!episodeUrl) return [];
      pageUrl = episodeUrl;
    } else {
      title += ` (${names.year})`;
    }

    const html = (await fetchText(pageUrl, { headers: { Referer: pageUrl.origin } })).text;
    const $ = cheerio.load(html);

    const results: { url: URL; countryCodes: CountryCode[]; isExternal: boolean }[] = [];

    $('.tabs-video > li.tab-video-item').each((_i, li) => {
      const tabName = $(li).find('.tab-item-name').first().text().toLowerCase();
      let countryCodes: CountryCode[] | undefined;
      if (tabName.includes('latino')) countryCodes = ['mx'];
      else if (tabName.includes('castellano')) countryCodes = ['es'];
      else if (tabName.includes('multilenguaje')) countryCodes = ['mx', 'es'];
      if (!countryCodes) return;

      $(li)
        .find('li[data-server]')
        .each((_j, server) => {
          const raw = $(server).attr('data-server');
          if (!raw) return;
          try {
            const serverUrl = new URL(raw);
            let target: URL | undefined;
            let isExternal = false;

            if (serverUrl.hostname.endsWith('cuevana3k.pro') && serverUrl.searchParams.has('token')) {
              target = decodeHyperToken(serverUrl.searchParams.get('token') ?? '');
            } else if (serverUrl.searchParams.has('v')) {
              const decoded = b64Decode(serverUrl.searchParams.get('v') ?? '');
              if (/^https?:\/\//.test(decoded)) {
                target = new URL(decoded);
                isExternal = true;
              }
            } else {
              target = serverUrl;
            }

            if (target) results.push({ url: target, countryCodes, isExternal });
          } catch {
            // ignore malformed links
          }
        });
    });

    return results.map(
      ({ url, countryCodes, isExternal }): SourceResult => ({
        url,
        meta: {
          sourceId: this.id,
          sourceLabel: this.label,
          countryCodes,
          referer: pageUrl.href,
          title,
          ...(isExternal && { isExternal: true }),
        },
      }),
    );
  }

  private async fetchPageUrl(
    name: string,
    year: number,
    ctx: Ctx,
  ): Promise<URL | undefined> {
    const searchUrl = new URL(`/explorar?s=${encodeURIComponent(name)}`, this.baseUrl);
    const html = (await fetchText(searchUrl, { headers: { Referer: searchUrl.origin } })).text;
    const $ = cheerio.load(html);

    const candidates: { href: string; title: string; year: string; isSeries: boolean }[] = [];
    $('.movie-item a[href]').each((_i, a) => {
      const href = $(a).attr('href');
      if (!href) return;
      const title = $(a).find('.item-detail p').first().text().trim();
      const yearText = $(a).find('.year').first().text().trim();
      candidates.push({
        href,
        title,
        year: yearText,
        isSeries: href.includes('/serie/'),
      });
    });

    const wantSeries = ctx.imdbId.season !== undefined;
    const byType = candidates.filter((c) => c.isSeries === wantSeries);
    const pool = byType.length ? byType : candidates;

    const normName = normalizeName(name);
    // Some listings put "5 Temporadas" in the year slot instead of a year.
    const yearOk = (yearText: string) =>
      !/\d{4}/.test(yearText) || (year ? yearText.includes(String(year)) : true);

    const exact = pool.find((c) => {
      const n = normalizeName(c.title);
      return n === normName && yearOk(c.year);
    });
    if (exact) return new URL(exact.href, this.baseUrl);

    const fuzzy = pool.find((c) => {
      const n = normalizeName(c.title);
      return yearOk(c.year) && (n.includes(normName) || normName.includes(n)) && n.length > 3;
    });
    if (fuzzy) return new URL(fuzzy.href, this.baseUrl);

    return undefined;
  }

  private async fetchEpisodeUrl(
    pageUrl: URL,
    season: number,
    episode: number,
  ): Promise<URL | undefined> {
    const base = pageUrl.href.replace(/\/+$/, '');
    const direct = new URL(`${base}/episodio-${season}x${episode}`);

    try {
      const html = (await fetchText(direct, { headers: { Referer: direct.origin } })).text;
      if (html.includes('tabs-video')) return direct;
    } catch (e) {
      if (!(e instanceof NotFoundError)) throw e;
    }

    // Fallback: scan the season page for the episode link
    try {
      const seasonUrl = new URL(`${base}/temporada-${season}`);
      const html = (await fetchText(seasonUrl, { headers: { Referer: seasonUrl.origin } })).text;
      const $ = cheerio.load(html);
      let href: string | undefined;
      $(`a[href*="episodio-${season}x${episode}"]`).each((_i, a) => {
        if (!href) href = $(a).attr('href');
      });
      return href !== undefined ? new URL(href, this.baseUrl) : undefined;
    } catch {
      return undefined;
    }
  }
}

const HYPER_SERVERS: Record<string, string> = {
  '1': 'https://lkhjerbhye3wjkhodvh5xiczuvd.lol/v/',
  '2': 'https://filemoon.sx/e/',
  '3': 'https://lkhjerbhye3wjkhodvh5xlczuvd.lol/e/',
  '4': 'https://dood.li/e/',
};

const HYPER_KEY = 'a45f04ce-2394-47c3-b718-0ecd97ce51d6';

function decodeHyperToken(token: string): URL | undefined {
  const prefix = HYPER_SERVERS[token[0]];
  if (!prefix) return undefined;
  try {
    const decoded = b64Decode(token.slice(1));
    let out = '';
    for (let i = 0; i < decoded.length; i++) {
      out += String.fromCharCode(decoded.charCodeAt(i) ^ HYPER_KEY.charCodeAt(i % HYPER_KEY.length));
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(out)) return undefined;
    return new URL(prefix + out);
  } catch {
    return undefined;
  }
}
