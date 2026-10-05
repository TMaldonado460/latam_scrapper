import type { Extracted, Extractor } from './extractor.js';
import type { Meta } from '../types.js';
import type { Ctx } from '../ctx.js';
import { DoodStream } from './doodstream.js';
import { Streamtape } from './streamtape.js';
import { FileMoon } from './filemoon.js';
import { Uqload } from './uqload.js';
import { Voe } from './voe.js';
import { Fastream } from './fastream.js';
import { External } from './external.js';

const extractors: Extractor[] = [
  new DoodStream(),
  new Streamtape(),
  new FileMoon(),
  new Uqload(),
  new Fastream(),
  new Voe(),
  new External(),
];

export async function extractUrl(
  url: URL,
  meta: Meta,
  ctx: Ctx,
): Promise<Extracted[]> {
  for (const extractor of extractors) {
    if (extractor.supports(url)) {
      return await extractor.extract(url, meta, ctx);
    }
  }
  return [];
}
