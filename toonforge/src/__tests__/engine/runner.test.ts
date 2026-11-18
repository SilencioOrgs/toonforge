// @vitest-environment node
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnLines, runAgent, shimTarget } from '../../../server/engine/runner.mjs';

const node = process.execPath;
const cwd = process.cwd();

describe('spawnLines', () => {
  it('collects lines with streams and exit code', async () => {
    const got: [string, string][] = [];
    const r = await spawnLines(node, ['-e', 'console.log("a");console.error("b");console.log("c")'], {
      cwd, onLine: (l: string, s: string) => got.push([l, s]),
    });
    expect(r.code).toBe(0);
    expect(got).toContainEqual(['a', 'stdout']);
    expect(got).toContainEqual(['b', 'stderr']);
    expect(got).toContainEqual(['c', 'stdout']);
    expect(r.tail).toContain('a');
  });

  it('aborts a sleeping child quickly with code null', async () => {
    const ac = new AbortController();
    const t0 = Date.now();
    const r = await spawnLines(node, ['-e', 'console.log("first");setTimeout(()=>{},30000)'], {
      cwd, signal: ac.signal, onLine: () => ac.abort(),
    });
    expect(r.code).toBeNull();
    expect(Date.now() - t0).toBeLessThan(5000);
  });

  it('rejects ENOENT for a missing binary', async () => {
    await expect(spawnLines('toonforge-no-such-bin', [], { cwd, onLine: () => {} }))
      .rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('passes shell metacharacters literally', async () => {
    const lines: string[] = [];
    await spawnLines(node, ['-e', 'console.log(process.argv[1])', '--', 'x & echo pwned'], {
      cwd, onLine: (l: string) => lines.push(l),
    });
    expect(lines).toEqual(['x & echo pwned']);
  });
});

describe('shimTarget', () => {
  it('extracts the js target from an npm .cmd shim', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'shim-'));
    const shim = path.join(dir, 'codex.cmd');
    fs.writeFileSync(shim,
      '@ECHO off\r\nSET dp0=%~dp0\r\nSETLOCAL\r\nSET "_prog=node"\r\n' +
      '"%_prog%"  "%dp0%\\node_modules\\@openai\\codex\\bin\\codex.js" %*\r\n');
    expect(shimTarget(shim)).toBe(path.join(dir, 'node_modules', '@openai', 'codex', 'bin', 'codex.js'));
  });
  const fixture = (n: string) => path.resolve(__dirname, '../fixtures/shims', n);
  it('picks npx-cli.js, not npm-prefix.js, from the real npx shim', () => {
    const t = shimTarget(fixture('npx.cmd'));
    expect(t).toBe(path.join(path.dirname(fixture('npx.cmd')), 'node_modules', 'npm', 'bin', 'npx-cli.js'));
  });
  it('picks codex.js from the real codex shim', () => {
    const t = shimTarget(fixture('codex.cmd'));
    expect(t).toBe(path.join(path.dirname(fixture('codex.cmd')), 'node_modules', '@openai', 'codex', 'bin', 'codex.js'));
  });
  it('returns null when no target found', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'shim-'));
    const shim = path.join(dir, 'x.cmd');
    fs.writeFileSync(shim, '@echo hi\r\n');
    expect(shimTarget(shim)).toBeNull();
  });
});

describe('runAgent', () => {
  const run = (script: string, agent: any = "opencode", extra = {}) => {
    const events: any[] = [];
    return runAgent(agent, 'p', {
      cwd, onEvent: (e: any) => events.push(e),
      invocation: { bin: node, args: ['-e', script] }, ...extra,
    }).then((r: any) => ({ r, events }));
  };

  it('synthesizes done from exit code when parser emits none', async () => {
    const { r, events } = await run('console.log("hello");');
    expect(r.ok).toBe(true);
    expect(events.at(-1)).toMatchObject({ type: 'done', ok: true });
    expect(events.at(-1).text).toContain('hello');
  });

  it('fails on non-zero exit', async () => {
    const { r } = await run('console.log("x");process.exit(2)');
    expect(r.ok).toBe(false);
    expect(r.events.at(-1)).toMatchObject({ type: 'done', ok: false });
  });

  it('respects a parser done with ok false even on exit 0', async () => {
    const line = JSON.stringify({ type: 'result', subtype: 'error', is_error: true, result: 'bad' });
    const { r } = await run(`console.log(${JSON.stringify(line)})`, 'claude');
    expect(r.ok).toBe(false);
  });

  it('maps ENOENT to AGENT_MISSING', async () => {
    await expect(runAgent('opencode', 'p', {
      cwd, onEvent: () => {}, invocation: { bin: 'toonforge-no-such-bin', args: [] },
    })).rejects.toMatchObject({ code: 'AGENT_MISSING', message: 'OpenCode is not installed or not on PATH.' });
  });
});
