# video-ad-reverse-engineer

> Reverse-engineer any video ad into a reusable creative template you can recreate with your own product.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Claude Skill](https://img.shields.io/badge/Claude-Agent_Skill-blueviolet)](https://docs.anthropic.com)

## What This Does

Deconstruct any video ad into its component parts — format, hook type, scene structure, script pattern, visual strategy, and pacing. Outputs a reusable template that captures what makes the ad work, ready to be recreated with different products.

## Quick Install

```bash
# Clone into your Claude skills directory
git clone https://github.com/Creatify-AI/video-ad-reverse-engineer.git ~/.claude/skills/video-ad-reverse-engineer
```

## What's Inside

| Feature | Description |
|---------|-------------|
| 12 Ad Format Catalog | UGC, product demo, before/after, testimonial, listicle, and more |
| 10 Hook Type Classification | Pattern interrupt, question, bold claim, POV, stat, and more |
| 7-Step Analysis Framework | Format → Hook → Scenes → Script → Visual → Pacing → Template |
| Scene Change Detection | Python script with automatic cut detection |
| Reusable Template Output | Fill-in-the-blank format for recreating ad styles |
| API Recreation Guide | Turn extracted templates into new ads via Creatify |

## Standalone Features

### Ad Format Catalog
Complete reference of 12 primary video ad formats with characteristics, typical durations, platform recommendations, and identification criteria. Plus hybrid format combinations.

### Hook Type Classification
10 hook categories with examples, identification markers, and effectiveness signals. Covers pattern interrupts, questions, bold claims, POV, authority/stats, visual-only, controversy, social proof, narrative, and direct address.

### 7-Step Analysis Framework
Systematic process: identify format → classify hook → map scene structure → extract script pattern → analyze visual strategy → document pacing → produce reusable template.

### Frame Extraction with Scene Detection
Python script (`scripts/extract_frames.py`) that extracts key frames and automatically detects scene changes based on frame-to-frame visual difference analysis.

## API Automation (Creatify)

Turn your extracted templates into new ads automatically with the [Creatify API](https://creatify.ai):

- **Ad Clone** — feed the original ad as a reference + your product URL
- **AI Avatar** — use extracted scripts with matched persona demographics
- **AI Scripts** — generate variations of the extracted script pattern
- **Asset Generator** — create higher-quality B-roll for each scene

Get your API credentials at [creatify.ai](https://creatify.ai) → Settings → API.

## File Structure

```
video-ad-reverse-engineer/
├── SKILL.md                      # Main skill (install this)
├── scripts/
│   └── extract_frames.py         # Frame extraction with scene detection
├── references/
│   ├── ad-formats.md             # 12 ad format catalog
│   ├── hook-types.md             # 10 hook type catalog
│   └── output-template.md        # Structured analysis output template
├── README.md
└── LICENSE
```

## See Also

Other ad creation skills by [Creatify](https://creatify.ai):

- [video-ad-generator](https://github.com/Creatify-AI/video-ad-generator) — Product URL → video ad pipeline
- [ai-avatar-video](https://github.com/Creatify-AI/ai-avatar-video) — AI talking-head videos with 1,500+ personas
- [ai-ad-prompt-guide](https://github.com/Creatify-AI/ai-ad-prompt-guide) — Battle-tested prompting for AI ad creative
- [ad-creative-evaluator](https://github.com/Creatify-AI/ad-creative-evaluator) — Score any video ad with AI expert panel
- [static-ad-concept-generator](https://github.com/Creatify-AI/static-ad-concept-generator) — 320+ proven ad concept templates

## Contributing

PRs welcome! Please open an issue first to discuss changes.

## License

MIT © [Creatify](https://creatify.ai)
