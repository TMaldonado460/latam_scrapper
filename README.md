# LatamScrapper — Stremio addon (streams HTTP en Español Latino)

Addon de **fallback** para Stremio: cuando Comet/Torrentio no tienen torrents
cacheados en tu debrid (TorBox, Real-Debrid…), LatamScrapper busca streams
directos HTTP en español latino/castellano. Los resultados aparecen
automáticamente debajo de los streams de torrents.

## Fuentes

| Fuente | Contenido | Estado |
|---|---|---|
| **Cuevana3K** (cuevana3k.pro) | Películas + series | ✅ Funciona (Servidor Hyper → filemoon/dood + vidsrc externos) |
| **HomeCine** (www3.homecine.to) | Películas + series | ✅ Funciona (hosts Fastream) |
| **Cuevana3** (www3.cuevana3.is) | Películas + series | ⚠️ La búsqueda y episodios funcionan; la lista de players está detrás de Cloudflare según IP — degrada a 0 resultados |
| **Unlimplay** (player de CineHDPlus y otros) | Películas + series | 🔗 Enlace externo (se abre en el navegador del dispositivo, evita el bloqueo a datacenters) |

**Extractores implementados** (convierten el embed a URL reproducible):
Fastream, DoodStream, Streamtape, FileMoon, Uqload, VOE (+ enlaces externos opcionales).

Nota: Pelisplus y CineHDPlus como sitios están caídos/incautados (redirigen a
ACE). Unlimplay cubre parte del ecosistema de CineHDPlus.

## Deploy en Vercel (gratis)

```bash
npm install
npm install -g vercel
vercel        # link al proyecto
vercel deploy # o conecta el repo en vercel.com (framework: Other)
```

Configura estas variables de entorno en Vercel (Project → Settings → Environment Variables):

| Variable | Requerida | Descripción |
|---|---|---|
| `TMDB_TOKEN` | recomendada | API key v3 **o** Read Access Token v4 (empieza con `ey`). Sin ella los títulos vienen de Cinemeta en inglés y HomeCine/Cuevana solo matchean títulos idénticos en español. Crear gratis en themoviedb.org |
| `UPSTASH_REDIS_REST_URL` | opcional | Cache (gratis en upstash.com). Acelera mucho las vistas repetidas |
| `UPSTASH_REDIS_REST_TOKEN` | opcional | Token del cache |
| `MEDIAFLOW_URL` | opcional | URL de tu MediaFlow (ej. `https://mfp.tudominio.com?api_password=clave`). Desbloquea hosts que exigen Referer (VOE) en Android TV |

Después de desplegar:

1. Abre `https://TU-APP.vercel.app/configure`
2. Elige idiomas/fuentes y pulsa "Instalar en Stremio"
3. O instala el manifest manualmente: `https://TU-APP.vercel.app/manifest.json`

## Dev local

```bash
cp .env.example .env   # opcional: pon TMDB_TOKEN
npm run dev            # http://localhost:7000
curl "http://localhost:7000/stream/movie/tt7286456.json"
```

## Cómo funciona

```
Stremio /stream/movie/tt7286456.json
  → resolver (paralelo por fuente)
    → Ctx: IMDb → TMDB (nombre ES + año) | Cinemeta fallback
    → Cuevana3: /search/ → página → open_submenu/clili → goto_ddh decode → embeds
    → HomeCine:  /?s= → a[oldtitle] → #tabN .movieplay iframe → embeds
    → extractor: Fastream (p,a,c,k,e,d → master.m3u8), DoodStream, Streamtape,
                 FileMoon, Uqload, VOE → URL directa reproducible
  → ordena por idioma/calidad, deduplica, cache 6h (memoria + Upstash opcional)
```

Los streams HTTP mueren en días/semanas — por eso es solo un fallback, no un
reemplazo del debrid. Calidad típica: 360p–1080p (la etiqueta del sitio a veces
miente; usamos la resolución real del playlist cuando es posible).

## Limitaciones conocidas

- Los tokens de Fastream son de un solo uso: nunca tocamos el playlist en el
  servidor para no consumirlos.
- VOE pide Referer: sin MediaFlow puede fallar en Android. Con `MEDIAFLOW_URL`
  configurado se envuelve automáticamente.
- Cloudflare puede gatear Cuevana3 según la IP del serverless.
- Sin `TMDB_TOKEN`, la coincidencia de títulos en español es parcial.
