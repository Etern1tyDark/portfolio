#!/usr/bin/env python3
"""Convert an osu! beatmap (.osu, any key count) into a 1K hard-mode chart.

    python3 scripts/osu-to-chart.py "path/to/map [Diff].osu" src/data/charts/<song>.txt \
        [--min-gap-beats 0.25] [--accents]

Writes the same 1K simai format as scripts/simai-to-1k.py (see its docstring),
one bar per line with the smallest divisor that fits each beat, ready to edit.

Notes in every column are merged into one lane (chords become a single note),
then thinned so no two notes are closer than --min-gap-beats. When thinning,
accents win: chords and notes on the beat are kept before off-beat ones, so
the chart still follows the music. The timing points the site's music.json
needs are printed at the end.
"""

import argparse
import json
import re
import sys
from pathlib import Path

CHORD_MS = 5  # notes this close together count as one chord


def section(text: str, name: str) -> list[str]:
    match = re.search(rf"^\[{name}\]\s*$(.*?)(?=^\[|\Z)", text, re.M | re.S)
    if not match:
        sys.exit(f"[{name}] section not found")
    return [line.strip() for line in match.group(1).splitlines() if line.strip() and not line.startswith("//")]


def field(text: str, key: str) -> str:
    match = re.search(rf"^{key}\s*:\s*(.*)$", text, re.M)
    return match.group(1).strip() if match else ""


BIG_CHORD = 3  # chord size that becomes a big X note
# Divisors tried per beat, simplest first: {4} = 1 slot per beat ... {48}.
DIVISORS = (4, 8, 16, 12, 24, 48)


def to_simai(notes: list[int], timing: list[dict], big: set[int] = frozenset()) -> str:
    """Write note times as 1K simai: (bpm) per section, {n} per beat as needed."""
    lines = [f"&first={timing[0]['timeMs']}"]
    current_div = None
    remaining = sorted(notes)
    for i, point in enumerate(timing):
        beat_ms = point["beatMs"]
        end = timing[i + 1]["timeMs"] if i + 1 < len(timing) else (remaining[-1] + beat_ms if remaining else point["timeMs"])
        beats = max(1, round((end - point["timeMs"]) / beat_ms))
        bar: list[str] = [f"({round(60000 / beat_ms, 3):g})"]
        for b in range(beats):
            start = point["timeMs"] + b * beat_ms
            inside = [n for n in remaining if start - beat_ms / 96 <= n < start + beat_ms - beat_ms / 96]
            fracs = [(n - start) / beat_ms for n in inside]
            for div in DIVISORS:
                slots = div // 4
                if all(abs(f * slots - round(f * slots)) < 0.12 for f in fracs):
                    break
            cells = [""] * slots
            for n, f in zip(inside, fracs):
                cells[min(slots - 1, max(0, round(f * slots)))] = "X" if n in big else "x"
            prefix = "" if div == current_div else f"{{{div}}}"
            current_div = div
            bar.append(prefix + ",".join(cells) + ",")
            remaining = [n for n in remaining if n not in inside]
            if (b + 1) % point["meter"] == 0:
                lines.append("".join(bar))
                bar = []
        if bar:
            lines.append("".join(bar))
    lines.append("E")
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("osu", type=Path)
    parser.add_argument("out", type=Path)
    parser.add_argument("--min-gap-beats", type=float, default=0.5)
    parser.add_argument(
        "--accents",
        action="store_true",
        help="only keep chords and on-beat notes (for maps that are mostly streams)",
    )
    args = parser.parse_args()

    text = args.osu.read_text(encoding="utf-8-sig")

    # Uninherited timing points: time,beatLength,meter,sampleSet,sampleIndex,volume,uninherited,effects
    timing = []
    for line in section(text, "TimingPoints"):
        parts = line.split(",")
        if len(parts) >= 7 and parts[6] == "1":
            timing.append({"timeMs": round(float(parts[0])), "beatMs": float(parts[1]), "meter": int(parts[2])})
    timing.sort(key=lambda t: t["timeMs"])
    if not timing:
        sys.exit("no uninherited timing points")

    def timing_at(t: float) -> dict:
        current = timing[0]
        for point in timing:
            if point["timeMs"] <= t:
                current = point
        return current

    # HitObjects: x,y,time,type,... (holds just use their head)
    times = sorted(int(line.split(",")[2]) for line in section(text, "HitObjects"))
    chords: list[list[int]] = []
    for t in times:
        if chords and t - chords[-1][0] <= CHORD_MS:
            chords[-1][1] += 1
        else:
            chords.append([t, 1])

    def priority(chord: list[int]) -> tuple:
        t, size = chord
        point = timing_at(t)
        beat = (t - point["timeMs"]) / point["beatMs"]
        on_beat = abs(beat - round(beat)) < 0.06
        on_half = abs(beat * 2 - round(beat * 2)) < 0.12
        downbeat = on_beat and round(beat) % point["meter"] == 0
        return (size, downbeat, on_beat, on_half, -t)

    candidates = chords
    if args.accents:
        candidates = [c for c in chords if c[1] >= 2 or priority(c)[2]]

    kept: list[int] = []
    big: set[int] = set()
    for t, size in sorted(candidates, key=priority, reverse=True):
        gap = timing_at(t)["beatMs"] * args.min_gap_beats - 2
        if all(abs(t - k) >= gap for k in kept):
            kept.append(t)
            # Chords across 3+ columns are the map's big accents: both keys.
            if size >= BIG_CHORD:
                big.add(t)
    kept.sort()

    source = (
        f"osu!mania [{field(text, 'Version')}] by {field(text, 'Creator')}, "
        f"{field(text, 'CircleSize')}K merged to 1K{', accents only' if args.accents else ''}, "
        f"min gap {args.min_gap_beats} beat"
    )
    header = f"|| {field(text, 'Artist')} - {field(text, 'Title')}, 1K hard chart from {source}.\n"
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(header + to_simai(kept, timing, big) + "\n")

    span = (kept[-1] - kept[0]) / 1000 if len(kept) > 1 else 1
    print(f"{args.out}: {len(times)} objects -> {len(chords)} chords -> {len(kept)} notes ({len(kept) / span:.1f}/s)")
    points = [
        {"timeMs": p["timeMs"], "bpm": round(60000 / p["beatMs"], 3), "meter": p["meter"]} for p in timing
    ]
    print("timingPoints:", json.dumps(points))


if __name__ == "__main__":
    main()
