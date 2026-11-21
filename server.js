import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const HOST = process.env.HOST || '127.0.0.1';
const START_PORT = Number.parseInt(process.env.PORT || '4173', 10) || 4173;

const MIME = new Map(Object.entries({
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.wasm': 'application/wasm',
}));

function sendText(response, status, text) {
  response.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': Buffer.byteLength(text),
    'Cache-Control': 'no-store',
  });
  response.end(text);
}

function resolveTarget(pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (decoded.includes('\0')) return null;

  const target = path.resolve(ROOT, '.' + decoded);
  const relative = path.relative(ROOT, target);
  if (relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) {
    return null;
  }
  return target;
}

async function serveFile(request, response, file) {
  let stat;
  try {
    stat = await fsp.stat(file);
  } catch {
    sendText(response, 404, '文件不存在');
    return;
  }

  if (stat.isDirectory()) {
    file = path.join(file, 'index.html');
    try {
      stat = await fsp.stat(file);
    } catch {
      sendText(response, 404, '文件不存在');
      return;
    }
  }

  if (!stat.isFile()) {
    sendText(response, 404, '目标不是文件');
    return;
  }

  const type = MIME.get(path.extname(file).toLowerCase()) || 'application/octet-stream';
  response.writeHead(200, {
    'Content-Type': type,
    'Content-Length': stat.size,
    'Cache-Control': 'no-store',
  });

  if (request.method === 'HEAD') {
    response.end();
    return;
  }

  fs.createReadStream(file)
    .on('error', () => {
      if (!response.headersSent) sendText(response, 500, '读取文件失败');
      else response.destroy();
    })
    .pipe(response);
}

const server = http.createServer(async (request, response) => {
  const method = request.method || 'GET';
  if (method !== 'GET' && method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' });
    response.end('Method Not Allowed');
    return;
  }

  let url;
  try {
    url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
  } catch {
    sendText(response, 400, '请求地址无效');
    return;
  }

  try {
    const target = resolveTarget(url.pathname);
    if (!target) {
      sendText(response, 403, '路径无效');
      return;
    }
    await serveFile(request, response, target);
  } catch (error) {
    console.error(error);
    if (!response.headersSent) sendText(response, 500, '服务器内部错误');
    else response.destroy();
  }
});

let port = START_PORT;

function printBanner() {
  console.log('');
  console.log('  单页预览已启动');
  console.log(`  地址：http://${HOST}:${port}`);
  console.log('  部署：将 nginx 站点根目录指向本目录即可，无需 Node');
  console.log('');
}

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE' && port < START_PORT + 20) {
    port += 1;
    server.listen(port, HOST);
    return;
  }
  console.error(`启动失败：${error.message}`);
  process.exitCode = 1;
});

server.listen(port, HOST, printBanner);
