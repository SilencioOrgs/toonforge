# ToonForge Automation Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn ToonForge into a VS Code-style app (explorer, Trello board, live agent panel) where a Node engine runs the claude-animated-shorts pipeline per card with any of four agent CLIs.

**Architecture:** A single Node engine (`server/engine/*`) owns per-folder storage (`toonforge.json`), a pure card state machine, agent adapters with streamed events, a one-at-a-time job queue, and engine-run media commands; it serves HTTP + Server-Sent Events to the React UI. Tauri becomes a thin shell that spawns the engine and points its window at it. All engine dependencies (process runner, agent runner, media, clock) are injected so the queue is testable without real CLIs.

**Tech Stack:** Node ≥ 20 (ESM `.mjs`), React 19 + Vite + Vitest + Testing Library, lucide-react, Remotion 4.0.544 (existing scripts), Python 3 + faster-whisper, Tauri v2 (Rust, thin).

**Spec:** `docs/superpowers/specs/2026-11-18-toonforge-automation-shell-design.md`

Paths below are relative to `toonforge/` unless they start with `<repo>/` (the parent folder `crime scene animation/`, which is the Remotion workspace and `repoRoot`).

## Global Constraints

- Agent prompts are never run through a shell; every spawn uses an argument array (`execFile`/`spawn` without `shell: true`).
- Agents may only run `python`, `node`, `npx`, `ffmpeg`, `git` inside the workspace; typecheck, preview render, final render, stills, QA and word timings are run by the engine.
- Agent invocations (verbatim from spec):
  - Claude: `claude -p --output-format stream-json --verbose --permission-mode acceptEdits --allowedTools <allow-list> <prompt>`
  - Codex: `codex exec --json -s workspace-write <prompt>`
  - Antigravity: `agy --mode accept-edits --output-format stream-json -p <prompt>`
  - OpenCode: `opencode run <prompt>` (plain text lines)
- Claude allow-list: `Read,Edit,Write,Glob,Grep,Bash(python:*),Bash(node:*),Bash(npx:*),Bash(ffmpeg:*),Bash(git:*)`; topic jobs add `WebSearch,WebFetch`.
- Every prompt names the skill: "Use the cartoon short skill at ~/.claude/skills/cartoon-3d-short/SKILL.md".
- Storage: `<repo>/shorts/<category>/<folder>/toonforge.json` (version 1), written atomically (temp file + rename).
- Card states: `script | voice | scene | sound | preview | review | render | done | failed`. Visual cards skip `voice`.
- Preview: Remotion `--scale 0.25`, output `out/<slug>/preview-v<N>.mp4`, never overwritten. Final: existing command `npx remotion render src/index.ts <CompId> out/<slug>/<slug>_2k.mp4 --codec h264 --crf 16 --scale 1.3333333333333333`, then `python scripts/short_qa.py out/<slug>/<slug>_2k.mp4 out/<slug>/qa`.
- Scene snapshot before every revision: copy `src/videos/<slug>/` to `out/<slug>/versions/v<N>/scene/`.
- Auto-fix: up to 2 automatic "fix this" agent attempts after a failed engine check, then `failed`. QA findings → `done` with `warnings`.
- Queue: one global FIFO, one job at a time, render jobs ahead of agent jobs; each job uses its folder's `agent`.
- Topic count 1–20, default 10. Categories: `crime` ("Real crime"), `horror` ("Horror"), `tech` ("Tech"), plus user categories.
- Visual identity: monochrome zinc, single emerald accent for priority objects, Playfair Display only for display, Poppins UI, mono for logs/paths (existing `src/styles/toonforge.css` tokens).
- Windows 11 first; this build targets the creator's PC with `<repo>` as the workspace (no installer).

## Review Focus

1. **Agent returns unusable topic output** (prose, fenced JSON, fewer titles than asked, duplicates of starred titles): parse fenced/embedded JSON, dedupe against existing titles, one automatic retry, then a visible error on the topics pop-up. Tests in Task 4 and Task 7.
2. **Wrong or huge file dropped on a card** (`.m4a`, a 2 GB video, a folder): only `.wav`/`.mp3` up to 200 MB accepted, with a message naming the rule; card state unchanged. Tests in Task 8 and Task 12.
3. **Folder names Windows rejects or that already exist** (`a/b`, `CON`, trailing dot, duplicate): sanitized, reserved names prefixed, duplicates get ` (2)`, ` (3)`. Tests in Task 1.
4. **ToonForge closed mid-job:** on engine start, any card whose state is a running step with no live job becomes `failed` with "Interrupted when ToonForge closed" and Retry. Tests in Task 7.
5. **Agent not installed or not signed in:** spawn `ENOENT` or an auth error fails the job immediately with "<agent> is not installed" / the CLI's message, without spending auto-fix attempts. Tests in Task 5 and Task 7.

---

### Task 1: Folder store

**Files:**
- Create: `server/engine/folders.mjs`
- Modify: `tsconfig.json` (add `"allowJs": true`, keep `checkJs` off); delete `server/bridge.d.mts`, `server/services/jobRunner.d.mts`, `server/services/workspaceService.d.mts` once `tsc --noEmit` passes without them
- Test: `src/__tests__/engine/folders.test.ts` (first line `// @vitest-environment node`)

