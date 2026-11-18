// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  createFolder,
  listTree,
  readFolder,
  renameFolder,
  safeFolderName,
  uniqueSlug,
  updateFolder,
} from '../../../server/engine/folders.mjs';

let tmp: string;
beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'tf-folders-'));
});
afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

const today = () => new Date().toISOString().slice(0, 10);

describe('folder store', () => {
  it('creates folder with auto name and default agent file', async () => {
    const f = await createFolder(tmp, { category: 'horror', agent: 'claude' });
    const file = path.join(tmp, 'shorts', 'horror', `Horror ${today()}`, 'toonforge.json');
    const disk = JSON.parse(await fs.readFile(file, 'utf8'));
    expect(disk.version).toBe(1);
    expect(disk.cards).toEqual([]);
    expect(disk.agent).toBe('claude');
    expect(f.name).toBe(`Horror ${today()}`);
  });

  it('sanitizes names', () => {
    expect(safeFolderName('a/b:c')).toBe('a b c');
    expect(safeFolderName('CON')).toBe('_CON');
    expect(safeFolderName('name.')).toBe('name');
    expect(() => safeFolderName('')).toThrow();
  });

  it('duplicate names get suffix', async () => {
    await createFolder(tmp, { category: 'tech', name: 'Night', agent: 'claude' });
    const second = await createFolder(tmp, { category: 'tech', name: 'Night', agent: 'claude' });
    expect(second.name).toBe('Night (2)');
  });

  it('updateFolder serializes concurrent writes', async () => {
    await createFolder(tmp, { category: 'tech', name: 'N', agent: 'claude' });
    const rel = 'shorts/tech/N';
    await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        updateFolder(tmp, rel, (f) => {
          f.cards.push({ id: `c_${i}`, state: 'script' });
        }),
      ),
    );
    expect((await readFolder(tmp, rel)).cards).toHaveLength(20);
  });

  it('atomic write leaves no temp files', async () => {
    await createFolder(tmp, { category: 'tech', name: 'N', agent: 'claude' });
    await updateFolder(tmp, 'shorts/tech/N', (f) => {
      f.cards.push({ id: 'c_1', state: 'script' });
    });
    expect(await fs.readdir(path.join(tmp, 'shorts', 'tech', 'N'))).toEqual(['toonforge.json']);
  });

  it('uniqueSlug avoids existing slugs', async () => {
    await fs.mkdir(path.join(tmp, 'src', 'videos', 'elevator'), { recursive: true });
    expect(await uniqueSlug(tmp, 'Elevator')).toBe('elevator2');
    expect(await uniqueSlug(tmp, 'Fresh Idea!')).toBe('freshidea');
  });

  it('listTree counts by state and always includes default categories', async () => {
    let tree = await listTree(tmp);
    expect(tree.categories.map((c) => c.id)).toEqual(['crime', 'horror', 'tech']);
    await createFolder(tmp, { category: 'horror', name: 'Night Shift', agent: 'claude' });
    await createFolder(tmp, { category: 'My Cat', name: 'X', agent: 'codex' });
    await updateFolder(tmp, 'shorts/horror/Night Shift', (f) => {
      f.cards.push({ id: 'c_1', state: 'script' }, { id: 'c_2', state: 'script' }, { id: 'c_3', state: 'done' });
    });
    tree = await listTree(tmp);
    const horror = tree.categories.find((c) => c.id === 'horror')!;
    expect(horror.folders[0].path).toBe('shorts/horror/Night Shift');
    expect(horror.folders[0].counts.script).toBe(2);
    expect(horror.folders[0].counts.done).toBe(1);
    expect(horror.folders[0].counts.voice).toBe(0);
    expect(tree.categories.map((c) => c.label)).toContain('My Cat');
  });

  it('renameFolder moves the folder and returns the new relPath', async () => {
    await createFolder(tmp, { category: 'tech', name: 'Old', agent: 'claude' });
    const rel = await renameFolder(tmp, 'shorts/tech/Old', 'New');
    expect(rel).toBe('shorts/tech/New');
    expect((await readFolder(tmp, rel)).name).toBe('New');
  });
});
