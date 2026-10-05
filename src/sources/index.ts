import type { Source } from './source.js';
import { Cuevana } from './cuevana.js';
import { HomeCine } from './homecine.js';
import { Unlimplay } from './unlimplay.js';

export const allSources: Source[] = [new Cuevana(), new HomeCine(), new Unlimplay()];
