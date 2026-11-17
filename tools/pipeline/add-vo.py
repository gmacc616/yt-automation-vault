"""Mix a narration line into a clip's audio, ducking the original sound underneath it.

Usage (job folder, before transcribing the clip and building the music bed):
  py ../../tools/pipeline/add-vo.py clipNN --at 4.2 --vo clipNN/vo1.wav [--duck 14] [--gain 0]
Make the narration first with the default narrator (clone_3_voicebox-qwen3), e.g.:
  py ../../.claude/skills/default-voice/qwen_voice.py line "He waited twenty-one years for this shot." -o clipNN/vo1.wav
Rewrites clipNN/tight.mp4 (the original is kept once as clipNN/tight_novo.mp4, video stream copied untouched).
The voice is loudness-matched to the clip's speech, so transcription, captions and the music duck then
include the narration with no extra steps.
"""
import json, os, re, shutil, subprocess, sys

a = sys.argv[1:]
def opt(k, d=None): return a[a.index(k) + 1] if k in a else d
clip, at, vo = a[0], float(opt("--at")), opt("--vo")
duck, gain = float(opt("--duck", 14)), float(opt("--gain", 0))
tight, orig = os.path.join(clip, "tight.mp4"), os.path.join(clip, "tight_novo.mp4")
if not os.path.exists(orig): shutil.copyfile(tight, orig)

def loud(path):
    r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", path, "-af", "ebur128", "-f", "null", "-"], capture_output=True, text=True).stderr
    m = re.findall(r"I:\s+(-?[\d.]+) LUFS", r)
    return float(m[-1]) if m else -20.0
vo_dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", vo], capture_output=True, text=True).stdout)
match = loud(orig) - loud(vo) + gain     # bring the voice to the clip's speech level
end = at + vo_dur
f = (f"[0:a]volume='if(between(t,{at - 0.15:.3f},{end + 0.15:.3f}),{10 ** (-duck / 20):.4f},1)':eval=frame[bed];"
     f"[1:a]aformat=sample_rates=48000:channel_layouts=stereo,volume={match:.2f}dB,adelay={int(at * 1000)}:all=1,apad[v];"
     f"[bed][v]amix=inputs=2:normalize=0:duration=first[a]")
r = subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", orig, "-i", vo, "-filter_complex", f, "-map", "0:v", "-map", "[a]",
                    "-c:v", "copy", "-c:a", "aac", "-b:a", "256k", "-ar", "48000", tight], capture_output=True, text=True)
if r.returncode: sys.exit(r.stderr[-800:])
print(f"{clip}: narration {vo_dur:.2f}s at {at:.2f}-{end:.2f}s (voice {match:+.1f} dB, original ducked {duck:.0f} dB) -> {tight}")
