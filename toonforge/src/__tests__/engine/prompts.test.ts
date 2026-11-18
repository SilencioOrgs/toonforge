// @vitest-environment node
import { describe, it, expect } from 'vitest';
// @ts-ignore
import * as p from '../../../server/engine/prompts.mjs';

const SKILL = 'Use the cartoon short skill at ~/.claude/skills/cartoon-3d-short/SKILL.md.';
const card: any = { id: 'c1', slug: 'bridge', compId: 'BridgeShort', title: 'T', hook: 'H', audio: 'vo', rig: 'chibi', files: {} };
const folder: any = { category: 'history', name: 'Batch 1' };

describe('prompts', () => {
  it('all start with the skill sentence', () => {
    const all = [
      p.topicsPrompt({ category: 'c', count: 3, source: 'real', exclude: [], canSearchWeb: true }),
      p.scriptPrompt(card, folder),
      p.scenePrompt(card),
      p.soundPrompt(card),
      p.fixPrompt(card, 'scene', 'err'),
      p.revisePrompt(card, 'note', ['a.png']),
    ];
    for (const s of all) expect(s.startsWith(SKILL)).toBe(true);
  });

  it('topicsPrompt falls back without web search', () => {
    const s = p.topicsPrompt({ category: 'c', count: 3, source: 'real', exclude: ['Old One'], canSearchWeb: false });
    expect(s).toContain('Web access is unavailable, so make the stories up');
    expect(s).not.toContain('search the web');
    expect(s).toContain('Old One');
    expect(p.topicsPrompt({ category: 'c', count: 3, source: 'real', exclude: [], canSearchWeb: true })).toContain('search the web');
  });

  it('scriptPrompt names the path', () => {
    expect(p.scriptPrompt(card, folder)).toContain('shorts/history/Batch 1/bridge/SCRIPT.md');
  });

  it('fixPrompt keeps last 4000 chars', () => {
    const s = p.fixPrompt(card, 'scene', 'Q'.repeat(6000) + 'Z'.repeat(4000));
    expect(s).toContain('Z'.repeat(4000));
    expect(s).not.toContain('Q');
    expect(s).toContain('The engine check after scene failed:');
  });

  it('parseTopics', () => {
    const t = 'Here:\n```json\n[{"title":"A","hook":"h"},{"title":"a","hook":"x"},{"title":"B"}]\n```';
    expect(p.parseTopics(t, 10, [])).toEqual([{ title: 'A', hook: 'h' }, { title: 'B', hook: '' }]);
    expect(p.parseTopics('[{"title":"Kept"},{"title":"New"}]', 5, ['kept'])).toEqual([{ title: 'New', hook: '' }]);
    expect(p.parseTopics('x [{"title":"P"}] y', 5, [])).toEqual([{ title: 'P', hook: '' }]);
    expect(p.parseTopics('Here are [3] ideas:\n[{"title":"Q","hook":"h"}]', 5, [])).toEqual([{ title: 'Q', hook: 'h' }]);
    expect(p.parseTopics('[{"title":"R"}]\n(see [1])', 5, [])).toEqual([{ title: 'R', hook: '' }]);
    expect(p.parseTopics('[{"title":"1"},{"title":"2"}]', 1, [])).toHaveLength(1);
    expect(() => p.parseTopics('no list here', 3, [])).toThrow('Agent did not return a topic list');
  });
});
