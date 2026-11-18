# ToonForge: VS Code-style automation shell for the claude-animated-shorts skill

Date: 2026-11-18 · Status: draft after builder check, awaiting approval

## Intent and why

The creator wants ToonForge to **automate the claude-animated-shorts skill end to end** and to **work with any of four coding agents** (Claude Code, Codex, OpenCode, Antigravity). The current app (commit `c0e77e3`, branch `feat/skill-pipeline-shell`) walks one short at a time through sidebar step pages and sends one-shot prompts that show nothing until the agent finishes. The new app should feel like VS Code:

- **Left:** an explorer where shorts are organized into folders by category.
- **Middle:** a Trello-style board showing every topic in the open folder and its status, from idea to rendered MP4.
- **Right:** an agent panel showing, live and in detail, what the agent is doing.

The creator works in batches: pick a category, generate ~10 topic ideas, keep the good ones, then let the agent carry each topic through script, scene, preview and render, stepping in only to supply voice audio, approve the preview and press Render.

## Goals

1. VS Code layout: activity bar, explorer (left), board (middle), agent panel (right), status bar.
2. Folders per category, created from a pop-up with a typed or automatic name, stored as real folders on disk.
3. Topic generation by the selected agent: user chooses how many, and **real (researched online)** or **made up**. Results open in a pop-up where the user stars favorites; **Re-roll** replaces only unstarred titles; **Approve** turns the list into cards.
4. Per approved topic: choose **VO** or **visual-only**.
5. VO path: agent writes the script and clean narration text; user generates audio in ElevenLabs or any TTS and **drags the audio file onto the card**. ToonForge stores it and the card continues automatically.
6. Automation queue: cards advance without clicks through scene building, sound, and a **quick preview render** with audio (low resolution), then wait for the user.
7. In review, the user either presses **Render** or writes **notes**; notes go to the agent, which revises the scene and makes a new preview. Earlier previews are kept (v1, v2, ...).
8. **Render** runs the final 2K render with the mix, then QA, then moves the card to Done.
9. Agent panel shows: selected agent and install state, current card and step, live event stream (messages, files read/written, commands run), elapsed time, queue, history per card, Cancel and Retry.
10. Works with each of the four agents through one adapter interface.

## Non-goals

- Generating voice audio inside ToonForge (the user uses ElevenLabs or another TTS; ToonForge only receives the file).
- A timeline or keyframe editor; scenes stay code written by the agent from the skill's templates.
- Running several agents or renders in parallel.
- Cloud sync, accounts, or a hosted version.
- **A public installer** (bundling the engine, creating a fresh Remotion workspace for new users). This build targets the creator's PC with this repo as the workspace; packaging is a separate later project (decided by the user).

## Anti-goals (would be failure even if it "works")

- A topic or prompt ever executed as a shell command (fixed in `c0e77e3`; must stay true).
- Silent failures: a stuck or failed agent step must show where and why, with Retry.
- Losing user files: re-roll, retry or folder rename must never delete scripts, voice files or renders.
- Hiding the agent: the user must always be able to see what the agent did to their files.
- Agents running commands outside the allow-list or outside the workspace (see Agent permissions).

## Constraints

