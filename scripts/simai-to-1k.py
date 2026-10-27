#!/usr/bin/env python3
"""Turn a maimai simai chart into a 1K hard-mode chart for the site.

    python3 scripts/simai-to-1k.py <track-id> path/to/simai.txt

Every note group (taps, holds, slides, breaks, touch sensors A1-E8) becomes a
single `x`, and simultaneous notes (`1/5`, two-button taps like `45`) become a
big `X` that wants both keys; the (bpm) and {divisor} structure is kept exactly, so the
result is still simai and can be hand-edited. The chart's start in our audio
file is found by matching its notes against the song's onsets and written as
`&first=<ms>`. Output: src/data/charts/<chart>.txt (chart name from music.json).

1K chart format (a subset of simai):
  &first=<ms>       song time of the first comma step (after offsetMs)
  (bpm)             tempo from here on
  {n}               each comma is 1/n of a 4-beat bar: {4} beats, {8} 8ths,
                    {12} 12ths, {16} 16ths ...
  x                 a note; empty = rest
  X                 a big note: hit with both keys (F + J) together
  E                 end of chart
  || comment        ignored to end of line
"""

import json
import re
import subprocess
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
CONTROL = re.compile(r"\s*(\([^)]*\)|\{[^}]*\})")
SR = 22050
HOP = 110  # 5 ms
WINDOW = 1024


def strip_comments(text: str) -> str:
    return re.sub(r"\|\|[^\n]*", "", text)


def is_big(note: str) -> bool:
    """maimai 'each': several notes at once, as `a/b` or a run of button digits."""
    return "/" in note or bool(re.fullmatch(r"[1-8]{2,}", note))


def convert(text: str) -> str:
    """Replace every note group with x, keeping controls, rests and layout."""
    body = strip_comments(text)
    out = []
    for piece in body.split(","):
        prefix = ""
        rest = piece
        while (m := CONTROL.match(rest)) :
            prefix += rest[: m.end()]
            rest = rest[m.end() :]
        lead = rest[: len(rest) - len(rest.lstrip())]
        note = rest.strip()
        if note == "E":
            out.append(prefix + lead + "E")
            break
        out.append(prefix + lead + ("X" if note and is_big(note) else "x" if note else ""))
    return ",".join(out)


def note_times(text: str) -> list[float]:
    """Times (ms from the first step) of every note in a simai body."""
    bpm, div, t, times = None, 4, 0.0, []
    for piece in strip_comments(text).split(","):
        rest = piece
        while (m := CONTROL.match(rest)):
            token = m.group(1)
            if token.startswith("("):
                bpm = float(token[1:-1])
            elif not token.startswith("{#"):
                div = float(token[1:-1])
            rest = rest[m.end() :]
        note = rest.strip()
        if note == "E":
            break
        if bpm is None:
            sys.exit("chart has no (bpm) before its first note")
        if note:
            times.append(t)
        t += 240000 / bpm / div
    return times


def onset_envelope(path: Path) -> np.ndarray:
    raw = subprocess.run(
        ["ffmpeg", "-loglevel", "error", "-i", str(path), "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
        check=True,
        capture_output=True,
    ).stdout
    x = np.frombuffer(raw, dtype=np.float32)
    window = np.hanning(WINDOW).astype(np.float32)
    frames = 1 + (len(x) - WINDOW) // HOP
    env = np.zeros(frames, dtype=np.float32)
    prev = None
    for start in range(0, frames, 4096):
        idx = np.arange(WINDOW)[None, :] + HOP * np.arange(start, min(frames, start + 4096))[:, None]
        mag = np.log1p(100 * np.abs(np.fft.rfft(x[idx] * window, axis=1))).astype(np.float32)
        lead = prev if prev is not None else mag[:1]
        env[start : start + len(mag)] = np.maximum(0, np.diff(np.vstack([lead, mag]), axis=0)).sum(1)
        prev = mag[-1:]
    return env, len(x) / SR * 1000


def find_start(env: np.ndarray, times: np.ndarray) -> int:
    """Shift (ms) that best lines the chart's notes up with onsets in the audio."""
    frame_ms = HOP / SR * 1000
    centre_ms = WINDOW / SR * 1000 / 2  # frame i is centred half a window in

    def score(shift: float) -> float:
        idx = np.round((times + shift - centre_ms) / frame_ms).astype(int)
        idx = idx[(idx >= 1) & (idx < len(env) - 1)]
        if len(idx) < len(times) * 0.8:
            return 0.0
        return float(np.maximum(env[idx], np.maximum(env[idx - 1], env[idx + 1])).mean())

    coarse = max(range(-2000, 6001, 5), key=score)
    return max(range(coarse - 10, coarse + 11), key=score)


def main() -> None:
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    track_id, source = sys.argv[1], Path(sys.argv[2])
    music = json.loads((ROOT / "src/data/music.json").read_text())
    track = music["tracks"].get(track_id) or sys.exit(f"unknown track {track_id!r}")

    chart = convert(source.read_text(encoding="utf-8-sig"))
    times = np.array(note_times(chart))
    env, duration = onset_envelope(ROOT / "public" / track["src"].lstrip("/"))
    shift = find_start(env, times)
    # The game adds the track's offsetMs to every note, so store the rest.
    first = shift - track["offsetMs"]

    out_path = ROOT / "src/data/charts" / f"{track['chart']}.txt"
    header = (
        f"|| {track['artist']} - {track['title']}, 1K hard chart converted from simai ({source.name}).\n"
        f"|| Every note is an x; see scripts/simai-to-1k.py for the format.\n"
        f"&first={first}\n"
    )
    out_path.write_text(header + chart.strip() + "\n")

    gaps = np.diff(times)
    print(f"{out_path.relative_to(ROOT)}: {len(times)} notes over {times[-1] / 1000:.0f}s, first={first}ms")
    print(f"  notes closer than 60 ms (merged by the game): {int((gaps < 60).sum())}")
    print(f"  song is {duration / 1000:.1f}s; chart ends at {(times[-1] + shift) / 1000:.1f}s")


if __name__ == "__main__":
    main()
