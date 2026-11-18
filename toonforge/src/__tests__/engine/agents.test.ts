// @vitest-environment node
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { agentInvocation, AGENT_INFO, createParser, finalText } from '../../../server/engine/agents.mjs';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'agents');
const parse = (agent: string, file: string): any[] => {
  const p = (createParser as any)(agent);
  return fs.readFileSync(path.join(dir, file), 'utf8').split(/\r?\n/).filter(Boolean).flatMap((l: string) => p(l));
};

describe('agentInvocation', () => {
  it('claude (web) uses the single-token allowedTools form', () => {
    expect(agentInvocation('claude', 'x', { web: true })).toEqual({
      bin: 'claude',
      args: ['-p', '--output-format', 'stream-json', '--verbose', '--permission-mode', 'acceptEdits',
        '--allowedTools=Read,Edit,Write,Glob,Grep,Bash(python:*),Bash(node:*),Bash(npx:*),Bash(ffmpeg:*),Bash(git:*),WebSearch,WebFetch', 'x'],
    });
  });
  it('claude without web omits web tools', () => {
    expect(agentInvocation('claude', 'x', {}).args.at(-2)).not.toMatch(/Web/);
  });
  it('codex, agy, opencode', () => {
    expect(agentInvocation('codex', 'x', {}).args).toEqual(['exec', '--json', '-s', 'workspace-write', 'x']);
    expect(agentInvocation('agy', 'x', {}).args).toEqual(['--mode', 'accept-edits', '--output-format', 'stream-json', '-p', 'x']);
    expect(agentInvocation('opencode', 'x', {})).toEqual({ bin: 'opencode', args: ['run', 'x'] });
  });
  it('AGENT_INFO covers every agent', () => {
    for (const id of ["claude", "codex", "opencode", "agy"] as const) expect(AGENT_INFO[id].enforcement).toBeTruthy();
    expect(AGENT_INFO.claude.canSearchWeb).toBe(true);
  });
});

describe('stream parsing', () => {
  for (const [agent, file] of [['claude', 'claude.jsonl'], ['codex', 'codex.jsonl'], ['agy', 'agy.jsonl']]) {
    it(`${agent} fixture: write of hello.txt and a successful done`, () => {
      const ev = parse(agent, file);
      expect(ev.some((e: any) => e.type === 'file' && e.action === 'write' && e.path.endsWith('hello.txt'))).toBe(true);
      const last = ev.at(-1);
      expect(last.type).toBe('done');
      expect(last.ok).toBe(true);
      expect(finalText(ev)).toContain('DONE');
    });
  }
  it('claude done carries cost and duration', () => {
    const last = parse('claude', 'claude.jsonl').at(-1);
    expect(last.costUsd).toBeGreaterThan(0);
    expect(last.durationMs).toBeGreaterThan(0);
  });
  it('opencode plain text is only message events', () => {
    const ev = parse('opencode', 'opencode.txt');
    expect(ev.length).toBe(3);
    expect(ev.every((e: any) => e.type === 'message')).toBe(true);
    expect(finalText(ev)).toContain('DONE');
  });
  it('garbage line becomes one message', () => {
    for (const a of ['claude', 'codex', 'agy', 'opencode'] as const) {
      expect((createParser as any)(a)('{not json')).toEqual([{ type: 'message', text: '{not json' }]);
    }
  });
});
