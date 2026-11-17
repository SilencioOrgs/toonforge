# ToonForge — Desktop Studio Design Specification

**Date:** 2026-11-17  
**Status:** Proposed (Awaiting Creator Sign-Off)  
**Target Stack:** Tauri v2 (Rust) + React 19 + `quick-liquid` v0.1.2 + `lucide-react` + `portable-pty` + Remotion `4.0.544` + Python DSP/QA (`audio/dsp.py`, `scripts/short_qa.py`)

---

## 1. Intent & Why

This repository (`package.json`, `src/`, `scripts/`, `audio/`, `voice/`) already proves a repeatable vertical-short production formula (`1440x2560`, 30 fps 2D-in-3D diorama stories): write a script (`SCRIPT_*.md`), supply or skip a voiceover (`voice/*_voice.wav`), mix audio against Suno BGM (`audio/mix_*.py` + `audio/dsp.py`), render scenes in Remotion (`npx remotion render src/index.ts <CompositionId>`), inspect stills (`scripts/stills.mjs`), and validate luminance/loudness/frozen frames (`scripts/short_qa.py`).

Today, running that workflow requires manual shell commands and context-switching across editors, file pickers, FFmpeg/Python scripts, and AI coding terminals. **ToonForge** wraps this repeatable workflow inside a fast, open-source **Tauri v2 + React** desktop studio so any content creator can clone the template repo with one click, track scripts on a Trello-style board, swap between Stickman and custom Chibi rigs, auto-queue renders on VO readiness, watch live background pipeline stages, and steer their preferred AI coding CLI (`agy`, `claude`, `codex`, `opencode`) from inside the same glassmorphic workbench.

---

## 2. Goals, Non-Goals & Anti-Goals

### Goals
1. **First-Run Onboarding & Dual-Path Setup Wizard:** For brand-new installations, display a **Setup Guide** walkthrough with two equal paths: (a) a one-click **AI Auto-Setup Prompt** injected into the user's selected CLI (`agy`, `claude`, `codex`, or `opencode`) to inspect and install `git`, `node`, `python`, `numpy`, `pillow`, `ffmpeg`, and Remotion Chromium, or (b) copyable/runnable **Manual Terminal Commands** alongside a 3-step studio checklist.
2. **One-Click Repo Sync:** Clone/pull the upstream ToonForge template repository (`git`), install NPM dependencies (`npm ci`), and re-verify toolchain health in a preflight drawer before opening a project.
3. **Trello Content Bank + Auto-Queue:** Left-column Kanban board (`Backlog`, `Queued`, `Done`) stored deterministically in project workspace metadata so cards advance automatically when a VO file arrives (`VO Ready`) or when marked visual-only (`No-VO`).
4. **Flexible Character Rigs (Stickman Default + Custom Chibi Importer):** Let creators ship immediately using a bundled procedural **Stickman** Three.js/SVG rig or drop in their own custom Chibi sprite sheets (`sprites/`, `faces/`, `fx/`) compatible with `src/videos/chibi/chibiActor.ts`.
5. **Transparent Background Automation:** Visualize each background stage (`VO Sync / Visual Beat`, `-15 LUFS Mix`, `2K Render`, `Short QA`) with real-time stdout/stderr progress parsing, `scripts/stills.mjs` 4-frame strip previews, and one-click retry/open-output actions.
6. **Embedded Multi-AI CLI Host:** Switchable `portable-pty` terminal (`Antigravity`, `Claude`, `Codex`, `OpenCode`) running directly inside the active workspace with clickable prompt macros injected safely into stdin.

### Non-Goals
- No cloud SaaS account, remote GPU rendering queue, or telemetry collection.
- No drag-and-drop visual keyframe timeline editor (scenes remain TypeScript/Three.js compositions authored cleanly by creators or AI CLIs).
- No bundled LLM weights or credential storage; the PTY spawns locally authenticated user binaries.

### Anti-Goals
- Do **not** couple the Remotion video composition build (`src/index.ts`, `src/Root.tsx`) into the Tauri frontend bundle—the studio desktop UI compiles independently and invokes the project repo as an external workspace directory.
- Do **not** hide CLI errors behind vague spinners; every failed preflight check, Python traceback, or FFmpeg exit opens inline diagnostics and one-click copy-to-AI-CLI repair.

---

## 3. UI/UX, Brand & Craft Floor (`PRODUCT.md` Alignment)

