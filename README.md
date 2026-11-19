<div align="left">

# ToonForge

**Open-source desktop studio & render pipeline for vertical 2D-in-3D cartoon shorts.**

![Tauri v2](https://img.shields.io/badge/Tauri_v2-18181B?style=flat-square&logo=tauri&logoColor=24C8DB)
![Rust](https://img.shields.io/badge/Rust-18181B?style=flat-square&logo=rust&logoColor=white)
![React 19](https://img.shields.io/badge/React_19-18181B?style=flat-square&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-18181B?style=flat-square&logo=typescript&logoColor=3178C6)
![Three.js](https://img.shields.io/badge/Three.js-18181B?style=flat-square&logo=threedotjs&logoColor=white)
![Remotion 4](https://img.shields.io/badge/Remotion_4-18181B?style=flat-square&logo=react&logoColor=10B981)
![License: MIT](https://img.shields.io/badge/License-MIT-18181B?style=flat-square)

> Combine a local **Tauri v2 + React 19** studio workbench with a declarative **Remotion + Three.js + Python DSP/QA** render pipeline — all running locally on your machine with multi-AI CLI orchestration (`agy`, `claude`, `codex`, `opencode`).

</div>

---

### Overview

ToonForge turns a vertical-shorts template repository into an end-to-end production workspace:

1. **5-Step Story Flow** — Pick language (**Taglish**, **Pure Tagalog**, or **English**), select a niche topic bank (**Crime Scene & Mystery**, **Night Shift & Horror**, **Tech & System Design**, or **Custom**), draft `SCRIPT_<SLUG>.md` with SFX tags, attach an ElevenLabs/custom `.wav`/`.mp3` voiceover (or switch to **No-VO Visual Mode**), and send directly to the workbench.
2. **3-Pane 3D Workbench** — Manage shorts in a **Content Bank** Kanban (`Backlog`, `Queued`, `Done`) with smart **Auto-Queue**, inspect **Rig / Video / Stills / Script** live in the **Stage Preview**, and monitor pipeline progress alongside an embedded **Multi-AI CLI Console**.
3. **Repeatable 2K Render & QA Pipeline** — Master audio to **-15 LUFS** (`audio/dsp.py`), render `1440×2560` H.264 9:16 shorts via Remotion + React Three Fiber, generate preview stills (`scripts/stills.mjs`), and verify frames & loudness (`scripts/short_qa.py`).

---

### Core Capabilities

| Module | Details |
| :--- | :--- |
| **Story Flow & Script Studio** | Language switcher (`Taglish`, `Pure Tagalog`, `English`), curated Top 10 topic banks, quick `[SFX: ...]` cue tags, and clean narration copy for ElevenLabs. |
| **Kanban Content Bank** | Persisted in `.toonforge/board.json`. Auto-queues `backlog` cards to `queued` when matching `voice/<slug>_voice.(wav\|mp3)` arrives or `No-VO` is active. |
| **Dual Character Rigs** | Per-card switch between the zero-asset built-in **Procedural Stickman** rig and custom **Chibi** sprite sheets (`src/videos/chibi/{sprites,faces,fx}`). |
| **Dual-Runtime Backend** | Runs in browser dev mode via Vite middleware / standalone Node bridge (`toonforge/server/bridge.mjs`) or natively via **Tauri v2 + Rust** (`toonforge/src-tauri/`). |
| **Multi-AI CLI Orchestration** | Switch between `agy`, `claude`, `codex`, and `opencode` with context-aware prompts for Script, Audio, Scene, and Render steps plus native PTY execution. |
| **Preflight & Setup Guide** | Probes `git`, `node`, `python`, `numpy` + `pillow`, `ffmpeg`/`ffprobe`, Chromium/Chrome, and installed AI CLIs with one-click setup prompts. |

---

### Repository Structure

```text
.
├── toonforge/                     # Desktop studio app (Tauri v2 + Rust + React 19 + Node bridge)
│   ├── src/                       # React UI (StoryFlowWizard, Workbench panes, domain logic)
│   ├── server/                    # Local HTTP workspace bridge & pipeline job runner
│   ├── src-tauri/                 # Rust backend (board_watch, git_sync, rig_manager, pty_host)
│   └── README.md                  # Detailed studio architecture & API/IPC reference
├── src/
│   ├── Root.tsx                   # Remotion <Composition> registry
│   └── videos/
│       ├── chibi/                 # Custom Chibi sprite/face/fx PNG assets
│       └── <slug>/                # Declarative 3D Three.js + Remotion scenes
├── audio/                         # -15 LUFS DSP utilities & per-short mix_<slug>.py scripts
├── scripts/                       # Preview stills (stills.mjs) & frame/loudness QA (short_qa.py)
├── voice/                         # Uploaded or recorded <slug>_voice.(wav|mp3) narration
├── out/<slug>/                    # Rendered 2K MP4s, preview stills, and QA reports
├── SCRIPT_*.md                    # Per-short story scripts
└── PRODUCT.md                     # Full product & design specification
```

---

### Quick Start

#### Prerequisites
- **Node.js** `>= 20` & **npm**
- **Python** `>= 3.10` with `numpy` and `pillow` (`python -m pip install numpy pillow`)
- **FFmpeg** + **FFprobe** and **Chromium / Chrome** (`npx remotion browser ensure`)
- **Rust** toolchain *(optional — required only for native Tauri desktop builds)*

#### 1. Install Video Pipeline Dependencies (Repo Root)

```bash
npm install
npx remotion browser ensure
npm run typecheck
```

#### 2. Launch the ToonForge Studio UI

```bash
cd toonforge
npm install
npm run dev
```

Opens the studio at `http://localhost:1420` with the workspace bridge automatically mounted at `/api`.

#### 3. Optional: Native Desktop App (Tauri v2) or Standalone Bridge

```bash
# Native desktop shell (requires tauri-cli v2)
cd toonforge
cargo tauri dev

# Standalone local HTTP workspace bridge (default 127.0.0.1:4190)
npm run bridge
```

---

### Commands & Verification

| Scope | Command | Purpose |
| :--- | :--- | :--- |
| **Studio UI** (`toonforge/`) | `npm run dev` | Start Vite dev server + `/api` workspace bridge (`:1420`) |
| **Studio UI** (`toonforge/`) | `npm run build` | Typecheck and build production frontend bundle |
| **Studio Tests** (`toonforge/`) | `npm test` | Run Vitest unit & component tests |
| **Rust Tests** (`toonforge/src-tauri/`) | `cargo test` | Run Tauri Rust backend unit tests |
| **Pipeline** (repo root) | `npm run typecheck` | Verify Remotion / Three.js scene TypeScript compilation |
| **Pipeline** (repo root) | `npm run stills` | Render preview contact stills (`scripts/stills.mjs`) |
| **Pipeline** (repo root) | `npm run render` | Render 2K H.264 9:16 video via Remotion |
| **QA** (repo root) | `python scripts/short_qa.py <mp4> <qa_dir>` | Run frame & `-15 LUFS` loudness QA checks |

For the full HTTP Bridge & Tauri IPC endpoint table, see [`toonforge/README.md`](./toonforge/README.md).

---

### License

MIT
