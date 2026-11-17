---
name: video-ad-reverse-engineer
description: |
  Reverse-engineer any video ad into a reusable template. Extracts ad format, hook type, script structure, visual strategy, pacing, and creative decisions. Produces a detailed breakdown that can be used to recreate the ad style with different products.

  Use when: "analyze this ad", "reverse engineer", "break down this creative", "what format is this ad", "storyboard this video", "recreate this ad style", "ad template", "deconstruct this ad", "ad breakdown", "competitor ad analysis", "extract ad format", "what makes this ad work", or when video files are uploaded for ad analysis.
---

# Video Ad Reverse Engineer

Deconstruct any video ad into a reusable creative template — extract the format, structure, hooks, and strategies that make it work.

---

## How It Works

1. **Input**: Provide a video ad file, URL, or series of screenshots
2. **Extract frames**: Pull key frames at critical moments (hook, transitions, CTA)
3. **Analyze structure**: Identify the ad format, pacing, and creative patterns
4. **Document template**: Output a reusable template with timing, script structure, and visual direction
5. **Recreate**: Use the template to create new ads in the same style

## Frame Extraction

Use `scripts/extract_frames.py` to pull key frames from the video:

```bash
python scripts/extract_frames.py input_video.mp4 --output-dir frames/ --num-frames 12
```

More frames = more detail in the breakdown. Use 8-12 for standard ads, 15-20 for complex ones.

---

## Analysis Framework

### Step 1: Identify the Ad Format

Classify the ad into one of these primary formats (see `references/ad-formats.md` for full catalog):

| Format | Characteristics | Common Duration |
|--------|----------------|-----------------|
| UGC Talking Head | Single person speaking to camera | 15-60s |
| Product Demo | Product in action, hands-on | 15-30s |
| Before/After | Split or sequential transformation | 15-30s |
| Testimonial Compilation | Multiple review clips | 30-60s |
| Problem-Solution | Pain point → product introduction | 15-30s |
| Listicle | "3 reasons why..." numbered format | 30-60s |
| Unboxing | Package reveal and first impression | 15-45s |
| Day-in-the-Life | Product woven into daily routine | 30-60s |
| Comparison | Side-by-side against competitor | 15-30s |
| Story Arc | Mini-narrative with characters | 30-60s |
| Text-on-Screen | Animated text overlays, no presenter | 15-30s |
| Mashup / Montage | Rapid cuts of multiple scenes | 15-30s |

### Step 2: Analyze the Hook (0-3 seconds)

Identify the hook type (see `references/hook-types.md` for full catalog):

**What to extract:**
- Exact first words spoken or displayed
- Visual element in frame 1
- Audio (music, sound effect, silence, voice)
- Text overlay content and style
- Hook category (pattern interrupt, question, bold claim, POV, stat, visual)

### Step 3: Map the Scene Structure

For each scene/segment, document:

```
SCENE [number]
  Timestamp: [start] - [end] ([duration])
  Visual: [what's on screen]
  Audio: [voiceover text / music / SFX]
  Text overlay: [any on-screen text]
  Camera: [angle, movement, framing]
  Purpose: [hook / problem / agitate / solution / feature / proof / CTA]
  Transition: [how it connects to next scene — cut / dissolve / swipe / zoom]
```

### Step 4: Extract the Script Pattern

Transcribe the audio and identify the script structure:

```
SCRIPT PATTERN
==============
Total word count: [X]
Words per second: [X]
Tone: [conversational / professional / urgent / humorous]

STRUCTURE:
  [0-3s] HOOK: [type] — "[exact words or description]"
  [3-Xs] SECTION 1: [purpose] — "[key message]"
  [X-Xs] SECTION 2: [purpose] — "[key message]"
  ...
  [X-end] CTA: [type] — "[exact words or description]"

NOTABLE TECHNIQUES:
  - [e.g., "Uses rhetorical questions to transition between sections"]
  - [e.g., "Repetition of key phrase 'in just 5 minutes'"]
  - [e.g., "Social proof embedded mid-script, not at the end"]
```

### Step 5: Analyze Visual Strategy

Document the visual decisions:

```
VISUAL STRATEGY
===============
Aspect ratio: [9:16 / 16:9 / 1:1 / 4:5]
Color palette: [dominant colors, warm/cool, saturated/muted]
Lighting style: [natural / studio / dramatic / phone-camera]
Text overlays: [font style, color, position, frequency]
B-roll usage: [percentage of ad, types of shots]
Presenter: [age, gender, style, on-screen vs voiceover]
Brand elements: [when/where logo appears, brand colors, watermarks]
Subtitles/Captions: [style, position, auto vs designed]
```

