import type { IncomingMessage, ServerResponse } from 'node:http';
import { handleRequest } from '../src/app.js';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
};

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  // CORS is mandatory for the Stremio addon protocol (web.stremio.com fetches
  // addons from the browser).
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    res.setHeader(key, value);
  }

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  const result = await handleRequest(
    (req as IncomingMessage & { url?: string }).url ?? '/',
    req.method ?? 'GET',
    (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ||
      req.socket.remoteAddress,
  );
  res.statusCode = result.status;
  for (const [key, value] of Object.entries(result.headers)) {
    res.setHeader(key, value as string);
  }
  res.end(result.body);
}
