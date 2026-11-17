# Vault rules for Claude

This folder is an Obsidian vault. Notes are plain Markdown; Obsidian picks up file changes live. Setup details: `Claude/Sessions/2026-11-04 Obsidian REST API setup.md`.

## The vault is your second brain
- Treat this vault as long-term memory. In long sessions or new chats, don't rebuild context by re-reading the conversation from the top: look it up here (`Claude/Index.md` and the notes it links, or `graphify query "<question>"`).
- That only works if the notes are complete, so log everything worth remembering (see "After every task").

## Channel defaults
- The default voice in **every** skill is **clone_3_voicebox-qwen3** (Qwen3-TTS 1.7B Base cloning `.claude/skills/default-voice/voice/ref.wav`; settings and engine in `.claude/skills/default-voice/`). Set 2026-11-16, replacing Kokoro `am_fenrir` (see `Claude/Sessions/2026-11-16 Free AI voice comparison.md`).
- The cloud repo (`gmacc616/yt-automation-vault`) is the main workspace. The vault's `.claude/skills/` is the master copy; push after every change.
- **That repo is PUBLIC (2026-11-17).** Private files live in `gmacc616/yt-automation-vault-private`: `sfxv2/`, `Claude/Sessions`, `Claude/Prompts`, `Claude/graphify-out`, `Graphs/`, `graphify-out/`, `.claude/skills/gab`, `.claude/skills/default-voice/voice`. They are gitignored here and linked in by the cloud session start; commit and push changes to them in the `-private` clone. Never commit secrets, licensed media (Epidemic Sound etc.), campaign briefs or personal notes to the public repo.
- **Except deletions:** when the user tells you to delete something, delete it locally only (prefer the Recycle Bin) and never commit or push that deletion to the cloud. If a push also carries other changes, leave the deletions unstaged.

## Before every task
- Read `Claude/Index.md`, then any notes it lists (or that a quick search of the vault turns up) that relate to the task. Use what's there; don't redo what's already recorded.

## After every task
- Record what we talked about and did in `Claude/Sessions/YYYY-MM-DD <topic>.md` (append to that day's note if the topic matches, otherwise create one). Cover decisions, outcomes, open items and gotchas.
- Add a one-line `[[link]]` to the new note under "Sessions" in `Claude/Index.md`.
- Then refresh the graph (see Graphify below).
- Never write secrets (API keys, passwords, private keys) into notes.

## Local REST API
- `https://127.0.0.1:27124` (self-signed cert: `curl -k`), only while Obsidian is open.
- Key: `apiKey` in `.obsidian/plugins/obsidian-local-rest-api/data.json`. Read it into a variable; never print it.
- Plain file reads/writes are fine for notes; use the API for things that need the running app (commands, active note, search).

## Graphify
- The notes in `Claude/` are graphed with graphify. Graph data is in `graphify-out/` (`graph.json`, `GRAPH_REPORT.md`, `graph.html`); the Obsidian export (one note per concept plus `graph.canvas`) is in `Graphs/vault-notes/`.
- Before a task, if `graphify-out/graph.json` exists, `graphify query "<question>"` (run from the vault root) is a quick way to find related past work.
- Refresh after logging a session: run `/graphify "<vault>/Claude" --update --obsidian --obsidian-dir "<vault>/Graphs/vault-notes"` from the vault root. Only scan `Claude/`, never `Graphs/` or `graphify-out/` (they are generated).