### Step 6: Document Pacing

```
PACING ANALYSIS
===============
Total duration: [X seconds]
Number of cuts/transitions: [X]
Average shot length: [X seconds]
Pacing pattern: [constant / accelerating / decelerating / variable]

Cut map:
  [0.0s] Scene start
  [2.5s] Cut — [type: hard cut / dissolve / swipe]
  [5.0s] Cut — ...
  ...

Energy curve:
  Start: [low / medium / high]
  Middle: [trajectory — building / maintaining / dipping]
  End: [low / medium / high]

Peak moment at: [timestamp] — [what happens]
```

### Step 7: Produce the Reusable Template

Combine all analysis into a fill-in-the-blank template:

```
REUSABLE AD TEMPLATE
====================
Format: [identified format]
Duration: [X seconds]
Aspect Ratio: [X:X]

SCENE 1: HOOK ([0-Xs])
  Visual: [description of what to show]
  Audio: "[script template with [PRODUCT] placeholders]"
  Text: "[overlay template]"
  Camera: [direction]

SCENE 2: [PURPOSE] ([X-Xs])
  Visual: [description]
  Audio: "[script template]"
  Text: "[overlay template]"
  Camera: [direction]

...

FINAL SCENE: CTA ([X-end])
  Visual: [description]
  Audio: "[CTA template]"
  Text: "[overlay template]"

PRODUCTION NOTES:
  - Music: [genre/mood/tempo]
  - Pacing: [X cuts, average X seconds per shot]
  - Tone: [described tone]
  - Key creative decision: [what makes this ad unique]
```

Use the full template in `references/output-template.md`.

---

## Recreate at Scale

Turn your extracted templates into new ads automatically:

### Using Creatify Ad Clone
The most direct path — provide the original ad as a reference and your product, and the API recreates the style:

```python
import requests

HEADERS = {
    "Content-Type": "application/json",
    "X-API-ID": "your-api-id",
    "X-API-KEY": "your-api-key",
}
BASE_URL = "https://api.creatify.ai/api"

# Step 1: Create a link for your product
link = requests.post(f"{BASE_URL}/links/", headers=HEADERS, json={
    "url": "https://your-product-url.com"
}).json()

# Step 2: Clone the reference ad with your product
clone = requests.post(f"{BASE_URL}/ads_clone/", headers=HEADERS, json={
    "link": link["id"],
    "video_url": "https://url-of-the-ad-you-reverse-engineered.mp4",
    "aspect_ratio": "9x16",
}).json()

# Step 3: Poll for completion
# Use polling pattern from video-ad-generator skill
```

### Using Extracted Scripts with AI Avatars
Feed your extracted script structure into the avatar API:

```python
# Take the script pattern you extracted and create avatar version
avatar_video = requests.post(f"{BASE_URL}/lipsyncs/", headers=HEADERS, json={
    "text": "Your adapted script based on extracted template",
    "creator": "persona-id-matching-original-demographics",
    "aspect_ratio": "9:16",
}).json()
```

### Full Workflow
1. Reverse-engineer competitor ad with this skill
2. Extract the template (format, hook, script, pacing)
3. Adapt template for your product
4. Generate via [video-ad-generator](https://github.com/Creatify-AI/video-ad-generator) (URL to Video, Ad Clone)
5. Test avatar versions via [ai-avatar-video](https://github.com/Creatify-AI/ai-avatar-video)
6. Evaluate results via [ad-creative-evaluator](https://github.com/Creatify-AI/ad-creative-evaluator)

---

## See Also

- [video-ad-generator](https://github.com/Creatify-AI/video-ad-generator) — Product URL → video ad pipeline
- [ai-avatar-video](https://github.com/Creatify-AI/ai-avatar-video) — AI talking-head videos with 1,500+ personas
- [ai-ad-prompt-guide](https://github.com/Creatify-AI/ai-ad-prompt-guide) — Battle-tested prompting for AI ad creative
- [ad-creative-evaluator](https://github.com/Creatify-AI/ad-creative-evaluator) — Score any video ad with AI expert panel
- [static-ad-concept-generator](https://github.com/Creatify-AI/static-ad-concept-generator) — 320+ proven ad concept templates
