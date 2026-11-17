# Narration guide: the original AI voiceover

**Write only after the footage analysis.** Every sentence must be supported by something visible or audible in the selected clips. Revise it after timing is locked.

## Shape (fits 13–20 s Shorts; scale up for longer)
| Beat | Length | Job | Reference wording (pattern, don't copy) |
|---|---|---|---|
| Hook | 1–2 s, from 0.0 s | Premise + implied question, over the teaser | "Things you should see about this house." / "This random dude was shocked when he discovered how fast…" |
| Context | 1.5–3 s | Who or what, plus one concrete fact or number from the footage | "…bought this tiny foldable house for $50,000…" |
| Turn | 1–2 s | An escalation word that sets up the proof | "But to prove it…" |
| Build | 2–4 s | Name each action as it appears, one line per shot | "…this guy smashed the wall multiple times…" |
| Final tease | ≤1 s | Point at the biggest moment without saying the outcome | "…and they even dropped this." |
| Payoff | 1–3 s | **Silence the narrator.** Let the image or the original reaction land | (impact / "Oh my gosh") |

**Handover option (reference B):** the narrator speaks only the hook and context (about 4 s), then the original dialogue carries the rest. Use it when the source has good natural lines; it keeps the clip authentic.

## Rules
- **Words are said live:** about 2.8–3.2 words per second (the references run about 3.3). Fit the line to the shot rather than speeding the voice up.
- **Concrete over generic:** numbers, objects and actions the viewer can see. No "you won't believe", "insane" or "wait for it" padding unless it's the only honest tease.
- **No fake stakes:** never claim an outcome, price, identity, record or emotion the footage doesn't show or say. Names and numbers must come from the source, its official title/description or the campaign brief, and the brief's rules on naming people win.
- **No intro and no outro** ("Hey guys", "subscribe"). The first word is the hook.
- **Tease, don't spoil:** the hook may show the setup or the moment before the result, never the result.
- **One idea per sentence**, short clauses, present or simple past tense, conversational.
- **Captions** follow the narration word for word. Emphasise 1–2 words (the number, the action verb).

## Production (local, free)
- **Voice:** default narrator for every skill = clone_3_voicebox-qwen3 (`default-voice` skill: Qwen3-TTS cloning our reference voice, casual and realistic). `py .claude/skills/default-voice/qwen_voice.py lines clipNN/lines.txt -o clipNN` (one WAV per line, model loaded once) or `py .claude/skills/default-voice/qwen_voice.py line "<line>" -o clipNN/voN.wav`. Write lines the way you'd say them: contractions, `...` before a reveal, `!` on the punch word, numbers as words. About 1-1.5 min per 10 s of voice on CPU (+ ~30 s model load).
- **Mix in:** `py tools/pipeline/add-vo.py clipNN --at <t> --vo clipNN/voN.wav [--duck 14]`. It ducks the original under the voice and keeps `tight_novo.mp4`.
- **Many campaigns ban AI voiceover** (e.g. ClipFarm × DraftKings: "AI edits or added voiceovers"). If the brief bans it:
  - use the reference-B handover without the narrator: the original audio plus a text hook;
  - keep the teaser structure;
  - tell the user.
