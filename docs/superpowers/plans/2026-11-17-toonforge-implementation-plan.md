# ToonForge Full-Stack Implementation Plan

> **For agentic workers:** Follow strict TDD (`RED -> verify fail -> GREEN -> verify pass`) and commit atomically at each milestone on `main`.

**Goal:** Build the open-source **ToonForge** desktop studio (`Tauri v2 Rust + Node Workspace Bridge + React 19 + quick-liquid + lucide-react`) in `toonforge/` wired directly to this workspace's Remotion, Python DSP (`audio/dsp.py`), Stills (`scripts/stills.mjs`), and Frame QA (`scripts/short_qa.py`) production pipeline.

**Architecture:** Dual-runtime backend adapter (`src/lib/backend.ts`) speaking cleanly to either Tauri `invoke()` (`src-tauri/src/*.rs`) or the live Vite/Node `/api/*` Workspace Bridge (`server/bridge.mjs`) so every studio capability runs and tests locally even without `rustc`/`cargo` pre-installed, while keeping complete Tauri v2 + `portable-pty` Rust core source files in `toonforge/src-tauri/`.

**Visual Identity:** Strictly monochrome (`#09090b`–`#ffffff`) QuickLiquid Light & Dark glassmorphism (`Playfair Display` headings, `Poppins` UI, `lucide-react` uniform 2px icons) with vivid emerald (`#10b981` / `#047857`) reserved exclusively for priority objects (`Auto-Q: ON`, `VO Ready`, `Render`, active progress, target story object inside 9:16 stage SVGs/logos, and primary onboarding prompt actions).

---

### Task 1: Git Initialization & Specs Baseline
- **Files:** `.gitignore`, `PRODUCT.md`, `docs/superpowers/specs/2026-11-17-toonforge-design.md`, `docs/superpowers/plans/2026-11-17-toonforge-implementation-plan.md`
- **Verify:** `git status --short` clean after initial commit on `main`.

### Task 2: Scaffold `toonforge/` Workspace
- **Files:**
  - `toonforge/package.json` (`react` 19, `react-dom` 19, `lucide-react`, `quick-liquid`, `@tauri-apps/api`, `vite`, `vitest`, `jsdom`, `@testing-library/react`)
  - `toonforge/tsconfig.json`, `toonforge/vite.config.ts`, `toonforge/index.html`
- **Verify:** `npm install` completes cleanly in `toonforge/`. Commit scaffold.

### Task 3: Domain Model & Auto-Queue Engine (TDD)
- **Test (RED):** `toonforge/src/__tests__/domain.test.ts` (cycle card modes `needs_vo` -> `vo_ready` -> `no_vo`, auto-queue backlog transition when `autoQueue == true`, VO file auto-detection, AI & manual setup command generation for `agy`/`claude`/`codex`/`opencode`).
- **Implementation (GREEN):** `toonforge/src/lib/domain.ts`.
- **Verify:** `npm test` fails on RED, passes 100% on GREEN. Commit.

### Task 4: Node Workspace Bridge + Dual-Runtime Client + Tauri v2 Rust Core (TDD)
- **Test (RED):** `toonforge/src/__tests__/backend.test.ts` against repo root (`GET /api/env`, `GET/POST /api/board`, `GET /api/rigs` verifying `21` sprites / `16` faces / `6` fx, `POST /api/cli/exec`, `POST /api/pipeline/run`).
- **Implementation (GREEN):**
  - `toonforge/server/bridge.mjs`
  - `toonforge/src/lib/backend.ts`
  - `toonforge/src-tauri/{Cargo.toml,tauri.conf.json,build.rs,src/{main.rs,lib.rs,git_sync.rs,board_watch.rs,rig_manager.rs,pipeline_job.rs,pty_host.rs}}`
- **Verify:** `npm test` passes `domain.test.ts` and `backend.test.ts`. Commit.

### Task 5: React 19 Studio UI + Craft Floor QA (TDD)
- **Test (RED):** `toonforge/src/__tests__/App.test.tsx` (brand logos + Compare `<dialog>`, First-Run `Setup Guide` `<dialog>` with AI/Manual/Walkthrough tabs, Light/Dark toggle, Content Bank Kanban + Auto-Queue + Add Card, Stage Preview `Stickman` vs `Chibi Sheet`, Pipeline steps, Multi-AI CLI switcher & macros).
- **Implementation (GREEN):**
  - `toonforge/src/styles/toonforge.css`
  - `toonforge/src/components/LogoSvg.tsx`
  - `toonforge/src/components/StageSvg.tsx`
  - `toonforge/src/App.tsx`
  - `toonforge/src/main.tsx`
- **Verify:** `npm test` + `npm run build` + `impeccable.cmd detect --json` clean (`0` defects) + clean `git status` & `git log`.
