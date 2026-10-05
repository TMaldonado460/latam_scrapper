import type { Config, CountryCode } from './types.js';

export const SOURCE_IDS = ['cuevana', 'cuevana3k', 'homecine', 'unlimplay'] as const;
export type SourceId = (typeof SOURCE_IDS)[number];

const isLang = (v: string): v is CountryCode => v === 'es' || v === 'mx';

export function parseConfig(params: URLSearchParams): Config {
  const langs = (params.get('lang') ?? 'mx,es')
    .split(',')
    .map((s) => s.trim())
    .filter(isLang);
  const minHeight = Math.max(0, parseInt(params.get('minHeight') ?? '0', 10) || 0);
  const showExternal = params.get('showExternal') === '1';
  const sources = (params.get('sources') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s): s is SourceId => (SOURCE_IDS as readonly string[]).includes(s));
  const mediaflowUrl = params.get('mediaflow')?.trim() || undefined;

  return {
    langs: langs.length ? langs : ['mx', 'es'],
    minHeight,
    showExternal,
    sources: sources.length ? sources : [...SOURCE_IDS],
    ...(mediaflowUrl && { mediaflowUrl }),
  };
}

export function configToQuery(config: Config): string {
  const params = new URLSearchParams();
  params.set('lang', config.langs.join(','));
  if (config.minHeight) params.set('minHeight', String(config.minHeight));
  if (config.showExternal) params.set('showExternal', '1');
  params.set('sources', config.sources.join(','));
  if (config.mediaflowUrl) params.set('mediaflow', config.mediaflowUrl);
  return params.toString();
}
