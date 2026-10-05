import type { Source } from './source.js';
import { Cuevana } from './cuevana.js';
import { Cuevana3k } from './cuevana3k.js';
import { HomeCine } from './homecine.js';
import { Unlimplay } from './unlimplay.js';

export const allSources: Source[] = [
  new Cuevana(),
  new Cuevana3k(),
  new HomeCine(),
  new Unlimplay(),
];
