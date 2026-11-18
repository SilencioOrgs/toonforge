import fs from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { ValidationError, fileExists, sanitizeSlug } from '../services/workspaceService.mjs';

export const DEFAULT_CATEGORIES = [
  { id: 'crime', label: 'Real crime' },
  { id: 'horror', label: 'Horror' },
  { id: 'tech', label: 'Tech' },
];
const CARD_STATES = ['script', 'voice', 'scene', 'sound', 'preview', 'review', 'render', 'done', 'failed'];
const FILE = 'toonforge.json';
// Windows reserves these names even with an extension (CON.txt).
const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;

const shortsDir = (repoRoot) => path.join(repoRoot, 'shorts');
const toRel = (...parts) => ['shorts', ...parts].join('/');

function resolveRel(repoRoot, relPath) {
  const abs = path.resolve(repoRoot, relPath);
  const root = path.resolve(shortsDir(repoRoot));
  if (!abs.startsWith(root + path.sep)) throw new ValidationError('Folder path escapes shorts/');
  return abs;
}

export function safeFolderName(name) {
  const cleaned = String(name ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/, '');
  if (!cleaned || /^\.+$/.test(cleaned)) throw new ValidationError('Folder name is empty');
  return RESERVED.test(cleaned) ? `_${cleaned}` : cleaned;
}

async function writeAtomic(file, data) {
  const tmp = `${file}.tmp-${process.pid}-${randomBytes(4).toString('hex')}`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2));
  await fs.rename(tmp, file);
}

// mkdir (non-recursive) is the atomic claim, so concurrent creates cannot collide.
async function mkdirUnique(parent, base) {
  await fs.mkdir(parent, { recursive: true });
  for (let n = 1; ; n++) {
    const name = n === 1 ? base : `${base} (${n})`;
    try {
      await fs.mkdir(path.join(parent, name));
      return name;
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
    }
  }
}

/** @typedef {{ id: string, state: string, slug?: string, [k: string]: any }} Card */
/** @typedef {{ version: number, name: string, category: string, agent: string, createdAt: string, topicRun: any, cards: Card[] }} Folder */

/** @param {string} repoRoot @param {{ category: string, name?: string, agent: string }} opts @returns {Promise<Folder>} */
export async function createFolder(repoRoot, { category, name, agent }) {
  const def = DEFAULT_CATEGORIES.find((c) => c.id === category);
  const catDir = def ? def.id : safeFolderName(category);
  const label = def ? def.label : catDir;
  const base = name && String(name).trim() ? safeFolderName(name) : safeFolderName(`${label} ${new Date().toISOString().slice(0, 10)}`);
  resolveRel(repoRoot, toRel(catDir, base));
  const finalName = await mkdirUnique(path.join(shortsDir(repoRoot), catDir), base);
  const folder = {
    version: 1,
    name: finalName,
    category: catDir,
    agent,
    createdAt: new Date().toISOString(),
    topicRun: null,
    cards: [],
  };
  await writeAtomic(path.join(shortsDir(repoRoot), catDir, finalName, FILE), folder);
  return folder;
}

/** @returns {Promise<Folder>} */
export async function readFolder(repoRoot, relPath) {
  const file = path.join(resolveRel(repoRoot, relPath), FILE);
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') throw new ValidationError(`Folder not found: ${relPath}`, 404);
    throw err;
  }
}

const chains = new Map();

/** @param {string} repoRoot @param {string} relPath @param {(f: Folder) => Folder | void | Promise<Folder | void>} mutate @returns {Promise<Folder>} */
export function updateFolder(repoRoot, relPath, mutate) {
  const abs = resolveRel(repoRoot, relPath);
  return enqueue(abs, async () => {
    const folder = await readFolder(repoRoot, relPath);
    const next = (await mutate(folder)) ?? folder;
    await writeAtomic(path.join(abs, FILE), next);
    return next;
  });
}

function enqueue(abs, run) {
  const prev = chains.get(abs) ?? Promise.resolve();
  const result = prev.then(run, run);
  const tail = result.catch(() => {});
  chains.set(abs, tail);
  tail.then(() => chains.get(abs) === tail && chains.delete(abs));
  return result;
}

export async function renameFolder(repoRoot, relPath, newName) {
  const abs = resolveRel(repoRoot, relPath);
  const safe = safeFolderName(newName);
  const dest = path.join(path.dirname(abs), safe);
  const newRel = toRel(path.basename(path.dirname(abs)), safe);
  return enqueue(abs, async () => {
    const caseOnly = dest.toLowerCase() === abs.toLowerCase();
    if (!caseOnly && (await fileExists(dest))) throw new ValidationError(`A folder named "${safe}" already exists`, 409);
    await fs.rename(abs, dest);
    try {
      const f = JSON.parse(await fs.readFile(path.join(dest, FILE), 'utf8'));
      f.name = safe;
      await writeAtomic(path.join(dest, FILE), f);
    } catch (err) {
      await fs.rename(dest, abs);
      throw err;
    }
    return newRel;
  });
}

async function subdirs(dir) {
  try {
    return (await fs.readdir(dir, { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
}

/** Every folder's relPath without reading its toonforge.json. @returns {Promise<{ cat: string, name: string, path: string }[]>} */
export async function listAllFolders(repoRoot) {
  const out = [];
  for (const cat of await subdirs(shortsDir(repoRoot))) {
    for (const name of await subdirs(path.join(shortsDir(repoRoot), cat))) {
      if (await fileExists(path.join(shortsDir(repoRoot), cat, name, FILE))) out.push({ cat, name, path: toRel(cat, name) });
    }
  }
  return out;
}

export async function listTree(repoRoot) {
  const folders = await listAllFolders(repoRoot);
  const dirs = await subdirs(shortsDir(repoRoot));
  const cats = [
    ...DEFAULT_CATEGORIES,
    ...dirs
      .filter((d) => !DEFAULT_CATEGORIES.some((c) => c.id === d))
      .map((d) => ({ id: d, label: d === '_imported' ? 'Imported' : d })),
  ];
  const categories = [];
  for (const c of cats) {
    const items = [];
    for (const f of folders.filter((x) => x.cat === c.id)) {
      const counts = Object.fromEntries(CARD_STATES.map((s) => [s, 0]));
      for (const card of (await readFolder(repoRoot, f.path)).cards) if (card.state in counts) counts[card.state]++;
      items.push({ path: f.path, name: f.name, counts });
    }
    categories.push({ ...c, folders: items });
  }
  return { categories };
}

export async function uniqueSlug(repoRoot, title) {
  const base = sanitizeSlug(title) || 'short';
  const taken = new Set();
  for (const f of await listAllFolders(repoRoot)) {
    for (const card of (await readFolder(repoRoot, f.path)).cards) if (card.slug) taken.add(card.slug);
  }
  for (const dir of [path.join(repoRoot, 'src', 'videos'), path.join(repoRoot, 'out')]) {
    try {
      for (const entry of await fs.readdir(dir)) taken.add(sanitizeSlug(path.parse(entry).name));
    } catch { /* dir may not exist */ }
  }
  let slug = base;
  for (let n = 2; taken.has(slug); n++) slug = base.slice(0, 24 - String(n).length) + n;
  return slug;
}
