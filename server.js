import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(ROOT, 'config.json');
const INDEX_PATH = path.join(ROOT, 'public', 'index.html');
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

const HTML_ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
};

function realOrNull(target) {
  try {
    return fs.realpathSync(target);
  } catch {
    return null;
  }
}

function isInside(target, root) {
  return target === root || target.startsWith(root.endsWith(path.sep) ? root : root + path.sep);
}

function toFsUrl(absolutePath) {
  return '/fs' + absolutePath.split(path.sep).map(encodeURIComponent).join('/');
}

function decodeEntities(text) {
  return text.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (match, code) => {
    if (code[0] === '#') {
      const hex = code[1]?.toLowerCase() === 'x';
      const value = Number.parseInt(hex ? code.slice(2) : code.slice(1), hex ? 16 : 10);
      try {
        return String.fromCodePoint(value);
      } catch {
        return match;
      }
    }
    return HTML_ENTITIES[code.toLowerCase()] ?? match;
  });
}

function readHtmlTitle(file) {
  let fd;
  try {
    fd = fs.openSync(file, 'r');
    const buffer = Buffer.alloc(256 * 1024);
    const size = fs.readSync(fd, buffer, 0, buffer.length, 0);
    const head = buffer.subarray(0, size).toString('utf8');
    const match = head.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (!match) return '';
    return decodeEntities(match[1].replace(/\s+/g, ' ').trim()).slice(0, 120);
  } catch {
    return '';
  } finally {
    if (fd !== undefined) {
      try { fs.closeSync(fd); } catch { /* ignore */ }
    }
  }
}

function readConfigItems() {
  const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
  const data = JSON.parse(raw);
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.entries)) return data.entries;
  throw new Error('config.json 顶层应为数组，或包含 entries 数组');
}

function toEntrySpec(item, index) {
  if (typeof item === 'string') return { path: item, title: '' };
  if (item && typeof item === 'object' && typeof item.path === 'string') {
    return { path: item.path, title: typeof item.title === 'string' ? item.title : '' };
  }
  throw new Error(`config.json 第 ${index + 1} 项无效：应为字符串或 { "path": "..." }`);
}

function describeEntries() {
  const items = readConfigItems();
  const roots = new Set([realOrNull(ROOT) || ROOT]);

  const entries = items.map((item, index) => {
    const spec = toEntrySpec(item, index);
    const displayPath = spec.path;
    const base = { index, displayPath, title: spec.title, src: null, error: null };

    if (!displayPath.trim()) {
      return { ...base, error: '路径为空' };
    }
    if (/^(https?:)?\/\//i.test(displayPath.trim())) {
      return { ...base, title: spec.title || displayPath, error: '暂不支持 URL，请填写本地文件路径' };
    }

    const absolutePath = path.resolve(ROOT, displayPath);
    let stat;
    try {
      stat = fs.statSync(absolutePath);
    } catch {
      return { ...base, title: spec.title || path.basename(absolutePath), error: '文件不存在' };
    }

    if (stat.isDirectory()) {
      roots.add(realOrNull(absolutePath) || absolutePath);
      return { ...base, title: spec.title || path.basename(absolutePath), error: '这是一个目录，请指向具体的 HTML 文件' };
    }

    const real = realOrNull(absolutePath) || absolutePath;
    roots.add(realOrNull(path.dirname(absolutePath)) || path.dirname(absolutePath));
    roots.add(path.dirname(real));

    const extension = path.extname(absolutePath).toLowerCase();
    const detectedTitle = extension === '.html' || extension === '.htm' ? readHtmlTitle(real) : '';
    const title = spec.title || detectedTitle || path.basename(absolutePath);

    return { ...base, title, src: toFsUrl(absolutePath) };
  });

  return { entries, roots: [...roots] };
}

function sendJson(response, status, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  response.end(body);
}

function sendText(response, status, text) {
  response.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': Buffer.byteLength(text),
    'Cache-Control': 'no-store',
  });
  response.end(text);
}

async function serveIndex(response) {
  const body = await fsp.readFile(INDEX_PATH);
  response.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Length': body.length,
    'Cache-Control': 'no-store',
  });
  response.end(body);
}

async function servePreview(response, pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname.slice('/fs'.length));
  } catch {
    sendText(response, 400, '路径编码无效');
    return;
  }
  if (decoded.includes('\0')) {
    sendText(response, 400, '路径无效');
    return;
  }

  const target = path.resolve(decoded);
  const real = realOrNull(target);
  if (!real) {
    sendText(response, 404, `文件不存在：${decoded}`);
    return;
  }

  const { roots } = describeEntries();
  if (!roots.some((root) => isInside(real, root))) {
    sendText(response, 403, `该路径不在允许访问的目录内：${decoded}`);
    return;
  }

  const stat = await fsp.stat(real);
  if (!stat.isFile()) {
    sendText(response, 404, '目标不是文件');
    return;
  }

  const type = MIME.get(path.extname(real).toLowerCase()) || 'application/octet-stream';
  response.writeHead(200, {
    'Content-Type': type,
    'Content-Length': stat.size,
    'Cache-Control': 'no-store',
  });
  fs.createReadStream(real)
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
    if (url.pathname === '/' || url.pathname === '/index.html') {
      await serveIndex(response);
      return;
    }

    if (url.pathname === '/api/entries') {
      try {
        sendJson(response, 200, describeEntries());
      } catch (error) {
        sendJson(response, 500, { error: error.message || String(error) });
      }
      return;
    }

    if (url.pathname.startsWith('/fs/')) {
      await servePreview(response, url.pathname);
      return;
    }

    sendText(response, 404, 'Not found');
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
  try {
    const { entries } = describeEntries();
    console.log(`  配置：${entries.length} 个条目（config.json）`);
  } catch (error) {
    console.warn(`  配置读取失败：${error.message}`);
  }
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
