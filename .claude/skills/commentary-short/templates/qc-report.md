# QC report: kelly-clarkson-molly-short.mp4

**File:** 1080×1920, 30 fps, H.264 High + AAC 320 kbps, 88.5 s, 38 MB.

| Check | Result | How |
|---|---|---|
| Starts and ends cleanly | ✅ Opens on CCTV with the title. Ends on Molly with a 2 s music fade | Frame sampling |
| Black frames | ✅ None | `blackdetect` (0.1 s, pix_th 0.08) |
| Unintended silence | ✅ None over 0.6 s | `silencedetect` −45 dB |
| Loudness | ✅ −13.9 LUFS integrated, −1.4 dBFS peak (YouTube target −14) | `ebur128` |
| Music under narration | ✅ Bed at −24 dB under the voice and −34 dB under the soundbite. Drops out for "no audio" | Built into the mix envelope |
| Captions match the narration | ✅ Whisper word timings, checked against the script; 9 transcription errors fixed (`edit/caption_fixes.json`) | Text diff against the script |
| Caption overlap | ✅ Fixed in render 3. Each caption ends where the next begins | Frame sampling at 1 s and 0.5 s |
| Safe zone | ✅ Captions centred at y≈1330, title at the top, nothing in the bottom ~25% where the Shorts UI sits | Visual |
| Network graphics or banners in frame | ✅ Cropped out (GMA/TODAY/News 12 lower-thirds, PTFO banner). Small network bugs (USA TODAY, Extra) remain inside some shots | Visual |
| Flash frames | ✅ Shots under 1 s removed. GMA wipe transitions trimmed out | Frame sampling at 0.25 s |
| Narration matches footage | ✅ e.g. "points at the bird" plays over the CCTV of her at Molly; "no audio" over the frozen CCTV frame | Timeline review |
| Licensing record | ✅ `licensing-manifest.md` | — |

**Renders:** 3. Render 1 had sub-second shots, a misplaced freeze frame and visible lower-thirds. Render 2 had overlapping captions and a GMA wipe. Render 3 is the final.

**Not checked by a human ear:** the audio was checked by measurement, not by listening. Please play the file once before uploading. A Whisper read-back of the voice was word-accurate, but it can't judge how natural the delivery sounds.

**Known limits:**
- Two brief dissolves at 0:10 and 0:22 come from the network footage itself.
- Source clips are 720p/1080p news footage scaled into a 1080-wide band. This doesn't add any detail that wasn't already in the source.
