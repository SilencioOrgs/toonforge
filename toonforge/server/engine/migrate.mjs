import path from 'node:path';
import { fileExists, loadAndEnrichBoard, compositionIdFromSlug } from '../services/workspaceService.mjs';
import { createFolder, updateFolder, uniqueSlug } from './folders.mjs';
import { newCard } from './cardMachine.mjs';

const REL = 'shorts/_imported/Existing shorts';

function stateOf(c) {
  if (c.videoFile) return c.qaReport ? 'done' : 'review';
  if (c.voiceFile || c.audioMode === 'no_vo') return 'scene';
  return c.audioMode === 'needs_vo' ? 'voice' : 'script';
}

/** Copy the old Kanban board into one folder, once. board.json is left untouched. */
export async function importBoardOnce(repoRoot) {
  if (await fileExists(path.join(repoRoot, REL, 'toonforge.json'))) return { imported: 0 };
  // loadAndEnrichBoard would seed and write a board when missing, so check first.
  if (!(await fileExists(path.join(repoRoot, '.toonforge', 'board.json')))) return { imported: 0 };
  const board = await loadAndEnrichBoard(repoRoot);

  await createFolder(repoRoot, { category: '_imported', name: 'Existing shorts', agent: 'claude' });
  const cards = [];
  for (const old of board.cards) {
    const slug = old.slug || (await uniqueSlug(repoRoot, old.title));
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
  await updateFolder(repoRoot, REL, (f) => { f.cards = cards; });
  return { imported: cards.length };
}
