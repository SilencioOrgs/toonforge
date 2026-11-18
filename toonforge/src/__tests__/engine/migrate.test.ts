// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
// @ts-ignore
import * as folders from '../../../server/engine/folders.mjs';
// @ts-ignore
import { importBoardOnce } from '../../../server/engine/migrate.mjs';
// @ts-ignore
import { readFolder } from '../../../server/engine/folders.mjs';
// @ts-ignore
import { nextJob } from '../../../server/engine/cardMachine.mjs';
// @ts-ignore
import { createBus } from '../../../server/engine/events.mjs';
// @ts-ignore
import { createQueue } from '../../../server/engine/queue.mjs';

vi.mock('../../../server/engine/folders.mjs', async (orig) => {
  const m: any = await orig();
  return { ...m, updateFolder: vi.fn(m.updateFolder) };
});

const REL = 'shorts/_imported/Existing shorts';
let tmp: string;

const write = async (rel: string, data = 'x') => {
  await fs.mkdir(path.dirname(path.join(tmp, rel)), { recursive: true });
  await fs.writeFile(path.join(tmp, rel), data);
};
const boardPath = () => path.join(tmp, '.toonforge', 'board.json');

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'tf-migrate-'));
  await write('out/done1/done1.mp4');
  await write('out/done1/qa/report.md');
  await write('voice/vo1_voice.mp3');
  await write('SCRIPT_NEEDS1.md');
  const base = { lane: 'backlog', rigMode: 'stickman', stills: [] };
  await write('.toonforge/board.json', JSON.stringify({
    version: 1, autoQueue: true, activeLane: 'backlog', selectedCardId: '',
    cards: [
      { ...base, id: 'done1', slug: 'done1', title: 'Done One', audioMode: 'vo_ready', compositionId: 'Done1Short' },
      { ...base, id: 'vo1', slug: 'vo1', title: 'Has VO', audioMode: 'vo_ready', compositionId: 'Vo1Short' },
      { ...base, id: 'needs1', slug: 'needs1', title: 'Needs VO', audioMode: 'needs_vo', compositionId: 'Needs1Short', scriptFile: 'SCRIPT_NEEDS1.md' },
    ],
  }));
});
afterEach(() => fs.rm(tmp, { recursive: true, force: true }));

describe('importBoardOnce', () => {
  it('imports the old board once and never touches board.json', async () => {
    const before = await fs.readFile(boardPath());
    expect(await importBoardOnce(tmp)).toEqual({ imported: 3 });
    expect(await importBoardOnce(tmp)).toEqual({ imported: 0 });
    expect(Buffer.compare(before, await fs.readFile(boardPath()))).toBe(0);

    const cards = (await readFolder(tmp, REL)).cards;
    expect(cards.map((c: any) => [c.slug, c.state, c.imported])).toEqual([
      ['done1', 'done', true], ['vo1', 'voice', true], ['needs1', 'voice', true],
    ]);
    const [done, vo, needs] = cards;
    expect(done.files).toMatchObject({ final: 'out/done1/done1.mp4', qa: 'out/done1/qa/report.md', previews: ['out/done1/done1.mp4'] });
    expect(vo.files.voice).toBe('voice/vo1_voice.mp3');
    expect(nextJob(vo)).toBeNull();
    expect(nextJob({ ...vo, resumed: true })).toBe('words');
    expect(needs).toMatchObject({ audio: 'vo', rig: 'stickman', compId: 'Needs1Short', title: 'Needs VO' });
    expect(needs.files.script).toBe('SCRIPT_NEEDS1.md');
  });

  it('is a no-op without a board and does not seed one', async () => {
    await fs.rm(path.join(tmp, '.toonforge'), { recursive: true });
    expect(await importBoardOnce(tmp)).toEqual({ imported: 0 });
    await expect(fs.access(boardPath())).rejects.toThrow();
  });

  it('queue start() imports but does not run imported cards', async () => {
    const runAgent = vi.fn(async () => ({ ok: true, events: [], tail: '' }));
    const q = createQueue({ repoRoot: tmp, bus: createBus(), agents: { runAgent } } as any);
    await q.start();
    expect((await readFolder(tmp, REL)).cards.map((c: any) => c.state)).toEqual(['done', 'voice', 'voice']);
    expect(q.snapshot().queued ?? []).toHaveLength(0);
    expect(runAgent).not.toHaveBeenCalled();
  });

  it('leaves no guard folder behind when the write fails, and retries cleanly', async () => {
    (folders.updateFolder as any).mockRejectedValueOnce(new Error('disk'));
    await expect(importBoardOnce(tmp)).rejects.toThrow('disk');
    await expect(fs.access(path.join(tmp, REL, 'toonforge.json'))).rejects.toThrow();
    expect(await importBoardOnce(tmp)).toEqual({ imported: 3 });
  });

  it('concurrent calls import once', async () => {
    const r = await Promise.all([importBoardOnce(tmp), importBoardOnce(tmp)]);
    expect(r).toEqual([{ imported: 3 }, { imported: 3 }]);
    expect(await fs.readdir(path.join(tmp, 'shorts', '_imported'))).toEqual(['Existing shorts']);
    expect((await readFolder(tmp, REL)).cards).toHaveLength(3);
  });

  it('gives slugless cards with the same title distinct slugs', async () => {
    await write('.toonforge/board.json', JSON.stringify({
      version: 1, cards: [1, 2].map((i) => ({ id: `n${i}`, slug: '', title: 'Same Title', audioMode: 'needs_vo', rigMode: 'chibi' })),
    }));
    await importBoardOnce(tmp);
    const slugs = (await readFolder(tmp, REL)).cards.map((c: any) => c.slug);
    expect(new Set(slugs).size).toBe(2);
  });
});
