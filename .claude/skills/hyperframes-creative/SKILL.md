---
name: hyperframes-creative
description: Non-animation creative direction for HyperFrames videos. Use for design spec (frame.md / design.md) handling, palettes, typography, narration, beat planning, audio-reactive visuals, composition patterns, and brand / style decisions. For atomic motion patterns and scene blueprints, use `hyperframes-animation`.
---

**Plugin installs:** Before setup or freshness commands, follow [plugin execution rules](../hyperframes/references/plugin-installation.md) when this skill is inside a HyperFrames plugin. Standalone installs keep the update instructions below.

# HyperFrames Creative

Brand, pacing, style, narration, and composition direction. Use after the technical contract from `hyperframes-core` is in place.

For motion patterns, scene blueprints, transitions, and CSS marker effects, use `hyperframes-animation` — this skill is intentionally non-animation.

> **Read these two FIRST for any non-trivial composition — they override web instincts:**
>
> - `references/house-style.md` — "interpret the prompt, generate real content," the lazy-default list, and the background/foreground layer recipe. This is what turns a literal restyle into a _concept_.
> - `references/video-composition.md` — video-medium scale, depth, and foreground detail. It explains how to avoid empty web-page layouts without imposing a universal element count.
>
> Skipping these is the single biggest cause of generic, web-page-looking output. They are not optional rows in the routing table below — for anything beyond a one-line edit, open both before you choose colors or write HTML.

## Workflow

1. If a project has a design spec, **read it first** and treat its frontmatter tokens as brand truth (colors, fonts, spacing, tone, constraints). Which file to read (precedence `frame.md` → `design.md` → `DESIGN.md`) and how to parse it (frontmatter = normative, prose = context) are defined once in [`references/design-spec.md`](references/design-spec.md) — resolve and load per that doc.
2. If no design spec exists and the user asks for visual direction, choose a route:
   - Ready-made frame-preset (optional) → `frame-presets/` (adopt a `FRAME.md` as `frame.md`; see `references/design-spec.md`)
   - Named style or mood → `references/visual-styles.md`
   - Fast defaults → `references/house-style.md`
   - Interactive selection → `references/design-picker.md`
3. For multi-scene work, plan beats and rhythm before writing HTML → `references/beat-direction.md`. For scene transitions, jump to `hyperframes-animation/transitions/`.
4. For motion-heavy work, read `references/motion-principles.md` (high-level guardrails), then go to `hyperframes-animation` for atomic rules.

## Routing

| Topic                                                                                                   | Read                                           |
| ------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Adopt a ready-made frame-preset as `frame.md` (optional)                                                | `frame-presets/` · `references/design-spec.md` |
| Default palettes, motion, typography, lazy defaults to question                                         | `references/house-style.md`                    |
| Named style presets, mood-to-style routing                                                              | `references/visual-styles.md`                  |
| Palette-specific color tokens                                                                           | `palettes/*.md`                                |
| Composition patterns — PiP, text-behind-subject, title card, slide show                                 | `references/composition-patterns.md`           |
| Stats / infographic presentation                                                                        | `references/data-in-motion.md`                 |
| Structured expansion for open-ended prompts                                                             | `references/prompt-expansion.md`               |
| Video-medium density, scale, color, frame composition                                                   | `references/video-composition.md`              |
| Per-beat direction, rhythm planning, transition timing                                                  | `references/beat-direction.md`                 |
| Post-authoring spec verification (colors, type, corners, spacing, depth)                                | `references/design-adherence.md`               |
| High-level motion guardrails and GSAP-quality rules                                                     | `references/motion-principles.md`              |
| Font selection, pairings, rendered-video type guardrails                                                | `references/typography.md`                     |
| Story doctrine — hook language, value-before-evidence, storyboard-as-proposal, source-traceable visuals | `references/story-spine.md`                    |
| Script pacing, tone, openings, number pronunciation                                                     | `references/narration.md`                      |
| Precomputed audio bands mapped to motion                                                                | `references/audio-reactive.md`                 |

## Scripts

- `scripts/contrast-report.mjs` — inspect contrast warnings from rendered frames.
- `scripts/extract-audio-data.py` — pre-extract audio bands for audio-reactive compositions.
- `scripts/package-loader.mjs` — support script for bundled creative tooling.

`contrast-report.mjs` resolves helper packages from the current project first, then can bootstrap the bundled HyperFrames package version. Set `HYPERFRAMES_SKILL_PKG_VERSION=<version>` only when running the skill outside the bundled CLI/skill install and you need to pin that bootstrap version explicitly.

Run with explicit paths, for example:

```bash
python <SKILL_DIR>/scripts/extract-audio-data.py <audio-file>
```

Animation analysis (`animation-map.mjs`) lives in `hyperframes-animation/scripts/`.

## Boundaries

- Do not override `hyperframes-core` technical rules.
- Do not require a design system for a minimal technical composition.
- Do not add extra scenes, narration, music, captions, or transitions unless the request calls for them or you first propose the expansion.
- Keep recipe references task-specific; do not read every reference for simple edits.
## Local addendum (AI-Video-Editor workspace): clipping and Shorts lessons
Added by the user's request on 2026-10-20. Re-add it after `hyperframes skills update` if it disappears; the source of truth is `docs/clipping-playbook.md`.

For any job that cuts Shorts from existing footage (clipping, campaign clips, recuts, commentary, edits of a supplied video), read `docs/clipping-playbook.md` before planning:
- **Story first:** each Short is a standalone mini-story, setup (cause) → tension → reveal (effect). Open on something baffling or surprising and pay it off at the end. Never pad a line with unrelated hype B-roll. Run the 8-question standalone test before cutting and on the final file.
- **Measured look the user prefers:** the /youtube-style-clip look.
  - 10–35 s; frame 1 mid-action; headline bar of 6 words or fewer;
  - one-word captions; hard cuts; few SFX and flashes;
  - one continuous −14 LUFS bed with no dead space.
- **Safety:** the campaign brief wins. Use official logos unaltered, and no AI voiceover unless allowed. Check every frame for third-party logos, other creators, alcohol and minors, and every line for curses and banned language. Use licensed music, credited when CC BY.
- **Workflow traps:**
  - set crops on frames of the cut clip, not the source;
  - fix Whisper mishears;
  - animate only transforms and opacity;
  - the renderer never overwrites.
