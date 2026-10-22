"""Voice pipeline: script.json -> per-scene voice tracks, timing and lip-sync data.

Usage (from the project root):
  python tools/voice.py                # synthesize every line with local Kokoro, then analyse
  python tools/voice.py --analyse-only # reuse the cached line takes in .voice-cache/

Writes:
  assets/voice/<scene>.mp3      one voice track per scene (lead silence + lines + pauses + tail)
  assets/data/timing.json       scene durations and line start/end times (scene-local seconds)
  assets/data/timing.js         the same, as window.SPECS_TIMING for the scenes
  assets/data/lipsync.js        30 fps mouth openness + shape per scene, as window.SPECS_LIPSYNC

Needs: pip install kokoro-onnx soundfile numpy ; ffmpeg on PATH.
Model files are the ones `npx hyperframes tts` downloads to ~/.cache/hyperframes/tts/.
"""

import json
import os
import subprocess
import sys

import numpy as np
import soundfile as sf

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, ".voice-cache")
SR = 24000
FPS = 30
MODEL = os.path.expanduser("~/.cache/hyperframes/tts/models/kokoro-v1.0.onnx")
VOICES = os.path.expanduser("~/.cache/hyperframes/tts/voices/voices-v1.0.bin")


def trim(samples, thresh=0.006, pad=0.03):
    """Cut leading/trailing near-silence, keeping a short pad."""
    loud = np.where(np.abs(samples) > thresh)[0]
    if len(loud) == 0:
        return samples
    a = max(0, loud[0] - int(pad * SR))
    b = min(len(samples), loud[-1] + int(pad * SR))
    return samples[a:b]


def synth_all(script):
    from kokoro_onnx import Kokoro

    kokoro = Kokoro(MODEL, VOICES)
    os.makedirs(CACHE, exist_ok=True)
    for scene in script["scenes"]:
        for line in scene["lines"]:
            path = os.path.join(CACHE, f"{scene['id']}.{line['k']}.wav")
            text = line.get("say", line["t"])
            stamp = path + ".txt"
            key = f"{script['voice']}|{line.get('speed', script['speed'])}|{text}"
            if os.path.exists(path) and os.path.exists(stamp) and open(stamp).read() == key:
                continue
            samples, sr = kokoro.create(
                text, voice=script["voice"], speed=line.get("speed", script["speed"]), lang="en-us"
            )
            assert sr == SR, sr
            sf.write(path, trim(np.asarray(samples, dtype=np.float32)), SR)
            open(stamp, "w").write(key)
            print("synth", scene["id"], line["k"], flush=True)


def envelope(track):
    """Per-frame mouth openness (0-9) and shape (n neutral, w wide, o round)."""
    hop = SR // FPS
    frames = len(track) // hop + 1
    padded = np.pad(track, (0, frames * hop - len(track)))
    win = padded.reshape(frames, hop)
    rms = np.sqrt(np.mean(win**2, axis=1))
    # spectral centroid per frame for a rough vowel shape
    spec = np.abs(np.fft.rfft(win * np.hanning(hop), axis=1))
    freqs = np.fft.rfftfreq(hop, 1 / SR)
    cent = (spec * freqs).sum(axis=1) / (spec.sum(axis=1) + 1e-9)
    voiced = rms[rms > 0.01]
    ref = np.percentile(voiced, 92) if len(voiced) else 1.0
    level = np.clip(rms / ref, 0, 1)
    # light smoothing so the jaw does not chatter: attack fast, release a bit slower
    out = np.zeros_like(level)
    for i, v in enumerate(level):
        prev = out[i - 1] if i else 0
        out[i] = v if v > prev else prev * 0.55 + v * 0.45
    out[out < 0.12] = 0
    opens = "".join(str(int(round(v * 9))) for v in out)
    shapes = []
    for v, c in zip(out, cent):
        if v == 0:
            shapes.append("n")
        elif c > 2600:
            shapes.append("w")
        elif c < 1200:
            shapes.append("o")
        else:
            shapes.append("n")
    return opens, "".join(shapes)


def analyse(script):
    timing = {}
    lipsync = {}
    os.makedirs(os.path.join(ROOT, "assets", "voice"), exist_ok=True)
    os.makedirs(os.path.join(ROOT, "assets", "data"), exist_ok=True)
    film_t = 0.0
    for scene in script["scenes"]:
        parts = [np.zeros(int(scene["lead"] * SR), dtype=np.float32)]
        t = scene["lead"]
        lines = {}
        for line in scene["lines"]:
            take, sr = sf.read(os.path.join(CACHE, f"{scene['id']}.{line['k']}.wav"), dtype="float32")
            dur = len(take) / SR
            lines[line["k"]] = {"s": round(t, 3), "e": round(t + dur, 3), "text": line["t"]}
            parts.append(take)
            pause = line.get("p", script["defaultPause"])
            parts.append(np.zeros(int(pause * SR), dtype=np.float32))
            t += dur + pause
        parts.append(np.zeros(int(scene["tail"] * SR), dtype=np.float32))
        track = np.concatenate(parts)
        duration = round(len(track) / SR, 3)
        wav = os.path.join(CACHE, f"{scene['id']}.track.wav")
        sf.write(wav, track, SR)
        mp3 = os.path.join(ROOT, "assets", "voice", f"{scene['id']}.mp3")
        subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error", "-i", wav, "-af", "loudnorm=I=-17:TP=-1.5:LRA=11",
             "-ar", "44100", "-ac", "1", "-b:a", "128k", mp3],
            check=True,
        )
        opens, shapes = envelope(track)
        timing[scene["id"]] = {"start": round(film_t, 3), "duration": duration, "lines": lines}
        lipsync[scene["id"]] = {"fps": FPS, "open": opens, "shape": shapes}
        print(f"{scene['id']:8s} start {film_t:7.2f}  dur {duration:6.2f}")
        film_t += duration
    print(f"total    {film_t:.2f}s")
    timing_json = json.dumps(timing, indent=1)
    open(os.path.join(ROOT, "assets", "data", "timing.json"), "w").write(timing_json + "\n")
    open(os.path.join(ROOT, "assets", "data", "timing.js"), "w").write(
        "// Generated by tools/voice.py: scene-local line times in seconds.\n"
        f"window.SPECS_TIMING = {timing_json};\n"
    )
    open(os.path.join(ROOT, "assets", "data", "lipsync.js"), "w").write(
        "// Generated by tools/voice.py: per-frame mouth openness (0-9) and shape (n/w/o) at 30 fps.\n"
        f"window.SPECS_LIPSYNC = {json.dumps(lipsync)};\n"
    )


if __name__ == "__main__":
    script = json.load(open(os.path.join(ROOT, "script", "script.json")))
    if "--analyse-only" not in sys.argv:
        synth_all(script)
    analyse(script)