- Windows 11 first (the creator's machine); Node ≥ 20 is already required by Remotion.
- No Rust toolchain on the dev machine; Rust must stay minimal (see Approaches).
- The skill's file layout must keep working: scene code in `src/videos/<slug>/`, compositions registered in `src/Root.tsx`, renders in `out/<slug>/`.
- Keep the incumbent visual identity (PRODUCT.md): monochrome zinc, single emerald accent for priority objects, Playfair Display only for display, Poppins for UI, mono for logs.
- Online research depends on the agent having web access; agents without it fall back to "made up" with a visible note.

## Approaches

### Backend (decided: A)

- **A. One Node engine (chosen).** All automation (queue, agent adapters, file watching, storage, renders) lives in the Node bridge. The Tauri app spawns `node server/bridge.mjs` on startup, waits for it to listen, loads the UI from it, and kills it on exit. Rust shrinks to window + process management. One codebase, fully testable here; Node is already a requirement.
- B. Keep Node and Rust backends in parity. Rejected: doubles the heaviest work, and the Rust half can't be built or tested on this machine.
- C. Rust only. Rejected: untestable here; the core of the app would ship unverified.

### Storage (decided: per-folder files)

- **Per-folder `toonforge.json` (chosen).** Each folder carries its own state; portable, human-readable, no native modules.
- Central SQLite. Rejected for now: needs native modules (better-sqlite3) and splits state from files.

## Layout

```
┌─┬──────────────┬──────────────────────────────────────────┬──────────────────┐
│E│ EXPLORER     │ Horror › Night Shift Stories              │ AGENT  Claude ▾  │
│ │ ▸ Real crime │ Ideas │ Script │ Voice │ Scene │ Preview │ Done │ ● Running    │
│R│ ▾ Horror     │ [card] [card]  [drop]  [⟳]     [▶ Render] [✓]  │ card · step  │
│ │   ▸ Night…   │                                          │ event stream…    │
│?│ ▸ Tech       │                                          │ queue (3)        │
│ │ + New folder │                                          │ Cancel · Retry   │
├─┴──────────────┴──────────────────────────────────────────┴──────────────────┤
│ status bar: workspace path · branch · agent state · queue count · req. 8/8   │
└───────────────────────────────────────────────────────────────────────────────┘
```

- **Activity bar** (far left icons): Explorer, Requirements (the existing extensions-style page), Guide (Introduction + How to use). These replace today's sidebar Guide section.
- **Explorer:** default categories Real crime, Horror, Tech (the existing `NICHE_PRESETS`: crime, horror, tech) plus user-made categories via "Your own". Expanding a folder lists its cards; a card expands to its files (script, voice, scene folder, renders) as read-only links. Selecting a category's "+" or the toolbar "New folder" opens the folder pop-up.
- **Board (editor area):** one column per card state (below). Cards show title, VO/visual badge, current status line, and the one action relevant to that state. Clicking a card opens a detail drawer: script (editable), narration text with Copy, voice file, preview player, render player, and the card's agent history.
- **Agent panel:** described under Agent runner.
- Light/dark theme and the Library-style lane view from `c0e77e3` are superseded by this board.

## Data on disk

```
<repo>/shorts/<category>/<folder>/
  toonforge.json          folder state (schema below)
  topics.md               the approved topic list, human-readable
  <slug>/SCRIPT.md        script per card
  <slug>/voice.<wav|mp3>  dropped audio
<repo>/src/videos/<slug>/  scene code (skill layout, unchanged)
<repo>/out/<slug>/         preview + final renders, stills, QA (skill layout)
```

`toonforge.json` (version 1):

```json
{
  "version": 1,
  "name": "Night Shift Stories",
  "category": "horror",
  "agent": "claude",
  "createdAt": "2026-11-18T10:00:00Z",
  "topicRun": { "count": 10, "source": "real", "titles": [{ "title": "…", "hook": "…", "starred": true }] },
  "cards": [{
    "id": "c_8f2a", "slug": "elevator3am", "title": "…", "hook": "…",
    "audio": "vo" | "visual",
    "state": "script" | "voice" | "scene" | "sound" | "preview" | "review" | "render" | "done" | "failed",
    "rig": "chibi" | "stickman", "imported": false, "warnings": [],
    "failedStep": null, "error": null,
    "files": { "script": "elevator3am/SCRIPT.md", "voice": null, "words": null, "scene": "src/videos/elevator3am", "mix": null, "previews": [], "stills": [], "final": null, "qa": null },
    "notes": [{ "at": "...", "text": "character too small in shot 3", "previewVersion": 1 }],
    "history": [{ "at": "…", "step": "scene", "agent": "claude", "ok": true, "summary": "…", "logFile": "…" }]
  }]
}
```

- Writes are atomic (write temp file, rename) so a crash never corrupts state.
- Slugs are unique across the whole repo (they become composition folders).
- Full agent logs go to `out/<slug>/logs/<step>-<timestamp>.jsonl`; `history` keeps a summary.

## Card lifecycle

| Column | State | Who moves it on |
|---|---|---|
| Ideas | (topic pop-up, not yet a card) | User approves the list |
| Script | `script` | Agent writes `SCRIPT.md` (+ narration text for VO) |
| Voice | `voice` (VO cards only) | User drops an audio file on the card |
| Scene | `scene` | Agent builds `src/videos/<slug>/` from the bridge template, registers the composition, typecheck passes |
| Sound | `sound` | Agent builds SFX + music and mixes them (under the VO with ducking, or music-only for visual cards) to `out/<slug>/mix.wav` |
| Preview | `preview` → `review` | Engine renders a low-res preview **with the mix** plus look-check stills; card waits in `review` |
| (review) | `review` → `scene` | User submits notes; agent revises the scene (and sound if the notes need it); a new preview version is made |
| Render | `render` | User presses Render; engine runs the 2K render + QA |
| Done | `done` | QA report written |
| (any) | `failed` | Shows error + Retry (re-runs `failedStep`) |

Visual-only cards skip Voice. Cards advance automatically when their step finishes.

**Queue (builder's call, recorded):** one global queue across all folders, one job at a time, first in first out; render jobs jump ahead of agent jobs; the user can reorder or remove queued jobs in the agent panel. Each job runs with its folder's agent; changing the panel picker changes the open folder's agent for jobs not yet started.

**Failure handling (builder's call, recorded):** when an engine check fails after an agent step (typecheck, preview render crash, mix script error), the engine sends the error output back to the same agent with a "fix this" prompt, up to 2 automatic attempts; after that the card goes to `failed` with the last error and Retry. QA findings (black/frozen frames, loudness off target) do not fail the card: it goes to Done with `warnings` shown on the card.

**Never losing work:** before an agent revises an existing scene, the engine copies `src/videos/<slug>/` to `out/<slug>/versions/v<N>/scene/`; previews are written as `preview-v<N>.mp4` and never overwritten.

## Flows

1. **New folder:** pop-up with category (preselected when started from a category), name field (placeholder = auto name like "Horror 2026-11-18"), agent choice (defaults to last used). Creates `shorts/<category>/<folder>/toonforge.json`.
2. **Generate topics:** empty folder shows a single "Generate topics" card. Pop-up asks how many (default 10, 1–20) and Real (researched online) or Made up. The agent returns structured JSON (title + one-line hook). The topic pop-up lists them with ☆ stars; **Re-roll** asks the agent for (count − starred) new titles excluding all current ones; **Approve** creates cards from all listed titles (user can delete a row before approving).
3. **VO or visual, and characters:** after approval, a pop-up lists the new cards with a VO/Visual toggle and a Chibi/Stickman toggle each (defaults from the category preset; bulk "all VO"/"all visual"). The rig choice feeds the scene prompt as today (builder's call, recorded).
4. **Script:** queue job per card: agent writes `SCRIPT.md` following the skill's beat formula (55–70 s, ~3.7 words/s, [SFX] cues). VO cards then wait in Voice and show the narration text with Copy and an "Open ElevenLabs" link.
5. **Voice drop:** dropping `.wav`/`.mp3` on the card (or the drawer) saves it as `<slug>/voice.<ext>`. The engine then makes `words.json` word timings itself with faster-whisper (added to Requirements as a one-click install; builder's call, recorded), and the card moves to Scene.
6. **Scene, sound, preview:** agent builds the scene; engine runs `npx tsc --noEmit`; agent builds the sound mix; engine renders a preview (Remotion `--scale 0.25`, fast CRF, with the mix) to `out/<slug>/preview-v<N>.mp4` plus look-check stills. Card shows the player and stills in Review.
7. **Notes:** in Review the drawer has a notes box. Submitting sends the notes, the current script, and the stills to the agent to revise the scene (and the sound if needed); the card goes back through Scene, Sound, Preview as a new version.
8. **Render:** user presses Render → 2K render (`--scale 1.3333`, CRF 16, existing command) with VO mix → QA (`scripts/short_qa.py`) → Done. Render jobs jump ahead of agent jobs in the queue.

## Agent runner

- **Adapter per agent**, each declaring: binary, args for a prompt, streaming format, and how to parse events.
  - Claude: `claude -p --output-format stream-json --verbose --permission-mode acceptEdits --allowedTools <allow-list> <prompt>`
  - Codex: `codex exec --json -s workspace-write <prompt>`
  - Antigravity: `agy --mode accept-edits --output-format stream-json -p <prompt>`
  - OpenCode: `opencode run <prompt>`, plain text lines (no structured events; shown as text).
- Spawned with `execFile`-style args (never a shell), cwd = repo root, no fixed timeout (Cancel instead), output parsed line by line into normalized events: `message`, `tool` (name + target file/command), `file_written`, `error`, `done` (with cost/time when the agent reports it).
- Every prompt names the skill explicitly ("Use the cartoon short skill at ~/.claude/skills/cartoon-3d-short/SKILL.md …") so non-Claude agents can read it.
- Topic generation asks for a JSON array and validates it; invalid output → one automatic retry, then a visible error.
- **Live updates** to the UI over Server-Sent Events (`GET /api/events`): job queued/started/event/finished, card state changes, file-drop received. Works the same in browser and Tauri.
- **Agent panel** shows: agent picker with installed state; current job (card title, step, elapsed); live event list (icons per event type, file paths clickable to open in the drawer); queue list with reorder/remove; per-card history; Cancel (kills the process tree), Retry, Pause queue.

## Agent permissions (decided: allow-list)

- Agents may edit files and run only the commands the skill needs, inside the workspace: `python`, `node`, `npx`, `ffmpeg`, `git`. Anything else is refused.
- Commands with fixed shapes (typecheck, preview render, final render, stills, QA, word timings) are run by the engine, not the agent.
- Per agent, use the strongest enforcement its CLI offers: Claude via `--allowedTools` (Edit/Write/Read/Glob/Grep plus `Bash(python:*)`, `Bash(node:*)`, `Bash(npx:*)`, `Bash(ffmpeg:*)`, `Bash(git:*)`); Codex via the `workspace-write` sandbox; Antigravity via `--mode accept-edits` (verify whether `--sandbox` or its settings can narrow commands); OpenCode via its permission config. The builder verifies each against the installed version.
- The agent panel shows, per agent, what is actually enforced (e.g. "Codex: limited to this folder, any command"), so the user knows where the allow-list is weaker.

## Tauri changes

- On startup: spawn the Node engine (port chosen at runtime, passed to the UI), show the window once `/api/health` responds, kill the process on exit.
- Remove the duplicated Rust commands (board, scripts, pipeline, PTY, install, env) once the UI talks only HTTP; keep `get_workspace_root` if still useful.
- If Node is missing at startup, show a native message pointing to the Node installer (the only requirement ToonForge can't install itself).

## Migration

Existing shorts in `.toonforge/board.json` (12 today) are imported once into `shorts/_imported/Existing shorts/toonforge.json`, mapping lanes and artifacts to card states; their scripts and files stay where they are (paths recorded as-is, `imported: true`). `board.json` is left untouched.

Imported cards **do not join the queue on their own** (builder's call, recorded): each shows a Resume button that queues its next step. Jobs on imported cards read and write the paths recorded in `files` (old layout), so nothing moves.

## Calls made without the user (check these)

- Sound is its own automatic step after Scene; previews include the mix; visual-only cards get a music-only mix.
- Failed engine checks go back to the agent up to 2 times before `failed`; QA findings are warnings, not failures.
- One global first-in-first-out queue; renders first; each job runs with its folder's agent.
- Rig choice (Chibi/Stickman) kept in the VO/visual pop-up.
- Imported shorts wait for Resume.
- Word timings made by the engine with faster-whisper (new one-click requirement).
- Scene folder snapshotted before each revision; previews versioned.

## Left to the builder

- Exact event-parsing per agent (verify each stream format against the installed CLI versions).
- Preview render flags beyond scale (codec, CRF) as long as it is clearly faster than final.
- Drawer and pop-up visual details within the existing design language; whether the activity bar uses icons only or icons + labels.
- How Requirements and Guide pages fit the editor area (tab vs full panel).
- Test strategy (the current suite: Vitest + Testing Library + bridge HTTP tests).
