export type ContentType = 'movie' | 'series';
export type CountryCode = 'es' | 'mx';
export type Format = 'mp4' | 'hls' | 'unknown';

export const COUNTRY_FLAGS: Record<CountryCode, string> = {
  es: '🇪🇸',
  mx: '🇲🇽',
};

export interface Config {
  langs: CountryCode[];
  minHeight: number;
  showExternal: boolean;
  sources: string[];
  mediaflowUrl?: string;
}

export interface Meta {
  sourceId: string;
  sourceLabel: string;
  countryCodes: CountryCode[];
  referer?: string;
  title?: string;
  height?: number;
  bytes?: number;
  isExternal?: boolean;
}

export interface SourceResult {
  url: URL;
  meta: Meta;
}

export interface StreamInfo {
  url: URL;
  format: Format;
  label: string;
  meta: Meta;
  error?: string;
  isExternal?: boolean;
  needsReferer?: boolean;
}

export interface StremioStream {
  name: string;
  title: string;
  url?: string;
  externalUrl?: string;
  behaviorHints?: Record<string, unknown>;
}

export interface StreamResponse {
  streams: StremioStream[];
  cacheControl?: { maxAge: number; staleError: number };
}
