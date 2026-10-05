import { fetchJson } from './fetcher.js';
import { getCached, setCached } from './cache.js';
import { ImdbId } from './id.js';

interface CinemetaMeta {
  meta?: {
    name?: string;
    year?: string;
  };
}

export async function getCinemetaMeta(imdbId: ImdbId): Promise<{ name: string; year: number } | undefined> {
  const type = imdbId.season !== undefined ? 'series' : 'movie';
  const cacheKey = `cinemeta:${type}:${imdbId.id}`;

  const cached = await getCached<{ name: string; year: number }>(cacheKey);
  if (cached) return cached;

  try {
    const res = (await fetchJson(
      `https://v3-cinemeta.strem.io/meta/${type}/${imdbId.id}.json`,
    )) as CinemetaMeta;
    if (!res.meta?.name) return undefined;
    const result = {
      name: res.meta.name,
      year: res.meta.year ? parseInt(res.meta.year, 10) : 0,
    };
    await setCached(cacheKey, result, 30 * 24 * 3600 * 1000);
    return result;
  } catch {
    return undefined;
  }
}
