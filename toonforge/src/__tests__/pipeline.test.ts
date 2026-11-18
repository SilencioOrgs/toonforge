import { describe, expect, it } from 'vitest';
import { estimateSeconds, nextStep, stepDone } from '../lib/pipeline';
import type { CardItem } from '../types/studio';

const base: CardItem = {
  id: 'a',
  slug: 'a',
  title: 'A',
  lane: 'backlog',
  audioMode: 'needs_vo',
  rigMode: 'chibi',
  durationLabel: '',
  compositionId: 'AShort',
};

describe('pipeline status', () => {
  it('walks steps in order from workspace artifacts', () => {
    expect(nextStep(undefined)).toBe('topic');
    expect(nextStep(base)).toBe('script');
    expect(nextStep({ ...base, scriptFile: 'SCRIPT_A.md' })).toBe('voice');
    expect(nextStep({ ...base, scriptFile: 'S', audioMode: 'no_vo' })).toBe('scenes');
    expect(stepDone({ ...base, stills: ['x.jpg'] }, 'scenes')).toBe(true);
    expect(stepDone({ ...base, videoFile: 'v.mp4' }, 'render')).toBe(false);
    expect(stepDone({ ...base, videoFile: 'v.mp4', qaReport: 'r.md' }, 'render')).toBe(true);
  });

  it('estimates spoken length without headings or [SFX] tags', () => {
    const words = Array.from({ length: 37 }, () => 'word').join(' ');
    expect(estimateSeconds(`# Title here\n${words} [SFX: WHOOSH_IN]`)).toBe(10);
  });
});
