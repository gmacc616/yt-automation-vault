---
name: cleanup-project
description: Recycle a finished video project's job files, render projects, downloaded source and per-render junk (extracted frames, render temp folders, throwaway browser profiles, npm logs). Keeps everything the workflow reuses so nothing has to be reinstalled. Run ONLY when the user invokes /cleanup-project (never automatically after rendering).
---

# Cleanup project

Run this only when the user asks for it (`/cleanup-project`, optionally with a project
name). Never run it on your own after a render.

Workspace: `C:\Users\manth\OneDrive\Desktop\AI-Video-Editor`

## Goal
Remove only things a next project will never use again. Keep everything the workflow
needs, so the next project starts immediately with no reinstall or re-download.

## Recycled (not needed by a next project)
- **The finished project's own files:** `jobs\<job>\` (audio, transcripts, cut lists,
  base clips), `videos\<project>\` (compositions, snapshots, logs), and the downloaded
  source in `downloads\`.
- **`%TEMP%\hyperframes-extract-cache-u\`:** frames extracted from that project's
  footage. They're keyed to that source, so no later project reuses them.
- **`%TEMP%\hf-render-*`:** render scratch folders.
- **`%TEMP%\puppeteer_dev_chrome_profile-*`:** a throwaway browser profile created on
  every render or check (can be 200 MB+). The browser itself is kept.
- **`%LOCALAPPDATA%\npm-cache\_logs\*`:** npm debug logs.

## Never touched (needed by the workflow)
- `output\`, `tools\`, `.agents\`, installed skills, Auto-Editor
- `~\.cache\hyperframes\chrome` and `fonts`: the render browser and fonts.
  Re-downloading the browser is slow, and Smart App Control has blocked it before.
- `~\.cache\huggingface`: Whisper models.
- `%LOCALAPPDATA%\npm-cache\_npx`: all installed HyperFrames versions. All of them
  are kept, so no project ever reinstalls.
- `%LOCALAPPDATA%\npm-cache\_cacache`: the npm package cache.
- Python packages (faster-whisper, yt-dlp) and ffmpeg.

The script refuses to recycle any of these, even if they're passed by mistake.

## Steps
1. **Pick the project(s).** If the user named one, use it. Otherwise list `jobs\`,
   `videos\` and `downloads\`, and match each item to an `output\` subfolder. Clean only
   projects whose final files already exist in `output\`. If a project has no output, or
   you can't tell, leave it and say so.
2. **Make sure nothing is running.** No render, check or transcription may be in
   progress, because the browser profiles and frame cache are in use while one runs.
3. **Dry run** (one call):
   ```powershell
   & "$env:USERPROFILE\.claude\skills\cleanup-project\cleanup.ps1" -Paths "<ws>\jobs\<job>","<ws>\videos\<project>","<ws>\downloads\<source file>"
   ```
   With no `-Paths`, it cleans only the per-render junk.
4. **Recycle.** Run the same command with `-Go`. Items go to the Recycle Bin, never
   hard-deleted. Anything locked is skipped and reported.
5. **Report** the items and MB recycled, the size of the workflow cache that was kept,
   and that the space is only released once the Recycle Bin is emptied.
