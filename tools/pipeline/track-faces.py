"""Automatic 9:16 framing: find shots and the speaker's face in each, and propose reframe.json shots.

Usage (from the job folder, after the clip's tight.mp4 exists):
  py ../../tools/pipeline/track-faces.py clip01 [clip02 ...] [--write] [--fps 4] [--debug]
Without --write it only prints the proposal. With --write it updates reframe.json (backup: reframe.json.bak),
keeping any existing "broll" list for that clip.

Per shot it picks one reframe.py mode:
  number      -> 9:16 crop centred on the face (x fraction of the frame)
  {"pan":[a,b]} -> face drifts across the shot: crop eases from a to b
  "fit"       -> no usable face, or two people too far apart for one crop: whole frame letterboxed
Everything runs locally (MediaPipe face detector on the CPU; OpenCV Haar cascade as a fallback).
"""
import json, os, statistics, subprocess, sys
import numpy as np
import cv2
import mediapipe as mp
from mediapipe.tasks import python as mpt
from mediapipe.tasks.python import vision

HERE = os.path.dirname(os.path.abspath(__file__))
MODEL = os.path.join(HERE, "models", "blaze_face_short_range.tflite")
args = [a for a in sys.argv[1:] if not a.startswith("--")]
WRITE, DEBUG = "--write" in sys.argv, "--debug" in sys.argv
FPS = float(sys.argv[sys.argv.index("--fps") + 1]) if "--fps" in sys.argv else 4.0
if "--fps" in sys.argv: args.remove(sys.argv[sys.argv.index("--fps") + 1])

MIN_SHOT = 0.6        # s; shorter "shots" are merged into the previous one (flashes, dissolves)
CUT_THRESH = 0.45     # histogram distance that counts as a hard cut
FACE_MIN_SHARE = 0.4  # a shot needs a face in >= 40% of its samples to be face-framed

detector = vision.FaceDetector.create_from_options(vision.FaceDetectorOptions(
    base_options=mpt.BaseOptions(model_asset_path=MODEL), min_detection_confidence=0.5))
# Optional Haar fallback: OpenCV 5 no longer ships the cascade files, so it is skipped when missing.
_hp = os.path.join(getattr(getattr(cv2, "data", None), "haarcascades", ""), "haarcascade_frontalface_default.xml")
haar = cv2.CascadeClassifier(_hp) if os.path.exists(_hp) else None


