"""Music bed: loops the MusicGen clips under each scene, crossfades at the seams and
ducks under the voice (lifted in the pauses between lines and topics).

Usage: python tools/music.py   (reads assets/data/timing.json, writes assets/music/bed.mp3)

The clips in assets/music/clips/ were generated locally with facebook/musicgen-small
(prompts in assets/music/README.md).
"""
import json
import os
import subprocess

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SR = 44100
SECTIONS = {
    "intro": "main",
    "sky": "main2",
    "octopus": "ocean",
    "banana": "main3",
    "honey": "main",
    "taller": "main2",
    "venus": "space",
    "outro": "finale",
}
XFADE_LOOP = 2.0  # seconds of overlap when a clip loops
XFADE_SEAM = 1.6  # seconds of overlap between scenes
DUCK_DB = -7.5  # under speech
LIFT_DB = -1.5  # in pauses of 1.2 s or more
REF_RMS_DB = -23.0


def load(name):
    raw = subprocess.run(
        ["ffmpeg", "-loglevel", "error", "-i", os.path.join(ROOT, "assets", "music", "clips", name + ".mp3"),
         "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"],
        check=True, capture_output=True,
    ).stdout
    a = np.frombuffer(raw, dtype=np.float32).copy()
    a = a[int(0.8 * SR): len(a) - int(0.3 * SR)]  # skip the clip's soft start and tail
    rms = np.sqrt(np.mean(a**2))
    return a * (10 ** (REF_RMS_DB / 20) / rms)


def looped(clip, seconds, offset=0.0):
    """clip repeated with equal-power crossfades until it covers `seconds`."""
    n = int(seconds * SR)
    x = int(XFADE_LOOP * SR)
    start = int(offset * SR) % (len(clip) - x)
    out = clip[start:].copy()
    fade = np.linspace(0, np.pi / 2, x)
    while len(out) < n:
        out[-x:] = out[-x:] * np.cos(fade) + clip[:x] * np.sin(fade)
        out = np.concatenate([out, clip[x:]])
    return out[:n]


def main():
    timing = json.load(open(os.path.join(ROOT, "assets", "data", "timing.json")))
    total = sum(v["duration"] for v in timing.values())
    n = int(total * SR) + SR
    bed = np.zeros(n, dtype=np.float32)
    clips = {name: load(name) for name in set(SECTIONS.values())}
    used = {}
    for scene, v in timing.items():
        name = SECTIONS[scene]
        a = max(0.0, v["start"] - XFADE_SEAM / 2)
        b = min(total, v["start"] + v["duration"] + XFADE_SEAM / 2)
        seg = looped(clips[name], b - a, offset=used.get(name, 0.0))
        used[name] = used.get(name, 0.0) + (b - a)
        x = int(XFADE_SEAM * SR)
        env = np.ones(len(seg))
        if v["start"] > 0:
            env[:x] = np.sin(np.linspace(0, np.pi / 2, x))
        if v["start"] + v["duration"] < total - 0.01:
            env[-x:] = np.cos(np.linspace(0, np.pi / 2, x))
        i = int(a * SR)
        bed[i: i + len(seg)] += (seg * env).astype(np.float32)

    # ducking from the voice lines: down while speaking, up in long pauses
    active = np.zeros(n, dtype=bool)
    for v in timing.values():
        lines = sorted(v["lines"].values(), key=lambda l: l["s"])
        for j, l in enumerate(lines):
            s = v["start"] + l["s"] - 0.15
            e = v["start"] + l["e"] + 0.25
            nxt = v["start"] + lines[j + 1]["s"] if j + 1 < len(lines) else e + 99
            if nxt - e < 1.2:  # short pause: stay down through it
                e = nxt
            active[int(s * SR): int(e * SR)] = True
    target = np.where(active, 10 ** (DUCK_DB / 20), 10 ** (LIFT_DB / 20)).astype(np.float32)
    # smooth: 0.25 s attack (going down), 0.7 s release (coming up), at 100 Hz control rate
    hop = SR // 100
    ctrl = target[::hop]
    sm = np.empty_like(ctrl)
    g = ctrl[0]
    for i, t in enumerate(ctrl):
        k = 1 / (0.25 * 100) if t < g else 1 / (0.7 * 100)
        g += (t - g) * min(1.0, k * 3)
        sm[i] = g
    gain = np.repeat(sm, hop)[:n]
    bed *= gain
    # fade in and out
    fi = int(0.4 * SR)
    bed[:fi] *= np.linspace(0, 1, fi)
    fo = int(3.0 * SR)
    end = int(total * SR)
    bed[end - fo: end] *= np.linspace(1, 0, fo)
    bed[end:] = 0
    peak = np.max(np.abs(bed))
    if peak > 0.89:
        bed *= 0.89 / peak
    out = os.path.join(ROOT, "assets", "music", "bed.mp3")
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", "-",
         "-t", f"{total:.3f}", "-b:a", "160k", out],
        input=bed[:end].astype(np.float32).tobytes(), check=True,
    )
    print(f"bed.mp3 {total:.2f}s, peak {20 * np.log10(peak + 1e-9):.1f} dBFS")


if __name__ == "__main__":
    main()