### Brand Identity & Icon Candidates
Interactive prototype: [toonforge_mockup.html](file:///C:/Users/Asnor/.gemini/antigravity/brain/917edd6b-2933-4965-9a32-44cc1e8ca891/toonforge_mockup.html)

Three geometric vector icon candidates (all rendered in crisp B&W ink with emerald priority focus) are staged in the mockup's native `<dialog>` switcher for final selection:
1. **Iso Cube + Chibi:** Isometric B&W diorama cube housing a monochrome chibi head with an emerald priority face and `> _` terminal prompt.
2. **Toon Clapper:** Monochrome director slate paired with a vivid emerald `> _` command shell.
3. **9:16 Arcade Portal:** Monochrome vertical frame housing a grayscale meter + emerald priority peak column.

### Design System (Monochrome QuickLiquid Light/Dark + Priority-Object Color)
- **Glassmorphism:** Uses [`quick-liquid`](https://github.com/amarnath3003/quickLiquid.git) (`v0.1.2`, MIT) optical presets (`ql-thin`, `ql-regular`, `ql-thick`, `ql-clear`), `appearance: "light" | "dark"`, pointer specular highlights, press physics (`scale(0.96, 0.97)`), and the `#ql-refract` SVG turbulence displacement filter (`baseFrequency="0.018"`, `scale="9"`).
- **Monochrome Chrome + Selective Prio Color:** Studio surfaces, ambient blur orbs, active inverted tabs (`#ffffff`/`#09090b` dark, `#09090b`/`#ffffff` light), terminal logs, macro buttons, and non-priority stage walls/actors are strictly black, white, and neutral grayscale (`#09090b`, `#18181b`, `#27272a`, `#d4d4d8`, `#fafafa`, `#ffffff`). Selective emerald accent (`--g-prio: #34d399` dark / `#047857` light, `--g-prio-solid: #047857`) highlights **only priority objects**: active `Auto-Q: ON`, `VO Ready` badges, primary `Render` CTAs, active render percentage/bar, the `Run Setup Prompt` primary button, and the target story object inside the 9:16 Stage Preview SVG.
- **Typography:** **Playfair Display** (`600`/`700`) for app branding and pane headings; **Poppins** (`400`–`700`) for UI labels, board rows, and buttons; system monospace with `tabular-nums` for `1440x2560`, VO lengths, render percentages, and PTY output.
- **Iconography:** Exclusive `lucide-react` `2px`-stroke SVG icons (`git-branch`, `sun`, `moon`, `layers`, `sparkles`, `mic`, `volume-x`, `clock`, `plus`, `arrow-right`, `user`, `image-plus`, `camera`, `play`, `terminal`, `book-open`, `copy`, `check`). Zero emojis.
- **Layout & Spacing Discipline:** Top command bar (`10px 14px` padding) with Logo Selector, **Setup Guide** wizard button, **Sync Repo**, and **Light/Dark** toggle above a 12-column, 3-pane workbench (`4 / 3 / 5` split on desktop):
  - **Left Pane (`4 cols`) — Content Bank:** `Auto-Q` priority toggle pill, hairline-separated lane tabs (`Backlog`, `Queued`, `Done`), compact Trello rows with clickable mode badge (`Needs VO` -> `VO Ready` [prio] -> `No-VO`), and `+ Add Card`.
  - **Center Pane (`3 cols`) — Stage Preview:** Hairline `Stickman` / `Chibi Sheet` rig switcher above a crisp `#18181b`-framed 9:16 stage containing grayscale `<svg>`/`<canvas>` diorama rendering with vivid emerald highlight strictly on the target story object, plus floating `Stills` (monochrome) and `Render` (priority `#047857`) actions.
  - **Right Pane (`5 cols`) — Render Pipeline & AI CLI:** Upper half shows 4 live step cells + priority progress bar; lower half (divided by `1px` hairline border) houses the CLI switcher (`Antigravity`, `Claude`, `Codex`, `OpenCode`), monochrome `#09090b` terminal log viewport, and 3 monochrome quick prompt macro buttons (`+ Build Card`, `Align Rig`, `FB Caption`).

---

## 4. Technical Architecture (Tauri v2 + Rust + React 19)

```
+-------------------------------------------------------------------+
|  React 19 Frontend (src-ui/) · Monochrome QuickLiquid + Lucide    |
|  - Topbar: Setup Guide Wizard + Repo Sync + Theme + Icon Picker   |
|  - First-Run Dialog: AI Auto-Setup Prompt | Manual Cmds | Guide   |
|  - Content Bank Store (Kanban + Auto-Queue policy)                |
|  - Stage Preview (Stickman / Chibi Inspector + Stills Viewer)     |
|  - Pipeline Monitor + xterm.js PTY Terminal + Prompt Macros       |
+-----------------------^-----------------------^-------------------+
                        | Tauri invoke()        | Tauri Events
                        v                       | (pty://data, pipe://step)
+-------------------------------------------------------------------+
|  Rust Core (src-tauri/)                                           |
|  - git_sync.rs     : clone/pull repo + preflight + setup macros   |
|  - board_watch.rs  : workspace .toonforge/board.json + notify-rs  |
|  - rig_manager.rs  : stickman preset vs chibi PNG validation      |
|  - pipeline_job.rs : sequential async process runner + cancellation |
|  - pty_host.rs     : portable-pty sessions (agy/claude/codex/...) |
+-----------------------^-------------------------------------------+
                        | Child Processes (workspace CWD)
                        v
+-------------------------------------------------------------------+
|  Creator Repository Workspace                                     |
|  - package.json (Remotion 4.0.544 + React 19 + R3F + Three.js)    |
|  - src/videos/<slug>/ & src/videos/chibi/{sprites,faces,fx}       |
|  - voice/<slug>_voice.wav & audio/mix_<slug>.py (audio/dsp.py)    |
|  - scripts/stills.mjs · scripts/shots.py · scripts/short_qa.py    |
+-------------------------------------------------------------------+
```

### Module Responsibilities

#### 1. `git_sync.rs` & Onboarding Wizard (First-Run Setup, Repo Sync & Preflight)
- Commands: `check_environment()`, `clone_or_sync_repo(url, dest_dir)`, `install_npm_deps(workspace)`, `get_onboarding_status()`.
- Probes `git --version`, `node -v`, `python --version`, Python packages (`numpy`, `pillow`), `ffmpeg -version`, and Chromium executable discovery (`npx remotion browser ensure` fallback).
- **First-Run Onboarding Flow (`Setup Guide` `<dialog>`):** Automatically opens on fresh install (or anytime from Topbar `Setup Guide`) with 3 tabs:
  1. **AI Auto-Setup Prompt:** Pre-fills an OS-aware setup instruction mentioning missing probes and injects it directly into the active `portable-pty` AI CLI (`agy`, `claude`, `codex`, `opencode`) via `pty_host.rs`.
  2. **Manual Terminal:** Renders exact copyable/runnable shell commands (`git clone ...`, `npm ci`, `python -m pip install numpy pillow`, `npx remotion browser ensure`, `ffmpeg -version`) and executes a preflight verify command inside the PTY when clicked.
  3. **Quick Walkthrough:** Interactive 3-step guide (`Sync Template Repo & Deps` -> `Configure Content Bank Card + Rig + VO/No-VO` -> `Auto-Queue 2K Render & Short QA`).
- Streams `git clone` / `git pull --ff-only` / `npm ci` output over `sync://log` events without blocking the UI thread.

#### 2. `board_watch.rs` (Trello Content Bank + Auto-Queue)
- Persists cards in `<workspace>/.toonforge/board.json` (schema versioned: `id`, `slug`, `title`, `lane: "backlog" | "queued" | "done"`, `audioMode: "needs_vo" | "vo_ready" | "no_vo"`, `rigMode: "stickman" | "chibi"`, `voicePath?`, `bgmTrack`, `compositionId`).
- Uses Rust `notify` crate to watch `<workspace>/voice/` for matching `*_voice.wav` / `.mp3` files and `<workspace>/SCRIPT_*.md` changes.
- **Auto-Queue Rule:** Whenever `autoQueueEnabled == true` and a card in `backlog` either:
  1. receives a non-empty voice file transitioning `needs_vo` -> `vo_ready`, or
  2. is explicitly switched by the creator to `no_vo` (visual-only beats + Suno BGM),
  the backend atomically updates `lane = "queued"`, emits `board://updated`, and schedules it onto `pipeline_job.rs` FIFO queue (single active render lock so Remotion Chromium instances never thrash CPU/RAM).

#### 3. `rig_manager.rs` (Stickman vs. Custom Chibi Rig)
- `stickman`: Injects clean procedural joint geometry (`chibiActor.ts` fallback / `StickmanActor.tsx`) with zero user sprites required.
- `chibi`: Lets creators drop custom sprite sheets (`sprites/*.png`, `faces/*.png`, `fx/*.png`) and validates dimensions/transparency + mapping into `src/videos/chibi/` (`21` sprites, `16` faces, `6` fx in the reference workspace) with backup/restore in `.toonforge/backups/`.

#### 4. `pipeline_job.rs` (Managed Background Render Runner)
Runs up to 4 observable stages per queued card with single-job mutex + clean PID-tree kill on Cancel:
1. **Stage 1 — Audio Prep / Beat Timing:**
   - If `audioMode == "vo_ready"`: runs Python VO pause scan + `python audio/mix_<slug>.py` (using `audio/dsp.py`, normalizing toward `-15 LUFS`).
   - If `audioMode == "no_vo"`: generates beat map + pure Suno BGM mix without voiceover ducking.
2. **Stage 2 — Composition Stills Check:** Runs `node scripts/stills.mjs` (or parameterized equivalent) and surfaces generated PNG thumbnails inside the UI Stage Preview.
3. **Stage 3 — 2K Render:** Runs `npx remotion render src/index.ts <CompositionId> out/<slug>/<slug>_2k.mp4 --codec h264 --crf 16 --scale 1.3333333333333333`, parsing frame counters (`Rendered N/M`) into percentage progress.
4. **Stage 4 — Automated QA:** Runs `python scripts/short_qa.py <video.mp4> <qa_dir> [shots.json]` and surfaces loudness (`I:`, `LRA:`, `Peak:`), silence detection, and contact sheets directly in the card's `Done` inspector.

#### 5. `pty_host.rs` (Embedded Multi-AI CLI Switcher)
- Wraps `portable-pty` with a registry of supported adapters (`agy`, `claude`, `codex`, `opencode`), detecting availability in `PATH` (and common Windows/macOS install locations) before spawning.
- Switches tabs cleanly by preserving separate PTY sessions per CLI engine (`BTreeMap<String, PtySession>`) so switching between `Claude` and `Antigravity` does not kill running agent processes.
- Injects workspace-grounded prompt macros (e.g., `+ Build Card` prepends card slug, script file path, `audioMode`, and selected `rigMode` directly into stdin).

---

## 5. Error Handling & Edge Cases

- **Missing CLI Binary:** Tab badge marks unavailable agents and offers an inline command check/path override input rather than crashing `portable-pty`.
- **Remotion / FFmpeg Failure Mid-Render:** Non-zero exit halts progression before `short_qa.py`, leaves card in `queued` with `error` badge, highlights the stderr tail, and offers a one-click `Send Error to Active AI CLI` macro button.
- **VO File Incomplete During File Copy:** `board_watch.rs` debounces `notify` events (`500ms`) and verifies `ffprobe` decodes valid audio duration before firing `needs_vo` -> `vo_ready` auto-queue.
- **Backdrop Filter Fallback:** On Windows GPUs or virtualized displays with disabled hardware compositing, `quick-liquid` falls back gracefully to solid frosted fill opacity (`var(--g-reg)` / `var(--g-thick)`) without breaking legibility.

---

## 6. Verification Strategy

1. **Design & Mockup Verification (Completed):** Interactive HTML studio mockup passed headless `impeccable detect --json` with zero contrast, padding, or nested-card defects (`[]`).
2. **Next Planning Phase Verification (After Spec Approval):**
   - **Rust Unit Tests:** `cargo test` covering `git_sync.rs` toolchain probe parsing (`git`/`node`/`python`/`ffmpeg`/`chromium`), `board_watch.rs` Auto-Queue transitions (`needs_vo` -> `vo_ready`, `no_vo`), debounced VO file detection, and process-tree cancellation.
   - **Frontend Component & Accessibility Tests:** Typecheck + React Testing Library verifying Light/Dark monochrome tokens + priority-object highlights, `Setup Guide` wizard tabs (AI setup prompt vs. manual terminal), Kanban auto-queue UI, rig switcher persistence, and WCAG contrast >= 4.5:1.
   - **End-to-End Smoke:** Run ToonForge in Tauri dev mode against this workspace to queue a sample card, capture stills, and execute `short_qa.py` output parsing without mutating finished renders (`out/binary`, `out/redis`, `out/dbindex`).
