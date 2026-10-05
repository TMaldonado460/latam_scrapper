import type { IncomingMessage, ServerResponse } from 'node:http';
import { respond } from '../../../src/respond.js';

export const maxDuration = 30;

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  await respond(req, res);
}
