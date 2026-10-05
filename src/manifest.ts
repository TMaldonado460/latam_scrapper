import { APP_ID, APP_NAME } from './utils.js';

export function getManifest() {
  return {
    id: APP_ID,
    version: '0.1.0',
    name: APP_NAME,
    description:
      'Streams HTTP en Español (Latino/Castellano) desde Cuevana3, HomeCine y Unlimplay. Fallback para cuando no hay torrents cacheados en tu debrid.',
    catalogs: [],
    resources: [{ name: 'stream', types: ['movie', 'series'], idPrefixes: ['tt'] }],
    types: ['movie', 'series'],
    behaviorHints: {
      configurable: true,
      configurationRequired: false,
    },
  };
}
