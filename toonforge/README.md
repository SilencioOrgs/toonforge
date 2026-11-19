# ToonForge

**ToonForge** is an open-source desktop studio for planning, scripting, voicing, and managing vertical **2D-in-3D cartoon shorts** (built for Remotion + Three.js + Python audio/QA workspaces).

It pairs a **React 19 + TypeScript** frontend (styled with `quick-liquid` and `lucide-react`) with a **dual-runtime backend**:
- **Browser / Dev mode:** Local Node.js Workspace Bridge (`server/bridge.mjs`), mounted automatically at `/api` during `vite` dev or runnable standalone.
- **Native Desktop mode:** **Tauri v2 + Rust** (`src-tauri/`) with native PTY execution (`portable-pty`) and `asset://` media streaming.

---

## Features

### 1. Guided 5-Step Story Flow
- **Intro & Language:** Choose script language (**Taglish**, **Pure Tagalog**, or **English**) and pick a content niche preset (**Crime Scene & Mystery**, **Night Shift & Horror**, **Tech & System Design**, or **Custom Niche**).
- **Topic Bank:** Built-in curated Top 10 viral short story hooks per niche, plus one-click AI CLI prompt generation for fresh ideas.
- **Script Studio:** Draft and edit `SCRIPT_<SLUG>.md` with quick SFX cue tags (`[SFX: SUB_DROP]`, `[SFX: WHOOSH_IN]`, etc.) and live character rig selection.
- **ElevenLabs / Voiceover Setup:** Strip SFX tags for clean narration copy, upload `.wav` / `.mp3` voiceovers directly to `voice/<slug>_voice.<ext>` (up to 12 MB), or switch to **No-VO Visual Mode** for BGM/SFX-only shorts.
- **Handoff to 3D Workbench:** Automatically saves the card to `.toonforge/board.json` and moves it into the active lane.

### 2. Three-Pane 3D Workbench
- **Content Bank (Kanban):** Manage shorts across **Backlog**, **Queued**, and **Done** lanes. When **Auto-Queue** is enabled, cards automatically promote from `backlog` to `queued` once a matching voiceover file arrives or `No-VO` mode is selected.
- **Stage Preview & Inspector:** Switch between four live views for the selected short:
  - **Rig:** Toggle between the built-in **Procedural Stickman** rig and custom **Chibi** sprite sheets (`src/videos/chibi/{sprites,faces,fx}`).
  - **Video:** Stream rendered MP4s and audio mixes with HTTP byte-range / Tauri asset protocol support.
  - **Stills:** Inspect rendered frame stills (`out/<slug>/stills/`) or QA contact sheets (`out/<slug>/qa/sheet_*.png`).
  - **Script:** Read and edit `SCRIPT_<SLUG>.md` directly in the workspace.
- **Render Pipeline & AI CLI Console:**
  - Tracks real artifact completion (`Script`, `Audio/VO`, `2K MP4`, `QA Report` = 25% each) and parses loudness/specs from `out/<slug>/qa/report.md`.
  - Run `TSC Check` (`npx tsc --noEmit`), stills verification, and QA checks.
  - Switch between **Antigravity (`agy`)**, **Claude Code (`claude`)**, **OpenAI Codex (`codex`)**, and **OpenCode (`opencode`)** with guided prompts for **Script**, **Audio**, **Scene**, and **Render** steps.

### 3. Setup Guide & Workspace Utilities
- Live environment probe for `git`, `node`, `python`, `numpy` + `pillow`, `ffmpeg`/`ffprobe`, Chromium/Chrome, and installed AI CLIs.
- Copyable AI onboarding prompts and manual setup commands.
- One-click `git pull --ff-only` / working tree status check (`Sync Repo`), Dark/Light theme toggle, and swappable studio logo concepts (`Cube`, `Clapper`, `Portal`).

---

## Project Structure

```text
toonforge/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts                 # Vite + Vitest config with /api bridge middleware
├── server/
│   ├── bridge.mjs                 # Local HTTP API bridge (localhost-only + byte-range media)
│   ├── bridge.d.mts               # Type declarations for bridge module
│   └── services/
│       ├── workspaceService.mjs   # Board state, env probes, rig inspection, scripts, VO upload
│       └── jobRunner.mjs          # Git sync, AI/shell command runner, pipeline checks
├── src/
│   ├── main.tsx
│   ├── App.tsx                    # Top-level state, Story Flow & 3D Workbench orchestration
│   ├── types/studio.ts            # Shared domain TypeScript interfaces & unions
│   ├── lib/
│   │   ├── domain.ts              # Pure board logic, niche banks, script/prompt builders
│   │   └── backend.ts             # Unified Tauri invoke / HTTP bridge client
│   ├── styles/toonforge.css       # Monochrome QuickLiquid theme & layout styles
│   ├── components/
│   │   ├── TopBar.tsx
│   │   ├── StoryFlowWizard.tsx
│   │   ├── ContentBankPane.tsx
│   │   ├── StageInspectorPane.tsx
│   │   ├── PipelineAndCliPane.tsx
│   │   ├── SetupWizardDialog.tsx
│   │   ├── IconPickerDialog.tsx
│   │   ├── LogoSvg.tsx
│   │   └── StageSvg.tsx
│   └── __tests__/
│       ├── App.test.tsx
│       ├── backend.test.ts
│       └── domain.test.ts
└── src-tauri/
    ├── Cargo.toml
    ├── tauri.conf.json
    ├── build.rs
    └── src/
        ├── main.rs                # Desktop entry point
        ├── lib.rs                 # Tauri builder & WorkspaceState setup
        ├── board_watch.rs         # Board persistence, script I/O, VO upload & auto-queue
        ├── git_sync.rs            # Environment binary probes & git sync
        ├── rig_manager.rs         # Chibi sprite/face/fx & stickman rig scanner
        ├── pipeline_job.rs        # Typecheck, stills check, and QA report verification
        └── pty_host.rs            # Native PTY / shell command execution
```

