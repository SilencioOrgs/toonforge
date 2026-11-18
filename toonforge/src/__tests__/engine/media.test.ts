// @vitest-environment node
import { describe, it, expect } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { previewArgs, stillFrames, qaWarnings, snapshotScene } from '../../../server/engine/media.mjs';
import { TOOL_SPECS } from '../../../server/services/workspaceService.mjs';
import { installCommand } from '../../../server/services/jobRunner.mjs';

describe('engine media', () => {
  it('previewArgs', () => {
    expect(previewArgs('ElevatorShort', 'elevator', 2)).toEqual([
      'remotion', 'render', 'src/index.ts', 'ElevatorShort', 'out/elevator/preview-v2.mp4',
      '--codec', 'h264', '--crf', '28', '--scale', '0.25',
    ]);
  });
  it('stillFrames', () => {
    expect(stillFrames(1800)).toEqual([180, 630, 1080, 1530]);
    expect(stillFrames(3).every((f: number) => f <= 2)).toBe(true);
  });
  it('qaWarnings extracts defects and bad loudness', () => {
    const report = 'FRAMES 900 black [12, 13]\nLOUDNESS I: -19.2 LUFS | LRA: 3\nSILENCES none';
    expect(qaWarnings(report)).toHaveLength(2);
    expect(qaWarnings('LOUDNESS I: -15.0 LUFS')).toEqual([]);
    expect(qaWarnings('LOUDNESS LUFS -19.2 | x')).toHaveLength(1);
  });
  it('snapshotScene copies and leaves the original', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'tf-'));
    await fs.mkdir(path.join(root, 'src/videos/a'), { recursive: true });
    await fs.writeFile(path.join(root, 'src/videos/a/x.ts'), 'hi');
    await snapshotScene(root, 'a', 3);
    expect(await fs.readFile(path.join(root, 'out/a/versions/v3/scene/x.ts'), 'utf8')).toBe('hi');
    expect(await fs.readFile(path.join(root, 'src/videos/a/x.ts'), 'utf8')).toBe('hi');
    await fs.writeFile(path.join(root, 'src/videos/a/x.ts'), 'edited');
    await snapshotScene(root, 'a', 3);
    expect(await fs.readFile(path.join(root, 'out/a/versions/v3/scene/x.ts'), 'utf8')).toBe('hi');
    await snapshotScene(root, 'missing', 1);
    await fs.rm(root, { recursive: true, force: true });
  });
  it('whisper tool and installer', () => {
    expect(TOOL_SPECS.some((s: { id: string }) => s.id === 'whisper')).toBe(true);
    expect(installCommand('whisper')).toBe('python -m pip install faster-whisper');
  });
});