def faces_in(frame):
    """Faces as (cx, cy, w, h, score) in frame pixels. The short-range model wants faces that fill a decent part
    of its input, so a wide frame is also scanned as two overlapping squares to catch small podcast faces."""
    H, W = frame.shape[:2]
    tiles = [(0, 0, W, H)]
    if W > H * 1.2:
        tiles += [(0, 0, H, H), (W - H, 0, H, H), ((W - H) // 2, 0, H, H)]
    found = []
    for x0, y0, tw, th in tiles:
        rgb = cv2.cvtColor(frame[y0:y0 + th, x0:x0 + tw], cv2.COLOR_BGR2RGB)
        res = detector.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=np.ascontiguousarray(rgb)))
        for d in res.detections:
            b = d.bounding_box
            found.append((x0 + b.origin_x + b.width / 2, y0 + b.origin_y + b.height / 2, b.width, b.height, d.categories[0].score))
    if not found and haar is not None:  # fallback for profiles / low light the BlazeFace model misses
        g = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        for (x, y, w, h) in haar.detectMultiScale(g, 1.1, 6, minSize=(max(24, H // 20),) * 2):
            found.append((x + w / 2, y + h / 2, w, h, 0.4))
    # Merge duplicates found by overlapping tiles.
    merged = []
    for f in sorted(found, key=lambda f: -f[4]):
        if all(abs(f[0] - m[0]) > m[2] * 0.5 or abs(f[1] - m[1]) > m[3] * 0.5 for m in merged):
            merged.append(f)
    return merged


def analyse(path):
    cap = cv2.VideoCapture(path)
    src_fps = cap.get(cv2.CAP_PROP_FPS) or 30
    n = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    W, H = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)), int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    dur = n / src_fps
    scale = 960 / W if W > 960 else 1.0
    step = max(1, round(src_fps / FPS))
    samples, prev_hist, cuts = [], None, [0.0]
    for i in range(0, n, step):
        cap.set(cv2.CAP_PROP_POS_FRAMES, i)
        ok, fr = cap.read()
        if not ok: break
        t = i / src_fps
        small = cv2.resize(fr, (int(W * scale), int(H * scale))) if scale != 1 else fr
        hist = cv2.calcHist([cv2.cvtColor(small, cv2.COLOR_BGR2HSV)], [0, 1], None, [32, 32], [0, 180, 0, 256])
        cv2.normalize(hist, hist)
        if prev_hist is not None and cv2.compareHist(prev_hist, hist, cv2.HISTCMP_BHATTACHARYYA) > CUT_THRESH:
            # Refine the cut to the exact frame between the two samples.
            lo, hi = i - step, i
            cap.set(cv2.CAP_PROP_POS_FRAMES, lo)
            last = None
            for j in range(lo, hi + 1):
                ok2, f2 = cap.read()
                if not ok2: break
                h2 = cv2.calcHist([cv2.cvtColor(cv2.resize(f2, (small.shape[1], small.shape[0])), cv2.COLOR_BGR2HSV)], [0, 1], None, [32, 32], [0, 180, 0, 256])
                cv2.normalize(h2, h2)
                if last is not None and cv2.compareHist(last, h2, cv2.HISTCMP_BHATTACHARYYA) > CUT_THRESH:
                    t = j / src_fps; break
                last = h2
            if t - cuts[-1] >= MIN_SHOT: cuts.append(round(t, 3))
        prev_hist = hist
        faces = [(cx / scale / W, cy / scale / H, w / scale / W, h / scale / H, s) for cx, cy, w, h, s in faces_in(small)]
        samples.append((t, faces))
    cap.release()
    return W, H, dur, cuts + [round(dur, 3)], samples


def plan_shot(a, b, samples, W, H):
    crop_w = (H * 9 / 16) / W  # crop width as a fraction of the frame
    pts = [(t, fs) for t, fs in samples if a <= t < b]
    with_face = [(t, fs) for t, fs in pts if fs]
    if not pts or len(with_face) < FACE_MIN_SHARE * len(pts):
        return "fit", f"face in {len(with_face)}/{len(pts)} samples"
    # Main subject = the biggest face, kept continuous: prefer faces near the previous pick.
    track, prev = [], None
    for t, fs in with_face:
        if prev is None: f = max(fs, key=lambda f: f[2] * f[3] * f[4])
        else: f = min(fs, key=lambda f: abs(f[0] - prev) - f[2] * f[3] * 2)
        track.append((t, f[0])); prev = f[0]
    # Two big faces further apart than one crop can hold -> show the whole frame (or flag for a split layout).
    multi = [fs for _, fs in with_face if len(fs) >= 2]
    if len(multi) > 0.6 * len(with_face):
        spans = []
        for fs in multi:
            big = sorted(fs, key=lambda f: -f[2] * f[3])[:2]
            if min(big[0][2] * big[0][3], big[1][2] * big[1][3]) > 0.35 * max(big[0][2] * big[0][3], big[1][2] * big[1][3]):
                spans.append(abs(big[0][0] - big[1][0]))
        if spans and statistics.median(spans) > crop_w * 0.8:
            return "fit", f"2 people {statistics.median(spans):.2f} apart > crop {crop_w:.2f} (split-layout candidate)"
    xs = [x for _, x in track]
    first = statistics.median(xs[:max(1, len(xs) // 3)])
    last = statistics.median(xs[-max(1, len(xs) // 3):])
    if abs(last - first) > crop_w * 0.25 and statistics.pstdev(xs) > crop_w * 0.08:
        return {"pan": [round(first, 3), round(last, 3)]}, f"face moves {first:.2f}->{last:.2f}"
    return round(statistics.median(xs), 3), f"face at x={statistics.median(xs):.2f} ({len(with_face)}/{len(pts)} samples)"


reframe_path = "reframe.json"
cfg = json.load(open(reframe_path, encoding="utf-8")) if os.path.exists(reframe_path) else {}
for name in args:
    src = os.path.join(name, "tight.mp4")
    if not os.path.exists(src): sys.exit(f"{src} not found")
    W, H, dur, cuts, samples = analyse(src)
    if W / H <= 9 / 16 + 0.01:
        print(f"{name}: source is already vertical ({W}x{H}); use 'fit' for the whole clip")
        if WRITE: cfg[name] = [[0, round(dur, 3), "fit"]]
        continue
    shots, notes = [], []
    for a, b in zip(cuts, cuts[1:]):
        if b - a < 0.05: continue
        mode, why = plan_shot(a, b, samples, W, H)
        # Merge with the previous shot when the framing is effectively the same.
        if shots and shots[-1][2] == mode or (shots and isinstance(mode, float) and isinstance(shots[-1][2], float)
                                              and abs(mode - shots[-1][2]) < 0.03):
            shots[-1][1] = round(b, 3); continue
        shots.append([round(a, 3), round(b, 3), mode]); notes.append(why)
    print(f"{name}: {W}x{H}, {dur:.1f}s, {len(cuts) - 2} cut(s), {len(samples)} samples -> {len(shots)} shot(s)")
    for (a, b, m), why in zip(shots, notes):
        print(f"  {a:7.2f}-{b:7.2f}  {json.dumps(m):24s} {why}")
    if DEBUG:
        for t, fs in samples: print(f"    t={t:6.2f} " + " ".join(f"({f[0]:.2f},{f[1]:.2f} s{f[4]:.2f})" for f in fs))
    if WRITE:
        prev = cfg.get(name)
        cfg[name] = {"shots": shots, "broll": prev["broll"]} if isinstance(prev, dict) and prev.get("broll") else shots
if WRITE:
    if os.path.exists(reframe_path):
        os.replace(reframe_path, reframe_path + ".bak")
    json.dump(cfg, open(reframe_path, "w", encoding="utf-8"), indent=1)
    print(f"wrote {reframe_path}" + (" (previous saved as reframe.json.bak)" if os.path.exists(reframe_path + ".bak") else ""))