### Expected Parent Workspace Layout

ToonForge operates on its parent video-production repository (`..` relative to `toonforge/`):

```text
<workspace-root>/
├── .toonforge/board.json          # Persisted Kanban board & card metadata
├── SCRIPT_<SLUG>.md               # Markdown story script per short
├── voice/<slug>_voice.(wav|mp3)   # Uploaded or recorded voiceover files
├── audio/
│   ├── dsp.py                     # -15 LUFS audio mastering utilities
│   └── mix_<slug>.(py|wav)        # Per-short audio mix script & output
├── src/
│   ├── Root.tsx                   # Remotion <Composition> registry
│   └── videos/
│       ├── chibi/{sprites,faces,fx}/  # Custom PNG chibi sprite assets
│       └── <slug>/                # 3D Three.js / Remotion scene implementation
└── out/<slug>/
    ├── <slug>_2k.mp4              # Rendered 2K vertical video
    ├── stills/                    # Preview frame stills
    └── qa/report.md               # Frame & loudness QA report (short_qa.py)
```

---

## Prerequisites

### Studio UI & Bridge
- **Node.js** `>= 20` and **npm**

### Native Desktop Build (Optional)
- **Rust** (2021 edition / `cargo`) and [Tauri v2 system prerequisites](https://v2.tauri.app/start/prerequisites/)

### Video & Audio Production Stack (Parent Workspace)
- **Git**
- **Python** `>= 3.10` with `numpy` and `pillow` (`python -m pip install numpy pillow`)
- **FFmpeg** + **FFprobe**
- **Chromium / Chrome** (or Remotion's bundled browser via `npx remotion browser ensure`)

---

## Getting Started

Install dependencies inside `toonforge/`:

```bash
npm install
```

### Run in Browser (Vite + Built-in Node Bridge)

```bash
npm run dev
```

Opens the studio at `http://localhost:1420` with the workspace API mounted at `/api`.

### Run Standalone Workspace Bridge

```bash
npm run bridge
```

Starts the HTTP bridge on `http://127.0.0.1:4190` (override with `TOONFORGE_BRIDGE_PORT`). Only local `localhost` / `127.0.0.1` / `tauri://localhost` origins are permitted, and media serving is restricted to `out/`, `voice/`, `audio/`, and `src/videos/`.

### Build Frontend Bundle

```bash
npm run build
```

Runs `tsc --noEmit` followed by `vite build` into `dist/`. Preview the production bundle with `npm run preview`.

### Run as a Tauri Desktop App

With the Tauri CLI installed (e.g. `cargo install tauri-cli --version "^2"`):

```bash
cargo tauri dev
```

To build a distributable binary:

```bash
cargo tauri build
```

---

## Testing

### Frontend & Domain Tests (Vitest)

```bash
npm test
```

Runs unit and component tests in `src/__tests__/` (`App.test.tsx`, `backend.test.ts`, `domain.test.ts`).

### Rust Backend Tests

```bash
cd src-tauri
cargo test
```

---

## Backend API & Tauri IPC Reference

`src/lib/backend.ts` automatically routes calls to Tauri IPC when running inside the desktop shell (`window.__TAURI_INTERNALS__`) or to the Node HTTP bridge in browser mode:

| Capability | HTTP Bridge Route | Tauri Command |
| :--- | :--- | :--- |
| Environment & git branch probe | `GET /api/env` | `check_environment` |
| Inspect Stickman & Chibi rigs | `GET /api/rigs` | `inspect_rigs` |
| Load & enrich Kanban board | `GET /api/board` | `load_board` |
| Save Kanban board | `POST /api/board` | `save_board` |
| Create card & starter `SCRIPT_*.md` | `POST /api/cards` | `create_card` |
| Upload `.wav`/`.mp3` voiceover | `POST /api/voice` | `upload_voiceover` |
| Read card script | `GET /api/script?slug=...` | `read_script` |
| Write card script | `PUT /api/script` | `write_script` |
| Stream workspace media | `GET /api/media?path=...` | `convertFileSrc` (`asset://`) |
| Sync git repository | `POST /api/sync` | `sync_repo` |
| Run pipeline check (`stills`, `render`, `typecheck`) | `POST /api/pipeline/run` | `run_pipeline` |
| Execute AI CLI or shell command | `POST /api/cli/exec` | `exec_cli_command` |

---

## License

MIT
