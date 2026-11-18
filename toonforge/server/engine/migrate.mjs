import fs from 'node:fs/promises';
import path from 'node:path';
import { fileExists, loadAndEnrichBoard, sanitizeSlug, compositionIdFromSlug } from '../services/workspaceService.mjs';
import { createFolder, updateFolder, uniqueSlug } from './folders.mjs';
import { newCard } from './cardMachine.mjs';

const REL = 'shorts/_imported/Existing shorts';

const inflight = new Map();

function stateOf(c) {
  if (c.videoFile) return c.qaReport ? 'done' : 'review';
  if (c.audioMode === 'no_vo') return 'scene';
  // With VO present, 'voice' makes Resume run the words job before the scene.
  return c.voiceFile || c.audioMode === 'needs_vo' ? 'voice' : 'script';
}

/** Copy the old Kanban board into one folder, once. board.json is left untouched. */
export function importBoardOnce(repoRoot) {
  if (!inflight.has(repoRoot)) {
    const p = run(repoRoot).finally(() => inflight.delete(repoRoot));
    inflight.set(repoRoot, p);
  }
  return inflight.get(repoRoot);
}

async function run(repoRoot) {
  if (await fileExists(path.join(repoRoot, REL, 'toonforge.json'))) return { imported: 0 };
  // loadAndEnrichBoard would seed and write a board when missing, so check first.
  if (!(await fileExists(path.join(repoRoot, '.toonforge', 'board.json')))) return { imported: 0 };
  const board = await loadAndEnrichBoard(repoRoot);

  const used = new Set(board.cards.map((c) => c.slug).filter(Boolean));
  const cards = [];
  for (const old of board.cards) {
    let slug = old.slug;
    if (!slug) {
      // uniqueSlug cannot see cards that are not saved yet, so also dodge this import's slugs.
      const base = sanitizeSlug(old.title) || 'short';
      slug = await uniqueSlug(repoRoot, old.title);
      for (let n = 2; used.has(slug) || (await uniqueSlug(repoRoot, slug)) !== slug; n++) slug = base.slice(0, 24 - String(n).length) + n;
      used.add(slug);
    }
    const card = newCard({
      title: old.title, hook: '', slug,
      audio: old.audioMode === 'no_vo' ? 'visual' : 'vo',
      rig: old.rigMode,
      compId: old.compositionId || compositionIdFromSlug(slug),
    });
    cards.push({
      ...card,
      state: stateOf(old),
      imported: true,
      files: {
        ...card.files,
        script: old.scriptFile ?? null,
        voice: old.voicePath ?? null,
        mix: old.mixWavFile ?? null,
        final: old.videoFile ?? null,
        qa: old.qaReport ?? null,
        previews: old.videoFile ? [old.videoFile] : [],
      },
    });
  }
  // The new toonforge.json is the "already imported" guard, so drop it if the write fails.
  await createFolder(repoRoot, { category: '_imported', name: 'Existing shorts', agent: 'claude' });
  try {
    await updateFolder(repoRoot, REL, (f) => { f.cards = cards; });
  } catch (e) {
    await fs.rm(path.join(repoRoot, REL), { recursive: true, force: true });
    throw e;
  }
  return { imported: cards.length };
}
