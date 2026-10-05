import { USER_AGENT } from './utils.js';

export class HttpError extends Error {
  public constructor(
    public readonly status: number,
    public readonly url: string,
    message?: string,
  ) {
    super(message ?? `HTTP ${status} for ${url}`);
  }
}

export class NotFoundError extends Error {}
export class TimeoutError extends Error {}

export interface FetchOptions {
  method?: 'GET' | 'HEAD' | 'POST';
  headers?: Record<string, string>;
  timeout?: number;
  body?: string;
  redirect?: 'follow' | 'error' | 'manual';
}

export interface FetchResult {
  text: string;
  url: string;
  status: number;
}

export async function fetchText(input: string | URL, opts: FetchOptions = {}): Promise<FetchResult> {
  const { timeout = 10000, method = 'GET', headers = {}, body, redirect = 'follow' } = opts;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(input, {
      method,
      redirect,
      signal: controller.signal,
      body,
      headers: {
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es,en;q=0.8',
        'User-Agent': USER_AGENT,
        ...headers,
      },
    });
    const text = await res.text();
    if (res.status === 404) {
      throw new NotFoundError(`404 for ${res.url}`);
    }
    if (res.status >= 400) {
      throw new HttpError(res.status, res.url, `HTTP ${res.status} for ${res.url}`);
    }
    return { text, url: res.url, status: res.status };
  } catch (e) {
    if (e instanceof NotFoundError || e instanceof HttpError) throw e;
    if (e instanceof Error && e.name === 'AbortError') {
      throw new TimeoutError(`Request timed out after ${timeout}ms: ${input}`);
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchJson(input: string | URL, opts: FetchOptions = {}): Promise<unknown> {
  const res = await fetchText(input, {
    ...opts,
    headers: { Accept: 'application/json', ...opts.headers },
  });
  return JSON.parse(res.text);
}
