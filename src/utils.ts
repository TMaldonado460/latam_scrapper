import type { CountryCode } from './types.js';

export const APP_NAME = 'LatamScrapper';
export const APP_ID = 'community.latamscrapper';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
export { USER_AGENT };

const BASE36 = '0123456789abcdefghijklmnopqrstuvwxyz';
const b36 = (n: number): string => {
  if (n === 0) return '0';
  let s = '';
  while (n) {
    s = BASE36[n % 36] + s;
    n = Math.floor(n / 36);
  }
  return s;
};

/** Decodes a classic p,a,c,k,e,d packed eval and returns the unpacked JS. */
export function unpackEval(packed: string): string {
  const m = packed.match(
    /eval\(function\(p,a,c,k,e,d\).*?\}\('(.*?)',(\d+),(\d+),'([^']*)'\.split\('\|'\)/,
  );
  if (!m) {
    throw new Error('No p,a,c,k,e,d string found');
  }
  const [, raw, aStr, cStr, wordsStr] = m;
  const c = parseInt(cStr, 10);
  const k = wordsStr.split('|');
  let p = raw;
  for (let i = c - 1; i >= 0; i--) {
    if (i < k.length && k[i]) {
      p = p.replace(new RegExp(`\\b${b36(i)}\\b`, 'g'), k[i]);
    }
  }
  return p
    .replace(/\\'/g, "'")
    .replace(/\\\\/g, '\\')
    .replace(/\\x([0-9a-fA-F]{2})/g, (_s, h: string) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\u([0-9a-fA-F]{4})/g, (_s, h: string) => String.fromCharCode(parseInt(h, 16)));
}

export function b64Decode(s: string): string {
  const clean = s.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(clean, 'base64').toString('latin1');
}

export function levenshtein(a: string, b: string): number {
  const al = a.length;
  const bl = b.length;
  if (al === 0) return bl;
  if (bl === 0) return al;
  const row = new Array(bl + 1).fill(0).map((_, i) => i);
  for (let i = 1; i <= al; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= bl; j++) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[bl];
}

export const flagFromCountryCode = (cc: CountryCode): string =>
  cc === 'mx' ? '🇲🇽' : '🇪🇸';

export function getClosestResolution(height?: number): string | undefined {
  if (!height) return undefined;
  const candidates = [2160, 1440, 1080, 720, 576, 480, 360, 240, 144];
  const closest = candidates.reduce((best, cur) =>
    Math.abs(cur - height) < Math.abs(best - height) ? cur : best,
  );
  return `${closest}p`;
}

export function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Timeout after ${ms}ms: ${label}`)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
