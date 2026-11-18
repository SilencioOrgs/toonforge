// @vitest-environment node
import { describe, it, expect } from 'vitest';
import * as m from '../../../server/engine/cardMachine.mjs';

const base = { title: 'T', hook: 'H', rig: 'chibi' as const, slug: 's', compId: 'C' };
const vo = () => m.newCard({ ...base, audio: 'vo' });
const visual = () => m.newCard({ ...base, audio: 'visual' });

describe('cardMachine', () => {
  it('newCard has spec shape', () => {
    const c = vo();
    expect(c.id).toMatch(/^c_[0-9a-f]{8}$/);
    expect(c.state).toBe('script');
    expect(c.imported).toBe(false);
    expect(c.files.previews).toEqual([]);
    expect(c.files.voice).toBeNull();
  });

  it('runs the full VO path', () => {
    let c = vo();
    expect(m.nextJob(c)).toBe('script');
    c = m.completeJob(c, 'script', { files: { script: 'a.md' }, summary: 's' });
    expect(c.state).toBe('voice');
    expect(m.nextJob(c)).toBeNull();
    c = m.attachVoice(c, 'v.mp3');
    expect(m.nextJob(c)).toBe('words');
    c = m.completeJob(c, 'words', { files: { words: 'w.json' }, summary: 's' });
    expect(c.state).toBe('scene');
    c = m.completeJob(c, 'scene', { summary: 's' });
    expect(c.state).toBe('sound');
    c = m.completeJob(c, 'sound', { summary: 's' });
    expect(c.state).toBe('preview');
    c = m.completeJob(c, 'preview', { files: { previews: ['p1.mp4'], stills: ['s1.png'] }, summary: 's' });
    expect(c.state).toBe('review');
    expect(c.files.previews).toEqual(['p1.mp4']);
    expect(m.nextJob(c)).toBeNull();
    c = m.requestRender(c);
    expect(m.nextJob(c)).toBe('render');
    c = m.completeJob(c, 'render', { files: { final: 'f.mp4' }, warnings: ['w'], summary: 's' });
    expect(c.state).toBe('done');
    expect(c.warnings).toEqual(['w']);
    expect(c.files.final).toBe('f.mp4');
  });

  it('completeJob leaves history untouched', () => {
    const c = m.completeJob(visual(), 'script', { summary: 's' });
    expect(c.history).toEqual([]);
  });

  it('visual path skips voice', () => {
    const c = m.completeJob(visual(), 'script', { summary: 's' });
    expect(c.state).toBe('scene');
  });

  it('previews append, stills replace, input untouched', () => {
    let c = m.completeJob(visual(), 'script', { summary: 's' });
    c = m.completeJob(c, 'scene', { summary: 's' });
    c = m.completeJob(c, 'sound', { summary: 's' });
    c = m.completeJob(c, 'preview', { files: { previews: ['p1'], stills: ['a'] }, summary: 's' });
    c = m.submitNotes(c, 'fix', 'now');
    c = m.completeJob(c, 'scene', { summary: 's' });
    c = m.completeJob(c, 'sound', { summary: 's' });
    const before = JSON.stringify(c);
    const n = m.completeJob(c, 'preview', { files: { previews: ['p2'], stills: ['b'] }, summary: 's' });
    expect(JSON.stringify(c)).toBe(before);
    expect(n.files.previews).toEqual(['p1', 'p2']);
    expect(n.files.stills).toEqual(['b']);
  });

  it('submitNotes from review goes to scene with version; elsewhere 409', () => {
    let c = m.completeJob(visual(), 'script', { summary: 's' });
    expect(() => m.submitNotes(c, 'x', 't')).toThrow(expect.objectContaining({ status: 409 }));
    c = m.completeJob(c, 'scene', { summary: 's' });
    c = m.completeJob(c, 'sound', { summary: 's' });
    c = m.completeJob(c, 'preview', { files: { previews: ['p1'] }, summary: 's' });
    c = m.submitNotes(c, 'fix', 'now');
    expect(c.state).toBe('scene');
    expect(c.notes).toEqual([{ at: 'now', text: 'fix', previewVersion: 1 }]);
  });

  it('rejects wrong job kind and bad attachVoice', () => {
    expect(() => m.completeJob(vo(), 'scene', { summary: 's' })).toThrow(expect.objectContaining({ status: 409 }));
    expect(() => m.attachVoice(vo(), 'v')).toThrow(expect.objectContaining({ status: 409 }));
    expect(() => m.requestRender(vo())).toThrow(expect.objectContaining({ status: 409 }));
  });

  it('retry after failed words returns to voice keeping voice', () => {
    let c = m.completeJob(vo(), 'script', { summary: 's' });
    c = m.attachVoice(c, 'v.mp3');
    c = m.failJob(c, 'words', 'boom');
    expect(c.state).toBe('failed');
    expect(c.failedStep).toBe('words');
    expect(c.error).toBe('boom');
    c = m.retry(c);
    expect(c.state).toBe('voice');
    expect(c.files.voice).toBe('v.mp3');
    expect(c.error).toBeNull();
    expect(c.failedStep).toBeNull();
    expect(() => m.retry(c)).toThrow(expect.objectContaining({ status: 409 }));
  });

  it('markInterrupted', () => {
    let c = visual();
    c = m.completeJob(c, 'script', { summary: 's' });
    c = m.completeJob(c, 'scene', { summary: 's' });
    const f = m.markInterrupted(c);
    expect(f.state).toBe('failed');
    expect(f.failedStep).toBe('sound');
    expect(f.error).toBe('Interrupted when ToonForge closed');
    expect(m.retry(f).state).toBe('sound');
  });

  it('imported card has no job until resumed', () => {
    const c = { ...vo(), imported: true };
    expect(m.nextJob(c)).toBeNull();
    expect(m.nextJob({ ...c, resumed: true })).toBe('script');
  });
});
