import { createServer } from 'node:http';
import { handleRequest } from '../src/app.js';

const PORT = Number(process.env.PORT ?? 7000);

const server = createServer(async (req, res) => {
  try {
    const result = await handleRequest(
      req.url ?? '/',
      req.method ?? 'GET',
      req.socket.remoteAddress,
    );
    res.statusCode = result.status;
    for (const [key, value] of Object.entries(result.headers)) {
      res.setHeader(key, value);
    }
    res.end(result.body);
  } catch (e) {
    console.error(e);
    res.statusCode = 500;
    res.end('Internal Server Error');
  }
});

server.listen(PORT, () => {
  console.log(`LatamScrapper dev server: http://localhost:${PORT}/manifest.json`);
  console.log(`Configure: http://localhost:${PORT}/configure`);
});
