import { getManifest } from './manifest.js';
import { parseConfig, configToQuery, SOURCE_IDS } from './config.js';
import { ImdbId } from './id.js';
import { Ctx } from './ctx.js';
import { resolveStreams } from './resolver.js';
import { APP_NAME } from './utils.js';

export interface HandlerResult {
  status: number;
  headers: Record<string, string>;
  body: string;
}

const json = (data: unknown): HandlerResult => ({
  status: 200,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  body: JSON.stringify(data),
});

const html = (body: string, status = 200): HandlerResult => ({
  status,
  headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  body,
});

const notFound = (): HandlerResult =>
  json({ error: 'Not found' });

function landingPage(origin: string): string {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${APP_NAME} - Stremio Addon</title>
<style>
  body { font-family: system-ui, sans-serif; background: #0d1117; color: #e6edf3; max-width: 720px; margin: 40px auto; padding: 0 20px; line-height: 1.6; }
  h1 { font-size: 1.6em; }
  a { color: #58a6ff; }
  code { background: #161b22; padding: 2px 6px; border-radius: 4px; font-size: 0.9em; word-break: break-all; }
  .card { background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 16px; margin: 16px 0; }
  .btn { display: inline-block; background: #238636; color: #fff; padding: 10px 18px; border-radius: 6px; text-decoration: none; font-weight: 600; }
</style>
</head>
<body>
<h1>${APP_NAME}</h1>
<p>Stremio addon de streams HTTP en Español (Latino/Castellano) — <strong>Cuevana3</strong>, <strong>HomeCine</strong> y <strong>Unlimplay</strong> (externo).</p>
<p>Úsalo como <em>fallback</em> cuando Comet/Torrentio no tengan resultados cacheados en tu debrid. Los resultados aparecen debajo de los torrents automáticamente.</p>
<div class="card">
  <p><strong>1.</strong> Configura e instala:</p>
  <a class="btn" href="/configure">⚙️ Configurar e instalar</a>
</div>
<div class="card">
  <p><strong>2.</strong> O usa la URL del manifest directamente (instálala en Stremio):</p>
  <p><code>${origin}/manifest.json</code></p>
</div>
</body>
</html>`;
}

function configurePage(origin: string): string {
  const sourceOptions = SOURCE_IDS.map(
    (id) =>
      `<label style="display:block;margin:4px 0"><input type="checkbox" name="sources" value="${id}" checked> ${id}</label>`,
  ).join('');
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${APP_NAME} - Configurar</title>
<style>
  body { font-family: system-ui, sans-serif; background: #0d1117; color: #e6edf3; max-width: 720px; margin: 40px auto; padding: 0 20px; line-height: 1.6; }
  h1 { font-size: 1.5em; }
  fieldset { border: 1px solid #30363d; border-radius: 8px; padding: 14px; margin: 14px 0; background: #161b22; }
  select, input[type=text] { background: #0d1117; color: #e6edf3; border: 1px solid #30363d; border-radius: 4px; padding: 6px; }
  .btn { display: inline-block; background: #238636; color: #fff; padding: 10px 18px; border-radius: 6px; text-decoration: none; font-weight: 600; border: none; cursor: pointer; }
  code { background: #161b22; padding: 2px 6px; border-radius: 4px; word-break: break-all; }
  #result { margin-top: 18px; display: none; }
</style>
</head>
<body>
<h1>⚙️ Configurar ${APP_NAME}</h1>
<form id="cfg">
  <fieldset>
    <legend>Idiomas</legend>
    <label style="display:block;margin:4px 0"><input type="checkbox" name="lang" value="mx" checked> 🇲🇽 Español Latino</label>
    <label style="display:block;margin:4px 0"><input type="checkbox" name="lang" value="es" checked> 🇪🇸 Castellano</label>
  </fieldset>
  <fieldset>
    <legend>Fuentes</legend>
    ${sourceOptions}
    <label style="display:block;margin:4px 0"><input type="checkbox" name="showExternal" id="showExternal"> Incluir enlaces externos (se abren en el navegador)</label>
  </fieldset>
  <fieldset>
    <legend>Calidad mínima</legend>
    <select name="minHeight">
      <option value="0">Cualquiera</option>
      <option value="720">720p+</option>
      <option value="1080">1080p+</option>
    </select>
  </fieldset>
  <fieldset>
    <legend>MediaFlow proxy (opcional)</legend>
    <input type="text" name="mediaflow" placeholder="https://tu-mediaflow.example.com" style="width:100%">
    <p style="margin:6px 0 0;font-size:.85em;color:#8b949e">Desbloquea hosts con referer en Android (VOE, etc). Ej.: <code>https://mfp.example.com?api_password=clave</code></p>
  </fieldset>
  <button class="btn" type="submit">Generar enlace de instalación</button>
</form>
<div id="result">
  <p><a class="btn" id="installLink" href="#">Instalar en Stremio (app de escritorio/Android)</a></p>
  <p><a class="btn" id="webInstallLink" href="#" target="_blank" rel="noopener">Instalar en Web (web.stremio.com)</a></p>
  <p>URL del manifest (para instalación manual):</p>
  <p><code id="manifestUrl"></code></p>
</div>
<script>
  document.getElementById('cfg').addEventListener('submit', function (e) {
    e.preventDefault();
    const f = new FormData(e.target);
    const params = new URLSearchParams();
    params.set('lang', f.getAll('lang').join(',') || 'mx,es');
    params.set('sources', f.getAll('sources').join(','));
    if (f.get('minHeight') !== '0') params.set('minHeight', f.get('minHeight'));
    if (f.get('showExternal')) params.set('showExternal', '1');
    if (f.get('mediaflow')) params.set('mediaflow', f.get('mediaflow').trim());
    const q = params.toString();
    const manifestUrl = location.origin + '/manifest.json' + (q ? '?' + q : '');
    document.getElementById('manifestUrl').textContent = manifestUrl;
    document.getElementById('installLink').href = 'stremio://addon?url=' + encodeURIComponent(manifestUrl);
    document.getElementById('webInstallLink').href =
      'https://web.stremio.com/#/addons?addon=' + encodeURIComponent(manifestUrl);
    document.getElementById('result').style.display = 'block';
  });
</script>
</body>
</html>`;
}

export async function handleRequest(
  reqUrl: string,
  method: string,
  remoteIp?: string,
): Promise<HandlerResult> {
  const url = new URL(reqUrl, 'http://localhost');
  const path = url.pathname.replace(/^\/api(?=\/|$)/, '');

  const config = parseConfig(url.searchParams);

  if (method !== 'GET' && method !== 'HEAD') {
    return { status: 405, headers: {}, body: 'Method Not Allowed' };
  }

  if (path === '/manifest.json') {
    return json(getManifest());
  }

  if (path === '/configure' || path === '/config') {
    return html(configurePage(url.origin));
  }

  if (path === '/' || path === '' || path === '/landing') {
    return html(landingPage(url.origin));
  }

  const streamMatch = path.match(/^\/stream\/(movie|series)\/([^/]+)\.json$/);
  if (streamMatch) {
    const type = streamMatch[1] as 'movie' | 'series';
    const imdbId = ImdbId.fromString(decodeURIComponent(streamMatch[2]));
    if (!imdbId) return json({ streams: [] });

    const ctx = new Ctx(imdbId, type, config, remoteIp);
    const result = await resolveStreams(ctx);
    return json(result);
  }

  return notFound();
}
