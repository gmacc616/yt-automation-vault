# Backup checklist: Windows 11 → Ubuntu (Surface Laptop Go, 58 GB SSD)

A full conversion erases the whole disk. Do every step before you boot the Ubuntu installer.
Back up to an external USB drive or cloud, never to C: (only ~10 GB free, and it gets wiped).

## 0. Before anything
- [ ] Get an external USB drive (≥ 16 GB for backup, plus a second 8 GB+ stick for the Ubuntu installer)
- [ ] Plug in the charger. Do not do this on battery.
- [ ] Decide: is the Windows way back needed? If yes, make a Windows recovery USB (Settings → Recovery, or `recdisc`; 16 GB+). Windows 11 is tied to the device's digital licence, so it reinstalls and activates by itself later.

## 1. Disk encryption (do not skip)
- [ ] Check BitLocker / Device Encryption: Settings → Privacy & security → Device encryption
- [ ] If on, save the recovery key (account.microsoft.com/devices/recoverykey) and turn encryption OFF before installing Ubuntu, or the installer cannot see the disk
- [ ] Turn Secure Boot off or plan to enroll keys (Ubuntu supports Secure Boot; Surface firmware: hold Volume Up + Power)

## 2. Project: AI-Video-Editor (≈ 1.2 GB, lives in OneDrive)
Folder: `C:\Users\manth\OneDrive\Desktop\AI-Video-Editor`
- [ ] Confirm OneDrive shows "Up to date" (right-click the tray icon). Files marked cloud-only are NOT on disk; right-click the folder → Always keep on this device before copying.
- [ ] Copy the entire folder to the USB drive. Sizes seen:

| Folder | Size | Keep? |
|---|---|---|
| jobs | 484 MB | Only if jobs are unfinished |
| output | 245 MB | Finished renders: yes |
| videos | 229 MB | Source footage: yes if not re-downloadable |
| downloads | 128 MB | Re-downloadable: optional |
| commentary-kit | 109 MB | Yes (the commentary tooling) |
| assets, channel, docs, tools, skills, data | < 25 MB | Yes |
| CLAUDE.md, skills-lock.json | tiny | Yes |

- [ ] Run `/cleanup-project` on finished jobs first to shrink what you copy

## 3. Claude Code and memory
- [ ] Copy `C:\Users\manth\.claude\` (≈ 0.4 GB): settings, skills, memory, session history
- [ ] Memory index and notes: `C:\Users\manth\.claude\projects\C--Users-manth-OneDrive-Desktop-AI-Video-Editor\memory\`
- [ ] Project settings: `AI-Video-Editor\.claude\settings.json` (included in the project copy)
- [ ] Note the real Python path from the commentary-channel memory; it differs on Linux (`python3`, not `py`)

## 4. Tool inventory (reinstall later, record versions)
- [ ] Output of: `node -v`, `py --version`, `ffmpeg -version`, `npm ls -g --depth=0`
- [ ] HyperFrames version and project dependencies (`package.json` files in the project)
- [ ] Kokoro TTS model files, if downloaded separately (check `commentary-kit`)
- [ ] Any pip packages: `py -m pip freeze > requirements-backup.txt` (save to USB)

## 5. Accounts and credentials (nothing to copy, just make sure you can sign in again)
- [ ] Claude account, YouTube / SnapRush Studio, Google, GitHub: confirm you know the passwords or have a password manager export
- [ ] 2FA: have the authenticator app or backup codes ready
- [ ] Browser: export bookmarks and passwords from Edge (or turn on sync) and note the extensions you use
- [ ] Wi-Fi password(s)
- [ ] API keys or tokens kept in `.env` files (they are inside the project copy; double-check they are included)

## 6. Personal files outside the project
- [ ] Desktop, Documents, Pictures in OneDrive: check they are synced, or copy them
- [ ] Downloads (≈ 10 MB): anything you want
- [ ] `C:\Users\manth\AppData\Roaming` (≈ 0.2 GB): only app-specific settings you care about
- [ ] Anything saved outside the user profile (search the C: root for stray folders)

## 7. Verify the backup
- [ ] Open the USB drive and open a few video files to confirm they play
- [ ] Compare folder sizes with the originals
- [ ] Copy the backup a second time to a second location (cloud or another drive) if the data matters

## 8. After backup, install Ubuntu
- [ ] Download Ubuntu 22.04 or 24.04 and write it to the second USB (Rufus or balenaEtcher)
- [ ] Boot from USB (Surface: hold Volume Down while powering on)
- [ ] Choose "Erase disk and install Ubuntu" only after every box above is checked
- [ ] Set up a 2–4 GB swap file (4 GB RAM)
- [ ] Install the Claude desktop app from Anthropic's apt repository

## Known losses on Linux
- No official OneDrive client (the project is no longer synced)
- Surface camera and fingerprint reader may not work (try the linux-surface kernel)
- Computer Use and dictation are not in the Linux beta
- Cowork needs a virtual machine, which is too heavy for 4 GB RAM
