import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { execWorkspaceCommand, runPipelineAction, runSyncRepo } from './services/jobRunner.mjs';
import {
  createCardAndScript,
  fileExists,
  getEnvStatus,
  inspectRigs,
  loadAndEnrichBoard,
  readCardScript,
  resolveSafeMediaPath,
  saveBoard,
  ValidationError,
  writeCardScript,
} from './services/workspaceService.mjs';

const MAX_JSON_BYTES = 1024 * 1024;

const MIME_MAP = {
  '.mp4': 'video/mp4',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.wav': 'audio/wav',
  '.md': 'text/markdown; charset=utf-8',
};

function isLocalOriginAllowed(origin) {
  if (!origin) return true;
  return /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(origin) || /^tauri:\/\/localhost$/i.test(origin);
}

function isLocalHostAllowed(host) {
  if (!host) return true;
  return /^(127\.0\.0\.1|localhost)(:\d+)?$/i.test(host);
}

async function readJsonBody(req) {
  const ctype = String(req.headers['content-type'] || '').toLowerCase();
  if (!ctype.includes('application/json')) {
    throw new ValidationError('Content-Type must be application/json', 415);
  }
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > MAX_JSON_BYTES) {
      throw new ValidationError('Request body too large', 413);
    }
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw new ValidationError('Malformed JSON payload', 400);
  }
}

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

function parseByteRange(rangeHeader, fileSize) {
  const m = /^bytes=(\d+)-(\d*)$/.exec(rangeHeader);
  if (!m || fileSize === 0) return null;
  const start = Number(m[1]);
  const end = m[2] ? Math.min(Number(m[2]), fileSize - 1) : fileSize - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= fileSize || start > end) {
    return null;
  }
  return { start, end };
}

/** Handles workspace API routes shared by Vite dev middleware and standalone Node server. */
export async function handleApiRequest(req, res, repoRoot) {
  if (!isLocalHostAllowed(req.headers.host)) {
    return sendJson(res, 403, { error: 'Forbidden host' });
  }
  if (!isLocalOriginAllowed(req.headers.origin) || req.headers['sec-fetch-site'] === 'cross-site') {
    return sendJson(res, 403, { error: 'Forbidden cross-origin request' });
  }

  const parsedUrl = new URL(req.url || '/', 'http://127.0.0.1');
  const route = parsedUrl.pathname.startsWith('/api')
    ? parsedUrl.pathname.slice(4) || '/'
    : parsedUrl.pathname;
  const method = (req.method || 'GET').toUpperCase();

  try {
    if (method === 'GET' && route === '/env') {
      return sendJson(res, 200, await getEnvStatus(repoRoot));
    }
    if (method === 'GET' && route === '/rigs') {
      return sendJson(res, 200, await inspectRigs(repoRoot));
    }
    if (method === 'GET' && route === '/board') {
      return sendJson(res, 200, await loadAndEnrichBoard(repoRoot));
    }
    if (method === 'POST' && route === '/board') {
      return sendJson(res, 200, await saveBoard(repoRoot, await readJsonBody(req)));
    }
    if (method === 'POST' && route === '/cards') {
      const { title, rigMode } = await readJsonBody(req);
      return sendJson(res, 200, await createCardAndScript(repoRoot, title, rigMode));
    }
    if (method === 'GET' && route === '/script') {
      const slug = parsedUrl.searchParams.get('slug') || '';
      return sendJson(res, 200, await readCardScript(repoRoot, slug));
    }
    if (method === 'PUT' && route === '/script') {
      const { slug, content } = await readJsonBody(req);
      return sendJson(res, 200, await writeCardScript(repoRoot, slug, content));
    }
    if (method === 'GET' && route === '/media') {
      const rel = parsedUrl.searchParams.get('path') || '';
      const target = await resolveSafeMediaPath(repoRoot, rel);
      if (!target) return sendJson(res, 403, { error: 'Forbidden media path' });
      if (!(await fileExists(target))) return sendJson(res, 404, { error: 'File not found' });

      const stat = await fs.stat(target);
      if (!stat.isFile()) return sendJson(res, 404, { error: 'Requested path is not a file' });

      const ext = path.extname(target).toLowerCase();
      res.setHeader('Content-Type', MIME_MAP[ext] || 'application/octet-stream');
      res.setHeader('Accept-Ranges', 'bytes');

      const range = req.headers.range;
      if (range) {
        const parsed = parseByteRange(range, stat.size);
        if (!parsed) {
          res.statusCode = 416;
          res.setHeader('Content-Range', `bytes */${stat.size}`);
          res.end();
          return;
        }
        res.statusCode = 206;
        res.setHeader('Content-Range', `bytes ${parsed.start}-${parsed.end}/${stat.size}`);
        res.setHeader('Content-Length', String(parsed.end - parsed.start + 1));
        const stream = createReadStream(target, parsed);
        stream.on('error', () => {
          if (!res.headersSent) res.statusCode = 500;
          res.end();
        });
        stream.pipe(res);
        return;
      }

      res.statusCode = 200;
      res.setHeader('Content-Length', String(stat.size));
      const stream = createReadStream(target);
      stream.on('error', () => {
        if (!res.headersSent) res.statusCode = 500;
        res.end();
      });
      stream.pipe(res);
      return;
    }
    if (method === 'POST' && route === '/sync') {
      return sendJson(res, 200, await runSyncRepo(repoRoot));
    }
    if (method === 'POST' && route === '/cli/exec') {
      const { command, engine } = await readJsonBody(req);
      return sendJson(res, 200, await execWorkspaceCommand(repoRoot, engine, command));
    }
    if (method === 'POST' && route === '/pipeline/run') {
      const { slug, action } = await readJsonBody(req);
      return sendJson(res, 200, await runPipelineAction(repoRoot, slug, action));
    }

    return sendJson(res, 404, { error: `Unknown route ${method} ${route}` });
  } catch (err) {
    const status = err instanceof ValidationError ? err.status : 500;
    return sendJson(res, status, { error: String(err?.message || err) });
  }
}

const isDirectEntry =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isDirectEntry) {
  const repoRoot = path.resolve(import.meta.dirname, '../..');
  const port = Number(process.env.TOONFORGE_BRIDGE_PORT || 4190);
  const srv = http.createServer((req, res) => handleApiRequest(req, res, repoRoot));
  srv.listen(port, '127.0.0.1', () => {
    console.log(`ToonForge Workspace Bridge listening on http://127.0.0.1:${port} for ${repoRoot}`);
  });
}
