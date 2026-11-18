import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnLines } from './runner.mjs';

/** @typedef {{ ok: boolean, tail: string, files?: object, warnings?: string[] }} MediaResult */
/** @typedef {{ onLine: (line: string, stream?: string) => void, signal?: AbortSignal }} RunOpts */

const run = (bin, args, cwd, { onLine, signal }) => spawnLines(bin, args, { cwd, onLine, signal });

/** @returns {Promise<MediaResult>} */
export async function typecheck(repoRoot, opts) {
  const r = await run('npx', ['tsc', '--noEmit'], repoRoot, opts);
  return { ok: r.code === 0, tail: r.tail };
}

/** @returns {string[]} */
export const previewArgs = (compId, slug, version) => [
  'remotion', 'render', 'src/index.ts', compId, `out/${slug}/preview-v${version}.mp4`,
  '--codec', 'h264', '--crf', '28', '--scale', '0.25',
];

/** 4 frames at 10/35/60/85 %, clamped to the last frame. @param {number} totalFrames */
export const stillFrames = (totalFrames) =>
  [0.1, 0.35, 0.6, 0.85].map((p) => Math.max(0, Math.min(Math.round(totalFrames * p), totalFrames - 1)));

/** @returns {Promise<MediaResult>} */
export async function renderPreview(repoRoot, card, version, opts) {
  const preview = `out/${card.slug}/preview-v${version}.mp4`;
  const r = await run('npx', previewArgs(card.compId, card.slug, version), repoRoot, opts);
  if (r.code !== 0) return { ok: false, tail: r.tail };

  let count = '';
  const p = await run('ffprobe', ['-v', 'error', '-count_packets', '-select_streams', 'v:0',
    '-show_entries', 'stream=nb_read_packets', '-of', 'csv=p=0', preview], repoRoot,
  { signal: opts.signal, onLine: (l) => { count += l.trim(); } });
  const total = parseInt(count, 10);
  if (p.code !== 0 || !(total > 0)) return { ok: false, tail: p.tail || `Could not count frames in ${preview}` };

  const frames = stillFrames(total);
  const prefix = `out/${card.slug}/stills/v${version}_`;
  const s = await run('node', ['scripts/stills.mjs', prefix, frames.join(','), '0.5', card.compId], repoRoot, opts);
  if (s.code !== 0) return { ok: false, tail: s.tail };
  return { ok: true, tail: s.tail, files: { previews: [preview], stills: frames.map((f) => `${prefix}${f}.jpg`) } };
}

/** QA report lines that signal a defect: black / unplanned white / frozen frames or loudness outside -16..-14 LUFS. @param {string} report */
export function qaWarnings(report) {
  const out = [];
  for (const line of report.split(/\r?\n/)) {
    if (/black \[\d+|unplanned white \[\d+|frozen spans >=12f \[\d+/.test(line)) out.push(line.trim());
    else if (/LUFS/.test(line)) {
      const m = /LUFS\s*(-?\d+(?:\.\d+)?)|I:\s*(-?\d+(?:\.\d+)?)/.exec(line);
      const v = m ? parseFloat(m[1] ?? m[2]) : NaN;
      if (!Number.isNaN(v) && (v < -16 || v > -14)) out.push(line.trim());
    }
  }
  return out;
}

/** @returns {Promise<MediaResult>} */
export async function renderFinal(repoRoot, card, opts) {
  const { slug, compId } = card;
  const final = `out/${slug}/${slug}_2k.mp4`;
  const r = await run('npx', ['remotion', 'render', 'src/index.ts', compId, final,
    '--codec', 'h264', '--crf', '16', '--scale', '1.3333333333333333'], repoRoot, opts);
  if (r.code !== 0) return { ok: false, tail: r.tail };

  const lines = [];
  const q = await run('python', ['scripts/short_qa.py', final, `out/${slug}/qa`], repoRoot,
    { signal: opts.signal, onLine: (l, s) => { lines.push(l); opts.onLine(l, s); } });
  if (q.code !== 0) return { ok: false, tail: q.tail };
  return { ok: true, tail: q.tail, files: { final, qa: `out/${slug}/qa/report.md` }, warnings: qaWarnings(lines.join('\n')) };
}

/** @returns {Promise<MediaResult>} */
export async function makeWords(repoRoot, voiceRelPath, outRelPath, opts) {
  const r = await run('python', ['server/engine/words.py', voiceRelPath, outRelPath], repoRoot, opts);
  return { ok: r.code === 0, tail: r.tail };
}

/** Copy src/videos/<slug>/ to out/<slug>/versions/v<version>/scene/; no-op if the scene is missing. */
export async function snapshotScene(repoRoot, slug, version) {
  const src = path.join(repoRoot, 'src', 'videos', slug);
  try { await fs.access(src); } catch { return; }
  await fs.cp(src, path.join(repoRoot, 'out', slug, 'versions', `v${version}`, 'scene'), { recursive: true });
}
