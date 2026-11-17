# ToonForge — Product Specification

> Open-source desktop studio for producing vertical 2D-in-3D educational cartoon shorts with repeatable visuals, audio mastering, automated QA, and multi-AI CLI orchestration.

## 1. Product Identity & Mode
- **Name:** ToonForge
- **License & Distribution:** Open-source desktop application (MIT-compatible ecosystem) built with **Tauri v2 (Rust)** + **React 19** + **Remotion / Three.js**.
- **Surface Mode (`impeccable`):** **Operate mode** — high-density studio workbench combining a Trello-style Content Bank, live 9:16 Stage Preview, background Render Pipeline telemetry, and an embedded multi-AI PTY terminal.
- **Target Users:** Technical educators, solo content creators, and open-source contributors cloning a ToonForge-compatible shorts template repository to publish high-retention 9:16 reels without manually orchestrating terminal scripts for voiceover pauses, ffmpeg mixes, stills, renders, and frame-level QA.

## 2. Pinned Aesthetics & Design System
- **Glass & Material Engine:** [`amarnath3003/quickLiquid`](https://github.com/amarnath3003/quickLiquid.git) (`quick-liquid` v0.1.2, MIT) providing `clear`, `thin`, `regular`, and `thick` optical surfaces (`appearance: "light" | "dark"`, pointer specular tracking, press physics, and Chromium SVG `#ql-refract` displacement refraction).
- **Color Discipline (Monochrome B&W + Priority-Object Accent):** All application chrome, glass surfaces, tabs, background orbs, terminal logs, and non-priority stage elements render in pure **black, white, and neutral grayscale** (`#09090b` / `#18181b` / `#d4d4d8` / `#ffffff`). Vivid accent color (`#10b981` / `#047857` emerald) is reserved strictly for **priority focal objects**: active `Auto-Q: ON`, `VO Ready` badges, primary `Render` CTAs, active render progress, and the highlighted target story object inside the 9:16 stage diorama and logo mark.
- **Typography:**
  - Display & Pane Headers: **Playfair Display** (`600`, `700`)
  - Primary UI Controls & Body: **Poppins** (`400`, `500`, `600`, `700`)
  - Pipeline Metrics & PTY Logs: Monospace with `font-variant-numeric: tabular-nums`
- **Iconography:** `lucide-react` (`2px` uniform stroke vector icons only; zero Unicode emojis in UI chrome).
- **Craft Floor Rules:**
  - Strict `>= 4.5:1` contrast in both Light and Dark glass modes (high-contrast monochrome text on optical surfaces, diorama backdrops isolated inside `<svg>` / `<canvas>` stages).
  - Minimum `8px` (`12px–16px` standard) container inset padding; zero nested rounded pill wrappers; hairline `1px` dividers between items inside top-level glass panes.
  - Native `<dialog>` overlays with blur backdrops; snappy ease-out transitions (`cubic-bezier(0.16, 1, 0.3, 1)`), zero bounce easing, zero decorative kickers or section numbers.

## 3. Core Creator Capabilities
1. **First-Run Onboarding Walkthrough & Dependency Wizard:** Guided modal for brand-new installations offering both an **AI Auto-Setup Prompt** (injects directly into `agy`, `claude`, `codex`, or `opencode` to check/install `git`, `node`, `python`, `numpy`, `pillow`, `ffmpeg`, and Remotion browser dependencies), copyable **Manual Terminal** commands, and a **3-Step Studio Walkthrough** before rendering.
2. **One-Click GitHub Sync & Toolchain Preflight:** Clone/pull the template repo and verify `git`, `node`, `python`, `ffmpeg`, and headless Chromium readiness with actionable install guidance.
3. **Trello Content Bank & Smart Auto-Queue:** Left-pane Kanban workspace (`Backlog`, `Queued`, `Done`) where cards declare audio mode (`Needs VO`, `VO Ready`, `No-VO`). When `Auto-Queue` is enabled, cards transitioning to `VO Ready` or explicit `No-VO` enqueue automatically into the background render runner.
4. **Flexible Character Rig Selector:** Switch per-card between the zero-asset built-in **Stickman** rig or a user-supplied **Custom Chibi Sprite Sheet** (`src/videos/chibi/sprites/`, `faces/`, `fx/`, `chibiActor.ts`) imported cleanly into `src/videos/chibi/`.
5. **Visual Background Pipeline Monitor:** Live progress for `VO Sync` / beat timing, Python `audio/dsp.py` `-15 LUFS` mix, Remotion 1440x2560 H.264 render, and `scripts/short_qa.py` frame/loudness checks plus 4-still contact preview (`scripts/stills.mjs`).
6. **Embedded Multi-AI CLI Switcher:** Interactive `portable-pty` terminal dock inside the desktop shell that spawns the user's installed coding agent CLI — **Antigravity** (`agy`), **Claude** (`claude`), **Codex** (`codex`), or **OpenCode** (`opencode`) — with context-aware prompt macros wired to the active Trello card and character rig.

## 4. Non-Goals (v1)
- Not a cloud SaaS render farm or subscription video host; all renders run locally on the creator's machine.
- Not a freeform timeline/keyframe NLE (After Effects / Premiere replacement); scenes remain declarative TSX templates editable directly by AI coding agents or TypeScript authors.
- Not bundling proprietary AI models or API keys; creators authenticate their own CLI agent binaries locally.
