# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

(Rendered inside a Tauri v2 desktop window; Vite dev server with a Node workspace bridge in browser mode.)

## Users

Any creator who wants to use the free `claude-animated-shorts` Claude skill (github.com/mromidev/claude-animated-shorts) without living in a terminal. Public, open-source audience; English UI. Many are meeting Remotion, ffmpeg, and Claude Code for the first time, so first-run clarity matters as much as speed for repeat users.

## Product Purpose

ToonForge is a desktop GUI for the claude-animated-shorts skill. It explains what the skill does, checks and installs the software it needs, and walks a creator through the skill's pipeline to a finished 55-70 s vertical (1440x2560) animated short: 2D characters in a 3D three.js world, rendered locally with Remotion. Success: a new user goes from install to a QA-passed MP4 without reading the SKILL.md themselves.

## Positioning

A faithful GUI for one specific, proven skill pipeline, not a generic video editor or AI video generator. Every render runs on the creator's own PC; the AI work is done by the creator's own coding agent CLI (Claude Code by default; agy, codex, opencode also supported).

## Operating Context

The skill's pipeline, which the app must mirror step by step:
1. Topic and facts (one surprising true story with a visual cause and effect, plus an everyday analogy)
2. Script (~3.7 words/s, 55-70 s)
3. Voice (`voice.wav` + word timings `words.json`), or no-VO
4. Shot plan in `story.ts` (copy the bridge template to `src/videos/<name>/`, register the composition in `src/Root.tsx`)
5. World and characters
6. Post (ink, lens blur, grade)
7. Sound (timeline, SFX, music, mix with ducking and loudness)
8. Look checks (stills)
9. Final render (2K H.264)
10. QA (frames and loudness) and deliver

Required software: Claude Code (or another supported agent CLI), Git, Node.js, Python 3 (numpy, pillow), ffmpeg, Remotion with `@remotion/three` and its headless Chromium. Skill install path: `~/.claude/skills/cartoon-3d-short/`. Tip from the skill: set `REMOTION_TMP` to a large drive.

## Capabilities and Constraints

- Navigation: left sidebar with a Guide section (Introduction, How to use, Requirements) and a Project section where each pipeline step is its own page. The Content Bank board, stage preview, and agent terminal are supporting panels, not the primary structure.
- Existing features to keep: workspace bridge (env probes, board, scripts, voiceover upload, pipeline run, CLI exec), Stickman / Chibi rig choice, auto-queue, light/dark theme, multi-CLI switcher.
- Script language (English, Taglish, Tagalog) stays as an option, not the headline.
- Non-goals: cloud rendering, timeline/keyframe editor, bundled models or API keys.

## Brand Commitments

- Name: ToonForge.
- Identity carried from the incumbent spec (`../PRODUCT.md`): monochrome glass chrome (quick-liquid surfaces) with a single emerald accent reserved for priority objects (primary CTA, ready states, active progress); Playfair Display for display, Poppins for UI, monospace with tabular numbers for logs and metrics; lucide-react icons, no emoji in chrome. User confirmed: keep this identity, fix and tighten it.

## Evidence on Hand

- The skill's README and SKILL.md (upstream repo above); proven example short "The Bridge That Fell for a Song" (67 s) is upstream's, not ToonForge's.
- Local workspace scripts (`SCRIPT_*.md`), `voice/`, `out/` renders.
- No testimonials, user counts, or benchmarks exist; do not invent them.

## Product Principles

1. Mirror the skill: every screen maps to a named pipeline step, in order.
2. Explain before asking: each step says what it does, what it produces, and what it needs.
3. Never hide the terminal truth: real command output and errors stay visible and copyable.
4. Local and owned: the user's machine, the user's agent, the user's story.

## Accessibility & Inclusion

WCAG AA contrast in both themes; full keyboard navigation; visible focus.
