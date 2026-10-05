import { fetchJson } from './fetcher.js';
import { getCached, setCached } from './cache.js';
import { ImdbId, TmdbId } from './id.js';

const token = process.env.TMDB_TOKEN?.trim();

export function hasTmdb(): boolean {
  return Boolean(token);
}

interface FindResponse {
  movie_results?: { id: number }[];
  tv_results?: { id: number }[];
}

interface TmdbDetails {
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  release_date?: string;
  first_air_date?: string;
}

async function tmdbFetch(path: string, params: Record<string, string> = {}): Promise<unknown> {
  const url = new URL(`https://api.themoviedb.org/3${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v) url.searchParams.set(k, v);
  }
  const headers: Record<string, string> = {};
  if (token?.startsWith('ey')) {
    headers.Authorization = `Bearer ${token}`;
  } else if (token) {
    url.searchParams.set('api_key', token);
  } else {
    throw new Error('TMDB token not configured');
  }
  return fetchJson(url, { headers });
}

const imdbTmdbMap = new Map<string, number>();

export async function getTmdbIdFromImdbId(imdbId: ImdbId): Promise<TmdbId | undefined> {
  if (!hasTmdb()) return undefined;

  const cacheKey = `tmdb:find:${imdbId.id}`;
  const cached = await getCached<number>(cacheKey);
  if (cached !== undefined) {
    return new TmdbId(cached, imdbId.season, imdbId.episode);
  }
  if (imdbTmdbMap.has(imdbId.id)) {
    return new TmdbId(imdbTmdbMap.get(imdbId.id) as number, imdbId.season, imdbId.episode);
  }

  try {
    const res = (await tmdbFetch(`/find/${imdbId.id}`, {
      external_source: 'imdb_id',
    })) as FindResponse;
    const id = (imdbId.season !== undefined ? res.tv_results : res.movie_results)?.[0]?.id;
    if (!id) return undefined;
    imdbTmdbMap.set(imdbId.id, id);
    await setCached(cacheKey, id, 30 * 24 * 3600 * 1000);
    return new TmdbId(id, imdbId.season, imdbId.episode);
  } catch {
    return undefined;
  }
}

export async function getTmdbNameAndYear(
  tmdbId: TmdbId,
  language = 'es',
): Promise<[string, number, string] | undefined> {
  if (!hasTmdb()) return undefined;
  try {
    if (tmdbId.season !== undefined) {
      const res = (await tmdbFetch(`/tv/${tmdbId.id}`, { language })) as TmdbDetails;
      const year = res.first_air_date ? new Date(res.first_air_date).getFullYear() : 0;
      return [res.name ?? res.original_name ?? '', year, res.original_name ?? res.name ?? ''];
    }
    const res = (await tmdbFetch(`/movie/${tmdbId.id}`, { language })) as TmdbDetails;
    const year = res.release_date ? new Date(res.release_date).getFullYear() : 0;
    return [res.title ?? res.original_title ?? '', year, res.original_title ?? res.title ?? ''];
  } catch {
    return undefined;
  }
}
