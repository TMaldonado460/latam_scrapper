import type { Ctx } from './ctx.js';
import type { Meta, StremioStream, StreamInfo, StreamResponse } from './types.js';
import { allSources } from './sources/index.js';
import type { Source } from './sources/source.js';
import { extractUrl } from './extractors/registry.js';
import { withTimeout, flagFromCountryCode, getClosestResolution } from './utils.js';
import { APP_NAME } from './utils.js';

const SOURCE_TIMEOUT_MS = 15000;

function buildName(info: StreamInfo): string {
  let name = `${APP_NAME} [${info.meta.sourceLabel}]`;
  for (const cc of info.meta.countryCodes) name += ` ${flagFromCountryCode(cc)}`;
  const res = getClosestResolution(info.meta.height);
  if (res) name += ` ${res}`;
  return name;
}

function buildTitle(info: StreamInfo): string {
  const lines: string[] = [];
  if (info.meta.title) lines.push(info.meta.title);
  const lang =
    info.meta.countryCodes[0] === 'mx'
      ? 'Latino'
      : info.meta.countryCodes[0] === 'es'
        ? 'Castellano'
        : '';
  const parts: string[] = [];
  if (lang) parts.push(`🗣 ${lang}`);
  if (info.meta.height) parts.push(`📺 ${getClosestResolution(info.meta.height)}`);
  parts.push(`🔗 ${info.label}`);
  if (info.meta.bytes) parts.push(`💾 ${Math.round(info.meta.bytes / 1048576)} MB`);
  lines.push(parts.join(' '));
  if (info.error) lines.push(`⚠️ ${info.error}`);
  return lines.join('\n');
}

function toStream(info: StreamInfo, isExternal: boolean): StremioStream {
  const base: StremioStream = {
    name: buildName(info),
    title: buildTitle(info),
    behaviorHints: {
      bingeGroup: `${info.meta.sourceId}-${info.meta.countryCodes.join('_')}`,
    },
  };
  if (isExternal) {
    return { ...base, externalUrl: info.url.href };
  }
  return { ...base, url: info.url.href };
}

async function handleSource(ctx: Ctx, source: Source, results: StreamInfo[]): Promise<void> {
  const sourceResults = await withTimeout(source.handle(ctx), SOURCE_TIMEOUT_MS, source.id);

  for (const sr of sourceResults) {
    if (sr.meta.isExternal) {
      results.push({
        url: sr.url,
        format: 'unknown',
        label: 'Externo',
        meta: sr.meta,
        isExternal: true,
      });
      continue;
    }

    let extracted: Awaited<ReturnType<typeof extractUrl>>;
    try {
      extracted = await withTimeout(
        extractUrl(sr.url, sr.meta, ctx),
        SOURCE_TIMEOUT_MS,
        `${source.id} extractor`,
      );
    } catch (e) {
      console.error(`[${source.id}] extractor failed for ${sr.url.href}:`, e);
      extracted = [];
    }
    for (const ex of extracted) {
      results.push({
        url: ex.url,
        format: ex.format,
        label: ex.label ?? 'Stream',
        meta: { ...sr.meta, ...ex.meta },
        error: (ex as { error?: string }).error,
        needsReferer: ex.needsReferer,
      });
    }
  }
}

function dedupeAndFilter(info: StreamInfo[], ctx: Ctx): StreamInfo[] {
  const seen = new Set<string>();
  return info.filter((i) => {
    const key = i.url.href;
    if (seen.has(key)) return false;
    seen.add(key);
    if (!i.meta.countryCodes.some((cc) => ctx.config.langs.includes(cc))) return false;
    if (i.meta.height && i.meta.height < ctx.config.minHeight) return false;
    return true;
  });
}

export async function resolveStreams(ctx: Ctx): Promise<StreamResponse> {
  const sources = allSources.filter(
    (s) =>
      s.contentTypes.includes(ctx.type) &&
      (ctx.config.sources.length === 0 || ctx.config.sources.includes(s.id)),
  );

  const info: StreamInfo[] = [];
  await Promise.all(
    sources.map(async (source) => {
      try {
        await handleSource(ctx, source, info);
      } catch (e) {
        console.error(`[${source.id}] failed:`, e);
      }
    }),
  );

  const filtered = dedupeAndFilter(info, ctx);

  filtered.sort((a, b) => {
    if (a.error || b.error) return a.error ? 1 : -1;
    if ((a.isExternal ?? false) !== (b.isExternal ?? false)) return a.isExternal ? 1 : -1;
    const h = (b.meta.height ?? 0) - (a.meta.height ?? 0);
    if (h !== 0) return h;
    return a.label.localeCompare(b.label);
  });

  const streams = filtered.map((i) => toStream(i, Boolean(i.isExternal)));

  return {
    streams,
    cacheControl: { maxAge: 3600, staleError: 86400 },
  };
}