**Interfaces:**
- Produces:
  - `DEFAULT_CATEGORIES: { id: 'crime'|'horror'|'tech', label: string }[]` = Real crime, Horror, Tech
  - `safeFolderName(name: string): string`
  - `createFolder(repoRoot, { category: string, name?: string, agent: AgentId }): Promise<Folder>` (auto name `"<Label> <YYYY-MM-DD>"` when empty)
  - `listTree(repoRoot): Promise<{ categories: { id, label, folders: { path: string, name: string, counts: Record<CardState, number> }[] }[] }>` (`path` is relative to `<repo>`, e.g. `shorts/horror/Night Shift`); the three defaults first, then every other directory under `shorts/` as a user category (label = directory name; `_imported` labelled "Imported")
  - `createFolder` accepts any `category` string: a non-default value is passed through `safeFolderName` and becomes a user category directory
  - `readFolder(repoRoot, relPath): Promise<Folder>`
  - `updateFolder(repoRoot, relPath, mutate: (f: Folder) => Folder | void): Promise<Folder>` (serialized per folder with an in-process promise chain; atomic write)
  - `renameFolder(repoRoot, relPath, newName): Promise<string>` (returns new relPath)
  - `uniqueSlug(repoRoot, title): Promise<string>` (lowercase a–z0–9, max 24 chars, unique against all folders' cards, `<repo>/src/videos/*`, `<repo>/out/*`; suffix `2`, `3`…)
  - `Folder` = spec `toonforge.json` shape; `Card` = spec card shape with `id` (`c_` + 8 hex), `compId` (`compositionIdFromSlug(slug)` from `workspaceService.mjs`).

- [ ] **Step 1: Write failing tests**
  - `creates folder with auto name and default agent file`: `createFolder(tmp, { category: 'horror', agent: 'claude' })` → file exists at `shorts/horror/Horror <today>/toonforge.json`; `version === 1`, `cards` empty.
  - `sanitizes names`: `safeFolderName('a/b:c')` → `'a b c'`; `'CON'` → `'_CON'`; `'name.'` → `'name'`; `''` → throws.
  - `duplicate names get suffix`: two `createFolder` with name `'Night'` → second folder name `'Night (2)'`.
  - `updateFolder serializes concurrent writes`: 20 parallel `updateFolder` calls each pushing one card → 20 cards persisted.
  - `atomic write leaves no temp files`: after writes, the folder dir contains only `toonforge.json` (+ card dirs).
  - `uniqueSlug avoids existing slugs`: with `<tmp>/src/videos/elevator` present, `uniqueSlug(tmp, 'Elevator')` → `'elevator2'`.
  - `listTree counts by state` and always includes the three default categories even when empty.

- [ ] **Step 2: Run** `npx vitest run src/__tests__/engine/folders.test.ts` → FAIL (module missing).
- [ ] **Step 3: Implement** `server/engine/folders.mjs` with the signatures above (temp file `toonforge.json.tmp-<pid>-<n>` then `fs.rename`).
- [ ] **Step 4: Run** the test file → PASS; `npx tsc --noEmit` → no errors after deleting the `.d.mts` files.
- [ ] **Step 5: Commit** `feat(engine): per-folder toonforge.json store`

---

### Task 2: Card state machine

**Files:**
- Create: `server/engine/cardMachine.mjs`
- Test: `src/__tests__/engine/cardMachine.test.ts` (node env)

**Interfaces:**
- Consumes: `Card` from Task 1.
- Produces:
  - `JobKind = 'topics' | 'script' | 'words' | 'scene' | 'sound' | 'preview' | 'render'`
  - `newCard({ title, hook, audio: 'vo'|'visual', rig: 'chibi'|'stickman', slug, compId }): Card` (state `script`)
  - `nextJob(card): JobKind | null` — `script→script`, `voice→null` (waits; `words` once `files.voice` set and `files.words` null), `scene→scene`, `sound→sound`, `preview→preview`, `render→render`, `review|done|failed→null`, `imported` cards → `null` unless `card.resumed`
  - `completeJob(card, kind, result: { files?: Partial<Card['files']>, summary: string }): Card` — advances: script→(vo? voice : scene), words→scene, scene→sound, sound→preview, preview→review (pushes preview path to `files.previews`), render→done (copies `result.warnings` to `card.warnings`)
  - `failJob(card, kind, error: string): Card` → state `failed`, `failedStep = kind`, `error`
  - `retry(card): Card` → state from `failedStep` (`words` maps back to `voice`), clears `error`
  - `submitNotes(card, text, at): Card` → only from `review`; pushes note `{ at, text, previewVersion: card.files.previews.length }`; state `scene`
  - `requestRender(card): Card` → only from `review`; state `render`
  - `attachVoice(card, relPath): Card` → only when `audio === 'vo'` and state `voice`; sets `files.voice`
  - `markInterrupted(card): Card` → if state in `script|scene|sound|preview|render` → `failJob(card, state, 'Interrupted when ToonForge closed')`
  - Invalid transitions throw `ValidationError` (from `workspaceService.mjs`) with status 409.

- [ ] **Step 1: Write failing tests**: full VO path script→voice→(attachVoice)→words→scene→sound→preview→review→render→done; visual path skips voice; `submitNotes` from `review` returns to `scene` with note version 1; `submitNotes` from `scene` throws 409; `retry` after `failJob(card,'words',…)` returns `voice` with `files.voice` kept; `markInterrupted` on `sound` → `failed` with the exact message; imported card `nextJob` is `null` until `{...card, resumed: true}`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** as pure functions returning new objects. **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(engine): card state machine`

---

### Task 3: Agent adapters and stream parsing

**Files:**
- Create: `server/engine/agents.mjs`
- Create fixtures: `src/__tests__/fixtures/agents/claude.jsonl`, `codex.jsonl`, `agy.jsonl`, `opencode.txt`
- Modify: `server/services/jobRunner.mjs` (`AI_ENGINE_ARGS` and `execWorkspaceCommand` deleted in Task 8; nothing here yet)
- Test: `src/__tests__/engine/agents.test.ts` (node env)

**Interfaces:**
- Produces:
  - `AgentId = 'claude' | 'codex' | 'opencode' | 'agy'`
  - `agentInvocation(agent: AgentId, prompt: string, opts: { web?: boolean }): { bin: string, args: string[] }` — exactly the Global Constraints commands; Claude adds `WebSearch,WebFetch` to `--allowedTools` when `web`.
  - `AGENT_INFO: Record<AgentId, { label: string, canSearchWeb: boolean, enforcement: string, structured: boolean }>` — `enforcement` is the user-facing sentence shown in the panel, e.g. Claude "Limited to the skill's commands (python, node, npx, ffmpeg, git)", Codex "Limited to this workspace folder; any command inside it", OpenCode "Uses your OpenCode permission settings". Antigravity's sentence is decided in Step 1 below.
  - `AgentEvent = { type: 'message', text } | { type: 'tool', name, target } | { type: 'file', path, action: 'read'|'write' } | { type: 'error', text } | { type: 'done', ok: boolean, text: string, costUsd?: number, durationMs?: number }`
  - `createParser(agent): (line: string) => AgentEvent[]` (stateful per run; unparseable lines become `message`)
  - `finalText(events: AgentEvent[]): string` (the `done.text`, else joined `message` texts)

- [ ] **Step 1: Capture fixtures** by running each installed CLI once in a temp folder with prompt `Create a file hello.txt containing hi, then reply DONE.` using the args from `agentInvocation`, saving stdout lines to the fixture files (OpenCode: write a 3-line plain text fixture by hand if it is not installed). While doing this, check `agy --help`/`agy --settings` for a way to narrow commands; record the resulting Antigravity `enforcement` sentence in a code comment and in `AGENT_INFO`.
- [ ] **Step 2: Write failing tests**: `agentInvocation('claude','x',{web:true}).args` equals `['-p','--output-format','stream-json','--verbose','--permission-mode','acceptEdits','--allowedTools','Read,Edit,Write,Glob,Grep,Bash(python:*),Bash(node:*),Bash(npx:*),Bash(ffmpeg:*),Bash(git:*),WebSearch,WebFetch','x']`; codex args `['exec','--json','-s','workspace-write','x']`; agy args `['--mode','accept-edits','--output-format','stream-json','-p','x']`; each fixture parses to at least one `file` event with `path` ending `hello.txt` and `action: 'write'` (OpenCode: only `message` events) and ends with a `done` event whose `ok` is true; garbage line `"{not json"` → one `message` event.
- [ ] **Step 3: Run** → FAIL. **Step 4: Implement** adapters and parsers. **Step 5: Run** → PASS.
- [ ] **Step 6: Commit** `feat(engine): agent adapters with streamed events`

---

### Task 4: Prompts and topic parsing

**Files:**
- Create: `server/engine/prompts.mjs`
- Test: `src/__tests__/engine/prompts.test.ts` (node env)

**Interfaces:**
- Consumes: `Card`, `Folder` (Task 1).
- Produces (all return strings that start with `Use the cartoon short skill at ~/.claude/skills/cartoon-3d-short/SKILL.md.`):
  - `topicsPrompt({ category: string, count: number, source: 'real'|'made_up', exclude: string[], canSearchWeb: boolean })` — asks for a JSON array of `{ "title", "hook" }` only; for `real` + `canSearchWeb` asks to search the web for true stories; `exclude` titles listed verbatim.
  - `scriptPrompt(card, folder)` → write `shorts/<category>/<folder>/<slug>/SCRIPT.md`, 55–70 s, ~3.7 words/s, `[SFX: …]` cues on own lines, plus a `## Narration` section with clean spoken text for VO cards.
  - `scenePrompt(card)` → copy `templates/bridge/` to `src/videos/<slug>/`, shot plan in `story.ts` (timed to `words.json` when present), characters with the card's rig, register composition `<compId>` in `src/Root.tsx`; do not render.
  - `soundPrompt(card)` → build SFX + music from `story.ts`; mix under `voice` with ducking or music-only; write `out/<slug>/mix.wav` and wire it into the composition per the skill.
  - `fixPrompt(card, step: JobKind, errorText: string)` → "The engine check after <step> failed:" + last 4000 chars of `errorText` + "Fix the files so it passes. Do not render."
  - `revisePrompt(card, note: string, stillPaths: string[])` → revise scene (and sound if needed) per the note; lists still image paths.
  - `parseTopics(text: string, count: number, exclude: string[]): { title: string, hook: string }[]` — accepts raw JSON, ```json fenced JSON, or the first `[...]` block in prose; trims; drops items missing `title`, duplicates (case-insensitive) and anything in `exclude`; returns at most `count`; throws `Error('Agent did not return a topic list')` when zero remain.

- [ ] **Step 1: Write failing tests**: every prompt starts with the skill sentence; `topicsPrompt` with `source:'real', canSearchWeb:false` contains `"made up"` fallback wording and not `"search the web"`; `parseTopics('Here:\n```json\n[{"title":"A","hook":"h"},{"title":"a","hook":"x"},{"title":"B"}]\n```', 10, [])` → `[{title:'A',hook:'h'},{title:'B',hook:''}]`; `parseTopics('[{"title":"Kept"},{"title":"New"}]', 5, ['kept'])` → `[{title:'New',hook:''}]`; `parseTopics('no list here', 3, [])` throws; `fixPrompt` includes only the last 4000 chars of a 10 000-char error.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(engine): skill prompts and topic parsing`

---

### Task 5: Process runner

**Files:**
- Create: `server/engine/runner.mjs`
- Test: `src/__tests__/engine/runner.test.ts` (node env)

**Interfaces:**
- Produces:
  - `spawnLines(bin: string, args: string[], { cwd: string, onLine: (line: string, stream: 'stdout'|'stderr') => void, signal?: AbortSignal }): Promise<{ code: number | null, tail: string }>` — `spawn` with `shell: false`, `windowsHide: true`; line-buffered; `tail` = last 8000 chars of combined output; rejects with `Error` whose `code === 'ENOENT'` when the binary is missing.
  - `killTree(pid: number): Promise<void>` — Windows `taskkill /PID <pid> /T /F`; elsewhere `process.kill(-pid)` with the child spawned `detached: true`.
  - Abort via `signal` calls `killTree` and resolves `{ code: null, … }`.
  - `runAgent(agent, prompt, { cwd, web?, signal, onEvent }): Promise<{ ok: boolean, events: AgentEvent[], tail: string }>` — uses `agentInvocation` + `createParser` (Task 3); `ok` = exit code 0 and last `done.ok !== false`; ENOENT rethrown as `Error('<label> is not installed or not on PATH.')` with `code = 'AGENT_MISSING'`.

- [ ] **Step 1: Write failing tests**: `spawnLines(process.execPath, ['-e', 'console.log("a");console.error("b");console.log("c")'], …)` collects `a`,`b`,`c` with correct streams and `code 0`; a script printing a line then sleeping 30 s is aborted after the first line and resolves within 5 s with `code: null`; missing binary rejects with `code 'ENOENT'`; an argument containing `& echo pwned` is passed literally (child echoes `process.argv[1]` back unchanged).
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(engine): streaming process runner with cancel`

---

### Task 6: Engine media commands and faster-whisper

**Files:**
- Create: `server/engine/media.mjs`, `server/engine/words.py`
- Modify: `server/services/workspaceService.mjs` (`TOOL_SPECS`: add `{ id: 'whisper', name: 'faster-whisper', bin: 'python', args: ['-c', 'import faster_whisper; print("faster-whisper OK")'], role: 'Makes word timings (words.json) from your voice file', installCmd: 'python -m pip install faster-whisper' }`), `server/services/jobRunner.mjs` (`INSTALLERS.whisper = { any: 'python -m pip install faster-whisper' }`)
- Test: `src/__tests__/engine/media.test.ts` (node env)

**Interfaces:**
- Consumes: `spawnLines` (Task 5).
- Produces (each returns `{ ok: boolean, tail: string, files?: object, warnings?: string[] }` and streams lines through `onLine`):
  - `typecheck(repoRoot, { onLine, signal })` → `npx tsc --noEmit`
  - `previewArgs(compId, slug, version): string[]` → `['remotion','render','src/index.ts',compId,'out/<slug>/preview-v<version>.mp4','--codec','h264','--crf','28','--scale','0.25']`
  - `renderPreview(repoRoot, card, version, { onLine, signal })` → runs `npx` with `previewArgs`; then `stillFrames` + stills; `files: { previews: [path], stills: [paths] }`
  - `stillFrames(totalFrames: number): number[]` → 4 frames at 10 %, 35 %, 60 %, 85 % (rounded, clamped to `totalFrames - 1`)
  - stills: `node scripts/stills.mjs out/<slug>/stills/v<version>_ <frames joined by ,> 0.5 <compId>`; total frames from `ffprobe -v error -count_packets -select_streams v:0 -show_entries stream=nb_read_packets -of csv=p=0 <preview>`
  - `renderFinal(repoRoot, card, { onLine, signal })` → final command from Global Constraints, then QA command; `warnings` = QA lines matching `black \[\d+`, `unplanned white \[\d+`, `frozen spans >=12f \[\d+`, or loudness outside −16…−14 LUFS
  - `makeWords(repoRoot, voiceRelPath, outRelPath, { onLine, signal })` → `python server/engine/words.py <voice> <out>` (`words.py` writes `[{ "word", "start", "end" }]` using faster-whisper `small`, `word_timestamps=True`)
  - `snapshotScene(repoRoot, slug, version)` → copies `src/videos/<slug>/` to `out/<slug>/versions/v<version>/scene/` (no-op if the scene folder is missing)

- [ ] **Step 1: Write failing tests**: `previewArgs('ElevatorShort','elevator',2)` equals the array above with `out/elevator/preview-v2.mp4`; `stillFrames(1800)` → `[180, 630, 1080, 1530]`, `stillFrames(3)` → values all ≤ 2; QA warning extraction from a sample report string containing `FRAMES … black [12, 13]` and `LUFS -19.2` yields 2 warnings; `snapshotScene` copies a temp scene folder and does not touch the original; `getEnvStatus` probes include `whisper`; `installCommand('whisper')` → `'python -m pip install faster-whisper'`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** Command execution itself (npx/python) is exercised manually in Task 16. **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(engine): preview, final render, stills, QA and word timings`

---

### Task 7: Job queue and step executors

**Files:**
- Create: `server/engine/queue.mjs`, `server/engine/events.mjs`
- Test: `src/__tests__/engine/queue.test.ts` (node env)

**Interfaces:**
- Consumes: Tasks 1, 2, 4, 5, 6.
- Produces:
  - `events.mjs`: `createBus(): { emit(type: string, payload: object): void, subscribe(fn): () => void }`. Event types: `queue.changed {queue}`, `job.started {job}`, `job.event {jobId, event: AgentEvent | { type: 'log', text }}`, `job.finished {job, ok, error?}`, `folder.changed {path}`.
  - `Job = { id: string, kind: JobKind, folderPath: string, cardId?: string, agent: AgentId, attempt: number, queuedAt: string, startedAt?: string, payload?: object }`
  - `createQueue({ repoRoot, bus, store = folders, agents = { runAgent }, media, now = () => new Date() })` returning:
    - `start(): Promise<void>` — runs `markInterrupted` over every card in every folder, then begins processing
    - `enqueueCard(folderPath, cardId): Job | null` (uses `nextJob`; ignores duplicates for the same card)
    - `enqueueTopics(folderPath, { count, source, exclude }): Job`
    - `cancel(): Promise<void>` (aborts the running job; its card → `failed` with `"Cancelled"`)
    - `setPaused(paused: boolean)`, `reorder(jobIds: string[])`, `remove(jobId)`
    - `snapshot(): { running: Job | null, queued: Job[], paused: boolean }`
  - Executors (one per `JobKind`) inside `queue.mjs`:
    - `topics`: `runAgent(folder.agent, topicsPrompt(...), { web: source === 'real' && canSearchWeb })` → `parseTopics`; on parse error one automatic retry; result written to `folder.topicRun = { count, source, state: 'ready', titles }` (starred titles from the previous run are kept first); failure → `topicRun.state = 'error'`, `topicRun.error`.
    - `script`, `scene`, `sound`: `runAgent` with the matching prompt, then engine check (script: `SCRIPT.md` exists; scene: `typecheck`; sound: `out/<slug>/mix.wav` exists); failed check → `fixPrompt` up to 2 more agent runs, then `failJob`. Scene with `card.notes.length > 0` uses `revisePrompt(latest note)` and calls `snapshotScene` first.
    - `words`: `media.makeWords` → `files.words`.
    - `preview`: `media.renderPreview` with `version = files.previews.length + 1`.
    - `render`: `media.renderFinal`.
    - After each job: `completeJob`/`failJob` via `updateFolder`, `history.push({ at, step, agent, ok, summary, logFile })`, log written to `out/<slug>/logs/<step>-<timestamp>.jsonl`, `folder.changed` emitted, then `enqueueCard` for the next step.
    - `AGENT_MISSING` errors fail immediately (no fix attempts).
    - Render jobs are inserted before the first non-render queued job.

- [ ] **Step 1: Write failing tests** (fake `runAgent`/`media` record calls and return scripted results; temp repo from Task 1 helpers):
  - `runs one job at a time`: enqueue 3 cards; at no point are two fake runs active.
  - `render jumps ahead`: queue `[scene A, scene B]`, enqueue render C → order `[render C, scene A, scene B]` (running job untouched).
  - `auto-fix twice then fail`: scene typecheck fails 3 times → `runAgent` called 3 times (1 + 2 fixes) and card `failed` with `failedStep 'scene'`.
  - `agent missing fails fast`: `runAgent` rejects with `code 'AGENT_MISSING'` → 1 call, card `failed`, error text `'Codex is not installed or not on PATH.'`.
  - `interrupted on start`: a folder with a card in `sound` → after `start()`, card `failed` with `'Interrupted when ToonForge closed'`.
  - `revision snapshots`: card with one note in `scene` → `media.snapshotScene` called with version 2 before `runAgent`.
  - `topics retry then error`: fake agent returns prose twice → `topicRun.state === 'error'` and 2 agent calls.
  - `topics keeps starred`: previous run with starred `"Kept"` → new `titles[0].title === 'Kept'` and `exclude` passed to the prompt contains it.
  - `cancel`: long fake run + `cancel()` → card `failed` with `'Cancelled'`, next job starts.
  - `paused`: `setPaused(true)` → enqueued job does not start until `setPaused(false)`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(engine): job queue with auto-fix, priorities and recovery`

---

### Task 8: HTTP routes and live events

**Files:**
- Create: `server/engine/routes.mjs`
- Modify: `server/bridge.mjs` (delegate to `routes.mjs`; create one queue per `repoRoot` lazily and call `start()`; add `.jsonl` → `text/plain; charset=utf-8` to `MIME_MAP`; delete routes `/board`, `/cards`, `/voice`, `/script`, `/pipeline/run`, `/cli/exec`), `server/services/jobRunner.mjs` (delete `AI_ENGINE_ARGS`, `execWorkspaceCommand`, `runPipelineAction`), `src/__tests__/backend.test.ts` (delete tests for removed routes)
- Test: `src/__tests__/engine/routes.test.ts` (node env, real HTTP server on a temp repo, fake agents injected via `handleApiRequest(req, res, repoRoot, { agents, media })`)

**Interfaces:**
- Consumes: Tasks 1, 2, 7.
- Produces (all JSON; folder `path` query values are relative paths under `shorts/` and are rejected with 400 otherwise):
  - `GET /api/tree` → `listTree`
  - `POST /api/folders {category, name?, agent}` → `Folder`
  - `GET /api/folder?path=` → `Folder`; `PATCH /api/folder?path= {name?, agent?}` → `Folder` (+ `path` when renamed)
  - `POST /api/topics?path= {count, source}` → `Job`; `PATCH /api/topics?path= {titles}` (stars/removals) → `Folder`; `POST /api/topics/reroll?path=` → `Job`; `POST /api/topics/approve?path= {items: {title, hook, audio, rig}[]}` → `Folder` (creates cards, appends `- <title>: <hook>` lines to the folder's `topics.md`, enqueues script jobs, clears `topicRun`)
  - `POST /api/card/voice?path=&card=` body `application/octet-stream`, header `x-file-name` → `Folder` (`.wav`/`.mp3` only, ≤ 200 MB, else 415/413 with message `Drop a .wav or .mp3 file up to 200 MB.`)
  - `POST /api/card/notes?path=&card= {text}`, `/api/card/render`, `/api/card/retry`, `/api/card/resume` → `Folder`
  - `PUT /api/card/script?path=&card= {content}` → `{ ok: true }`
  - `GET /api/queue` → `snapshot()`; `POST /api/queue/cancel`, `/api/queue/pause {paused}`, `/api/queue/reorder {jobIds}`, `/api/queue/remove {jobId}`
  - `GET /api/events` → `text/event-stream`, one `data: {"type", ...payload}` line per bus event, `: ping` every 15 s
  - `GET /api/health` → `{ ok: true }`

- [ ] **Step 1: Write failing tests**: create folder → tree lists it; approve 2 items → folder has 2 cards in `script` and `GET /api/queue` shows a script job; `GET /api/events` receives `folder.changed` after a notes call (read the first event with a 2 s timeout); voice upload of `voice.m4a` → 415 with the exact message, 201 MB body → 413; `path=../../etc` → 400; `POST /api/card/notes` on a card in `script` → 409.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** all tests (`npx vitest run`) → PASS.
- [ ] **Step 5: Commit** `feat(engine): HTTP routes and server-sent events`

---

### Task 9: Import existing shorts

**Files:**
- Create: `server/engine/migrate.mjs`
- Modify: `server/engine/queue.mjs` (`start()` calls `importBoardOnce` first)
- Test: `src/__tests__/engine/migrate.test.ts` (node env)

**Interfaces:**
- Consumes: `loadAndEnrichBoard` (`workspaceService.mjs`), Task 1 store.
- Produces: `importBoardOnce(repoRoot): Promise<{ imported: number }>` — no-op if `<repo>/shorts/_imported/Existing shorts/toonforge.json` exists or `.toonforge/board.json` is missing. Mapping: `videoFile && qaReport → done`, `videoFile → review` (preview list = `[videoFile]`), `voiceFile || audioMode==='no_vo' → scene`, `audioMode==='needs_vo' → voice`, else `script`; `audio = audioMode==='no_vo' ? 'visual' : 'vo'`; `rig = rigMode`; `files.script = scriptFile`, `files.voice = voicePath`, `files.mix = mixWavFile`, `files.final = videoFile`, `files.qa = qaReport`; `imported: true`; category `_imported`, agent `claude`. `board.json` is never modified.

- [ ] **Step 1: Write failing tests**: a temp repo with a 3-card `board.json` (one done, one with VO, one needing VO) imports to states `done`, `scene`, `voice` with `imported: true`; second call returns `{ imported: 0 }`; `board.json` bytes unchanged; queue `start()` does not enqueue imported cards.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(engine): one-time import of existing shorts`

---

### Task 10: Frontend engine client and live store

**Files:**
- Create: `src/lib/engine.ts`, `src/lib/useEngine.ts`
- Modify: `src/lib/backend.ts` (remove the Tauri branches and the deleted endpoints: `loadBoard`, `saveBoard`, `createCard`, `uploadVoiceover`, `getCardScript`, `saveCardScript`, `runPipeline`, `execCliCommand`; keep `getEnvStatus`, `getRigs`, `syncRepo`, `installTool`, `mediaUrl` as plain HTTP)
- Test: `src/__tests__/useEngine.test.ts`

**Interfaces:**
- Consumes: Task 8 routes.
- Produces:
  - Types mirroring the spec: `AgentId`, `CardState`, `Card`, `Folder`, `TreeCategory`, `Job`, `QueueSnapshot`, `AgentEvent`, `EngineEvent`.
  - `engine` object with one async method per route: `tree()`, `createFolder(input)`, `folder(path)`, `updateFolder(path, patch)`, `generateTopics(path, {count, source})`, `saveTopics(path, titles)`, `reroll(path)`, `approve(path, items)`, `uploadVoice(path, cardId, file: File)`, `notes(path, cardId, text)`, `render(path, cardId)`, `retry(path, cardId)`, `resume(path, cardId)`, `saveScript(path, cardId, content)`, `queue()`, `cancel()`, `pause(paused)`, `reorder(ids)`, `removeJob(id)`.
  - `subscribe(onEvent: (e: EngineEvent) => void): () => void` using `EventSource('/api/events')` with automatic reconnect.
  - `useEngine(openPath: string | null): { tree, folder, queue, liveEvents: Record<string, AgentEvent[]> (by job id, last 500 each), refreshTree(), connected: boolean }` — refetches `tree` and the open folder on `folder.changed`, replaces `queue` on `queue.changed`, appends on `job.event`.
- [ ] **Step 1: Write failing tests** with a fake `EventSource` (assigned to `globalThis`) and mocked `fetch`: `folder.changed` for the open path triggers one `folder()` refetch; for another path it only refetches `tree`; `job.event` appends to `liveEvents[jobId]` and caps at 500; `connected` false after `onerror`, true after `onopen`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(ui): engine client and live event store`

---

### Task 11: VS Code shell (activity bar, explorer, status bar)

**Files:**
- Create: `src/components/shell/ActivityBar.tsx`, `src/components/shell/Explorer.tsx`, `src/components/shell/StatusBar.tsx`, `src/components/shell/NewFolderDialog.tsx`
- Modify: `src/App.tsx` (rewrite to the layout), `src/styles/toonforge.css` (shell grid, activity bar, explorer tree, status bar; delete styles only used by removed components), `src/lib/pipeline.ts` (replace `PIPELINE` with the spec's column list used by the Introduction page; keep `estimateSeconds`; delete `stepDone`, `nextStep`, `stepPrompt`), `src/components/GuidePages.tsx` (Introduction step list uses the new columns), `src/__tests__/pipeline.test.ts`
- Delete: `src/components/Sidebar.tsx`, `src/components/StepPages.tsx`, `src/components/LibraryPage.tsx`, `src/components/AgentDock.tsx`
- Test: `src/__tests__/App.test.tsx` (rewrite)

**Interfaces:**
- Consumes: `useEngine` (Task 10), `GuidePages` (existing).
- Produces:
  - Layout grid: activity bar 48 px · explorer 260 px · editor (flex) · agent panel 360 px · status bar 24 px; agent panel hideable from the activity bar.
  - `ActivityBar({ view: 'explorer'|'requirements'|'guide', onView, agentOpen, onToggleAgent })` — icon buttons with `aria-label` and `title`.
  - `Explorer({ tree, openPath, onOpen, onNewFolder(category), onRename(path, name) })` — categories expandable; each folder row shows name + count of non-done cards; inline rename on F2/double-click; "New folder" button per category and in the header.
  - `NewFolderDialog({ category, categories, agents: EnvProbe[], lastAgent, onCreate({category, name, agent}), onClose })` — native `<dialog>`; category select lists the tree's categories plus "Your own…" which reveals a category-name input; name placeholder `"<Label> <YYYY-MM-DD>"`; only installed agents selectable.
  - `StatusBar({ repoRoot, branch, connected, runningJob, queued, reqReady, reqTotal })` — e.g. `● Claude · Scene · Night Shift / Elevator 3AM · 2 queued`.
  - Editor area shows: the Board (Task 12) for the open folder; an empty state "Pick a category and create a folder to start" when none; `RequirementsPage`, or `IntroPage` + `HowToPage` for the other activity views.
- [ ] **Step 1: Write failing App tests** (mock `engine` + `backend`): default categories Real crime/Horror/Tech render in the explorer; clicking a category's New folder opens the dialog with the auto-name placeholder; submitting calls `engine.createFolder({ category: 'horror', name: '', agent: 'claude' })` and opens the new folder; activity bar "Requirements" shows the extensions-style list; status bar shows `8/8` and the running job label from a mocked queue.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS; `npx tsc --noEmit` clean.
- [ ] **Step 5: Commit** `feat(ui): VS Code-style shell with explorer and status bar`

---

### Task 12: Board and card drawer

**Files:**
- Create: `src/components/board/Board.tsx`, `src/components/board/CardDrawer.tsx`
- Test: `src/__tests__/board.test.tsx`

**Interfaces:**
- Consumes: `Folder`, `Card`, `engine.*` (Task 10), `estimateSeconds` (pipeline.ts), `backend.mediaUrl`.
- Produces:
  - `Board({ folder, runningJob, onOpenCard, onGenerateTopics })` — columns in order Script, Voice, Scene, Sound, Preview (states `preview` + `review`), Render, Done; `failed` cards stay in the column of `failedStep` with a red status line. Empty folder with no `topicRun` shows one "Generate topics" card.
  - Card face: title, VO/Visual badge, rig, status line (e.g. "Agent writing script · 1m 12s" when running, "Drop voice file here" in Voice, "Ready to review" in Review, warnings count in Done), one action: Voice → drop zone; Review → Render; Failed → Retry; imported + idle → Resume.
  - Card is a drop target for files (`dragover`/`drop`); rejects with an inline message before upload when the extension is not `.wav`/`.mp3` or size > 200 MB.
  - `CardDrawer({ folder, card, onClose })` — tabs Script (editable textarea + Save + estimated seconds), Narration (VO only; text from `## Narration`, Copy, "Open ElevenLabs" link), Preview (latest `preview-v<N>` player + version picker + stills + notes box "What should change?" + Render button), Final (player, QA warnings), History (card `history` list with links to logs).
- [ ] **Step 1: Write failing tests**: cards land in the right columns for each state; dropping `voice.m4a` shows `Drop a .wav or .mp3 file up to 200 MB.` and does not call `engine.uploadVoice`; dropping `voice.wav` calls it with the card id; Review card's Render calls `engine.render`; drawer notes submit calls `engine.notes` with the trimmed text and is disabled when empty; failed card shows the error and Retry calls `engine.retry`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(ui): Trello board and card drawer`

---

### Task 13: Topic and mode dialogs

**Files:**
- Create: `src/components/board/TopicsDialog.tsx`, `src/components/board/ModeDialog.tsx`
- Modify: `src/components/board/Board.tsx` (open them), `src/App.tsx` if needed for dialog state
- Test: `src/__tests__/topics.test.tsx`

**Interfaces:**
- Consumes: `engine.generateTopics`, `saveTopics`, `reroll`, `approve`; `folder.topicRun`; category presets (`NICHE_PRESETS` in `src/lib/domain.ts` for default rig and VO).
- Produces:
  - `TopicsDialog` step 1 "Generate": count (number input 1–20, default 10), source radio Real (researched online) / Made up; when the folder's agent cannot search the web, Real shows "This agent can't search the web, so stories will be made up."; Generate → `engine.generateTopics` and a waiting state bound to the running topics job.
  - Step 2 "Review" (when `topicRun.state === 'ready'`): rows with ☆/★ toggle (`aria-pressed`), editable title, remove; Re-roll (disabled when every title is starred) → `saveTopics` then `reroll`; Approve → opens `ModeDialog`.
  - `topicRun.state === 'error'` shows the error with Try again.
  - `ModeDialog({ items, category, onConfirm(items with audio + rig) })` — per-row VO/Visual and Chibi/Stickman toggles; bulk "All VO" / "All visual"; defaults from the category preset (`recommendedRig`; VO default `vo`); confirm → `engine.approve`.
- [ ] **Step 1: Write failing tests**: count input clamps 0→1 and 50→20; starring row 1 then Re-roll sends `titles` with `starred: true` on row 1 before calling `reroll`; Re-roll disabled when all starred; "All visual" sets every row; confirm sends `items` with `audio` and `rig` per row; error state shows the message and Try again calls `generateTopics` again.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(ui): topic generation, favorites, re-roll and mode pop-ups`

---

### Task 14: Agent panel

**Files:**
- Create: `src/components/agent/AgentPanel.tsx`
- Test: `src/__tests__/agentPanel.test.tsx`

**Interfaces:**
- Consumes: `queue`, `liveEvents` (Task 10), `folder`, `EnvProbe[]` agents, `AGENT_INFO` fields delivered via `GET /api/env` (add `enforcement` and `canSearchWeb` to each agent probe in `getEnvStatus` in this task).
- Produces: `AgentPanel({ folder, probes, queue, liveEvents, onAgentChange, onCancel, onPause, onReorder, onRemove, onRetry })`:
  - Header: agent picker for the open folder (installed agents only; changing calls `engine.updateFolder(path, { agent })`), installed state, enforcement sentence.
  - "Now": running job card title, step, elapsed (ticks every second from `startedAt`), attempt "Fix attempt 1 of 2" when `attempt > 0`, Cancel.
  - Live events list (newest at bottom, auto-scroll unless the user scrolled up): icon per type (message, tool, file read/write, error, done), file paths in mono; `done` shows duration and cost when present.
  - Queue: list with move up/down and remove; Pause/Resume toggle; empty state "Nothing queued".
  - History tab: the open folder's cards' `history` entries, newest first, with Retry on failed ones.
- [ ] **Step 1: Write failing tests**: running job renders its card title and step; three `job.event` events render in order with a `file` event showing its path; Cancel calls `engine.cancel`; move-up calls `engine.reorder` with the swapped id order; changing the agent calls `engine.updateFolder` with `{ agent: 'codex' }`; enforcement sentence for Codex is shown.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(ui): live agent panel with queue and history`

---

### Task 15: Tauri thin shell

**Files:**
- Modify: `server/bridge.mjs` (direct entry: `--port <n>` with `0` meaning any free port; print `TOONFORGE_PORT=<n>` once listening; serve `dist/` static files for non-`/api` paths with `index.html` fallback), `src-tauri/src/lib.rs` (rewrite), `src-tauri/Cargo.toml` (drop `portable-pty` and other unused deps), `src-tauri/tauri.conf.json` (remove the static window from `app.windows`; window created in code)
- Delete: `src-tauri/src/board_watch.rs`, `git_sync.rs`, `pipeline_job.rs`, `pty_host.rs`, `rig_manager.rs`
- Test: `src/__tests__/engine/serve.test.ts` (node env)

**Interfaces:**
- Produces:
  - Node: `startServer({ repoRoot, port }): Promise<{ port: number, close(): Promise<void> }>` exported from `bridge.mjs`; direct entry uses it.
  - Rust `run()`: on setup, find `node` on PATH (if missing, show a native message "ToonForge needs Node.js 20 or newer. Install it from https://nodejs.org and start ToonForge again." and exit); spawn `node <app>/server/bridge.mjs --port 0` with cwd = toonforge folder; read stdout until `TOONFORGE_PORT=`; poll `GET /api/health` up to 15 s; create the main window (title "ToonForge — Cartoon Shorts Studio", 1280×780, min 1024×640) at `http://127.0.0.1:<port>/`; kill the child on window close / app exit.
- [ ] **Step 1: Write failing Node tests**: `startServer({ repoRoot: tmp, port: 0 })` returns a non-zero port; `GET /api/health` → `{ ok: true }`; `GET /` serves `dist/index.html` when present (create a temp `dist`); unknown non-api path falls back to `index.html`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement Node part.** **Step 4: Run** → PASS.
- [ ] **Step 5: Implement the Rust shell.** No Rust toolchain on the dev machine: if `cargo` is available run `cargo build` in `src-tauri`; otherwise record in the commit message that the Rust shell is unbuilt.
- [ ] **Step 6: Commit** `feat(tauri): spawn the Node engine and drop the duplicate Rust backend`

---

### Task 16: End-to-end check on the creator's machine

**Files:**
- Modify: whatever the checks below expose (fixes go in the owning task's files)

- [ ] **Step 1: Full suite** `npx vitest run` → all pass; `npx tsc --noEmit` → clean.
- [ ] **Step 2: Design detector** `"C:/Users/Asnor/.claude/plugins/cache/impeccable/impeccable/4.8.0/skills/impeccable/scripts/impeccable" detect --json src/App.tsx src/components src/styles/toonforge.css` → `[]` or fixed.
- [ ] **Step 3: Live run** with `npx vite --port 5317`: create a Horror folder, generate 3 made-up topics with Antigravity, star one, re-roll, approve as 1 visual + 2 VO; confirm the agent panel streams events and the board advances the visual card to Review with a preview that plays; drop a `.wav` on a VO card and confirm it moves to Scene. Capture screenshots at 1280×780 and 1024×640 (iframe method if the browser window won't resize).
- [ ] **Step 4: Commit** fixes `fix: issues found in end-to-end run`
