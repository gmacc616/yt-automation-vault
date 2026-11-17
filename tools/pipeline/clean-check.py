"""Find cursing (DraftKings brief: NO cursing in the clip, caption or on-screen text).

Usage:
  py tools/pipeline/clean-check.py <transcript.json> [--range A-B ...] [--text "headline or caption" ...]
Prints every hit with its timestamp. Exit code 1 if anything is found (in the ranges / texts given, or the
whole transcript when no --range is given). Whisper sometimes mishears; treat hits as "listen and confirm",
and treat a clean result as "no curse transcribed", not proof of silence: always spot-check by ear.
"""
import json, re, sys

STRONG = r"[a-z][\*#]{2,}\w*|f+u+c+k\w*|f[\*#]+k\w*|motherf\w*|sh[i1]t\w*|bullsh\w*|b[i1]tch\w*|a+ss+hole\w*|dick\w*|cock\w*|puss(y|ies)|" \
         r"bastard\w*|cunt\w*|whore\w*|slut\w*|n[i1]gg\w*|fag\w*|retard\w*|piss\w*|dumbass\w*|jackass\w*|wtf|stfu|lmfao|af"
MILD = r"damn\w*|goddamn\w*|hell|crap\w*|ass|asses|screw(ed)? (you|him|her|them)|freakin\w*|frickin\w*"
RX_STRONG, RX_MILD = re.compile(rf"^({STRONG})$", re.I), re.compile(rf"^({MILD})$", re.I)

args = sys.argv[1:]
words = json.load(open(args[0], encoding="utf-8"))
ranges = [tuple(float(x) for x in args[i + 1].split("-")) for i, v in enumerate(args) if v == "--range"]
texts = [args[i + 1] for i, v in enumerate(args) if v == "--text"]

def norm(t): return re.sub(r"[^a-z0-9*#']", "", t.lower()).strip("'")
hits = []
for w in words:
    if ranges and not any(a - 0.05 <= w["start"] <= b + 0.05 for a, b in ranges): continue
    n = norm(w["text"])
    if RX_STRONG.match(n): hits.append(("CURSE", w["start"], w["text"]))
    elif RX_MILD.match(n): hits.append(("MILD", w["start"], w["text"]))
for t in texts:
    for tok in re.split(r"\s+", t):
        n = norm(tok)
        if RX_STRONG.match(n) or RX_MILD.match(n): hits.append(("TEXT", -1, tok))
for kind, t, w in hits:
    print(f"{kind:5s} {'' if t < 0 else f'{int(t // 60)}:{t % 60:05.2f}'}  {w}")
print(f"{len(hits)} hit(s)")
sys.exit(1 if hits else 0)
