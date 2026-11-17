# Project overview: AI-assisted YouTube Shorts automation

A short, public summary of what this project is for, how it got here and where it is going. Written 2026-11-17
from the project's private session notes and memory (those stay private; nothing below is a campaign term,
account detail or personal note).

## The goal
- Build and grow faceless YouTube channels to monetization **before February 2027**, using Claude Code to do the
  research, scripting, voice, editing and rendering, with a human approving the picks and uploads.
- Earn alongside that from **brand clipping campaigns**: cutting creators' long videos into short, story-first
  9:16 clips that follow each campaign's live brief.
- Keep it cheap: free and open tools first (local TTS, HyperFrames, Remotion, ffmpeg, GitHub Actions), paid
  APIs only with the user's own keys and a per-use yes.

## What the system makes
| Output | Skill / command | How |
|---|---|---|
| Clipped Shorts from long videos | `/editor`, `/youtube-style-clip`, `/viral-shorts`, `/meme`, `/montage`, campaign skills | Find standalone mini-stories (setup -> tension -> payoff), edit in HyperFrames: one-word captions, hard cuts, punch-ins, few SFX, one grade |
| AI-narrated commentary Shorts | `/commentary-short` | Research and verify a story, source clips, original script, local voice, ffmpeg build, QC |
| 2D-in-3D cartoon story Shorts | `/3d-short`, `/cartoon-3d-short` | 10 fact-checked story ideas -> script -> voice -> three.js world inside Remotion -> 2K render |
| Flat cartoon story Shorts | `/cartoon-audio-short` | Script, voice, animated cartoon, music + SFX under the voice |

## How we got here (timeline)
- **Oct 2026:** AI-Video-Editor workspace: commentary kit, HyperFrames pipeline, shared clipping playbook
  (`docs/clipping-playbook.md`), default 7-step editing workflow, motion-graphics library, token-saving rules.
- **Early Nov:** the Obsidian vault became Claude's long-term memory; skills moved to the vault as the master
  copy; cloud sessions became the main workspace. Studied top-performing Shorts (visuals, pacing, captions,
  voice, music level) and turned the findings into skill rules. Added the 3D cartoon skills.
- **Nov 7:** standard transition set (the 20 most-used CapCut-style transitions) with auto SFX in every editing skill.
- **Nov 14-15:** GitHub Actions render workflow (HyperFrames, cartoon-audio, Remotion); b-roll skills;
  research on why clips go viral; video-style reverse-engineering skills.
- **Nov 16:** compared free voices; a cloned, casual narrator (Qwen3-TTS) became the default voice in every
  skill. First full 3D short (the Vasa warship, 1628) made end to end in the cloud.
- **Nov 17:** the 3D kit (`tools/remotion-3d`) with check / draft / boundary / render / deliver scripts;
  Kenney CC0 models restored; **coldframe** added so a 3D short renders on 20 GitHub machines in parallel;
  repos made public with private companions (below).

## Rules that came from experience
- Story first: every clip is a complete mini-story; packaging comes second. A hype montage with no story failed.
- Quality, not count: low views did not come from too many edits; good clips use many frame-synced effects.
- A campaign's live brief always overrides the house style.
- Cloud 3D renders run on software WebGL: never `frameloop="always"`, never FXAA, never mount/unmount post
  passes mid-shot (it over-blurred whole shots). On the PC's GPU a 2K short takes minutes; in the cloud, hours
  on one machine, or ~20-40 min with coldframe.
- Deletions stay local; never commit secrets, licensed media or personal notes.

## Repos
| Repo | Visibility | Role |
|---|---|---|
| `ai-video-editor` | public | Clipping/editing workspace; cloud sessions start here (`cloud/session-start.sh`) |
| `yt-automation-vault` | public | Master skills, tools, the 3D kit, coldframe + render workflows |
| `ai-video-editor-private` | private | Licensed SFX packs, campaign briefs and prompts, Claude's memory, channel analytics, voice reference |
| `yt-automation-vault-private` | private | Licensed SFX (`sfxv2`), session notes, graphs, campaign skill, voice reference |

Cloud sessions attach all four; the start script links the private files into place. Changes to those paths
are committed in the `-private` repo.

## Open items
- First coldframe test render of the Vasa short (timing and frame check) on the public vault.
- Golden-hour shots in the 3D kit still read cool (light check); fix in the next ship short.
- Keep growing the channels toward monetization with the retention playbook (cold open on the payoff,
  20-35 s, payoff at the end).
