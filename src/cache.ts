interface MemEntry {
  value: unknown;
  expires: number;
}

const memStore = new Map<string, MemEntry>();
const MAX_ENTRIES = 4000;

function memGet<T>(key: string): T | undefined {
  const entry = memStore.get(key);
  if (!entry) return undefined;
  if (entry.expires < Date.now()) {
    memStore.delete(key);
    return undefined;
  }
  return entry.value as T;
}

function memSet(key: string, value: unknown, ttlMs: number): void {
  if (memStore.size >= MAX_ENTRIES) {
    const oldest = memStore.keys().next().value as string;
    memStore.delete(oldest);
  }
  memStore.set(key, { value, expires: Date.now() + ttlMs });
}

function upstash(): { url: string; token: string } | undefined {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return undefined;
  return { url: url.replace(/\/+$/, ''), token };
}

export async function getCached<T>(key: string): Promise<T | undefined> {
  const mem = memGet<T>(key);
  if (mem !== undefined) return mem;

  const up = upstash();
  if (up) {
    try {
      const res = await fetch(`${up.url}/get/${encodeURIComponent(key)}`, {
        headers: { Authorization: `Bearer ${up.token}` },
        signal: AbortSignal.timeout(2000),
      });
      if (res.ok) {
        const data = (await res.json()) as { result?: string };
        if (data.result) {
          const parsed = JSON.parse(data.result) as T;
          memSet(key, parsed, 60000);
          return parsed;
        }
      }
    } catch {
      // cache is best-effort
    }
  }
  return undefined;
}

export async function setCached(key: string, value: unknown, ttlMs: number): Promise<void> {
  memSet(key, value, ttlMs);

  const up = upstash();
  if (up) {
    try {
      const body = JSON.stringify(value);
      await fetch(`${up.url}/set/${encodeURIComponent(key)}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${up.token}`,
          'Content-Type': 'application/json',
        },
        body,
        signal: AbortSignal.timeout(2000),
      });
      const seconds = Math.max(60, Math.floor(ttlMs / 1000));
      await fetch(`${up.url}/expire/${encodeURIComponent(key)}/${seconds}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${up.token}` },
        signal: AbortSignal.timeout(2000),
      });
    } catch {
      // cache is best-effort
    }
  }
}
