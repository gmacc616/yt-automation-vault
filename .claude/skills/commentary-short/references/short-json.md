# `edit/short.json` reference

Full worked example: `example-short.json`. All times are in seconds.

```jsonc
{
  "slug": "kelly-clarkson-molly",            // output folder + file name: output-commentary/<slug>/<slug>-short.mp4
  "title": ["KELLY CLARKSON vs. A ", "$15M BIRD"],   // persistent top title: white part, yellow part
  "tempo": 1.0,                              // default narrator clone_3_voicebox-qwen3 (default-voice skill); 1.0 = natural pace, 1.05-1.1 = brisker
  "music": "Sneaky Snitch.mp3", "music_db": -24,     // commentary-kit/music file, bed level under narration
  "gap": 0.22,                                // pause between items
  "freeze_hold": 2.2,                         // length of "freeze" shots

  "sources": {                                // key -> sources/raw file
    "S2": {"file": "S2.mp4", "clean": [0, 44, 1280, 556], "credit": "GOOD MORNING AMERICA (ABC)"}
    //  clean = banner-free rect [x, y, w, h] in source pixels; credit = on-screen "SOURCE:" label
  },

  "items": [                                  // played in order
    {"id": "s01", "text": "Sentence one.|Sentence two.",          // narration (| = TTS sentence split)
     "label": "KELLY'S SIDE",                                     // optional section label (+ whoosh if sfx "sections")
     "shots": [["S2", 3.0, 7.5, 0.45, "punch"], ["S5", 12.0, 16.0, 0.78, "push"]]},
                // [source, in, out, focus_x 0..1 (pan of the 4:3 window), fx: push|punch|flat|freeze]
    {"id": "SB", "soundbite": ["S5", 102.40, 110.75],             // original audio of the source; captions come from tmp/S5/transcript.json
     "shots": [["S5", 102.40, 110.75, 0.5, "flat"]]}
  ],

  "sfx": [
    {"at": 0, "file": "generated/boom_impact.wav", "gain": -6},              // absolute time
    {"at": "sections", "file": "sound effects/sfxv2/fast-swish.mp3", "gain": -12},   // before every labelled item (sfxv2 transition pack, from the workspace root)
    {"item": "s04", "word": "audio", "file": "generated/boom_deep_sub.wav", "gain": -4}   // on a spoken word
  ],
  "music_dropouts": [{"item": "s04", "word": "audio", "dur": 1.6}],
  "pops":   [{"item": "s02", "word": "32", "text": "32M+ VIEWS", "dur": 2.2, "y": 380}],   // y = px from top of band
  "stamps": [{"item": "s04", "word": "audio", "text": "NO AUDIO", "dur": 2.0}],
  "emphasis": ["molly", "$15", "liar"],      // substrings: active word turns red instead of yellow
  "caption_fixes": {"s04": [["recites,", "receipts."], ["either.", ""]]},
  "cover": {"at": 51.8, "lines": ["THE TAPE HAS", "NO AUDIO"]}
}
```

**Word matching** (sfx, pops, stamps, dropouts) is a case-insensitive substring match on the first matching caption word of that
item, *after* `caption_fixes`. Numbers appear as Whisper writes them (`$15`, `32`, `$2,000`), so check with `--words-only`.

**Layout constants** (in `build_short.py`): band at y=330, 1080×810; captions centred at y=1330 (Anton 118, ≤3 words or 16 chars per
chunk, active word yellow and 110% scale); title at the top (margin 150); labels top-left of the band; credits bottom-left of the band.
Everything stays above the bottom ~25% where the Shorts UI sits.
