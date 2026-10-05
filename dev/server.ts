import { createServer } from 'node:http';
import { respond } from '../src/respond.js';

const PORT = Number(process.env.PORT ?? 7000);

const server = createServer(async (req, res) => {
  try {
    await respond(req, res);
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
