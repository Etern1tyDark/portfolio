// Parser for the 1K hard-mode charts in src/data/charts/*.txt: a subset of
// maimai's simai notation (format notes in scripts/simai-to-1k.py).
//
//   &first=<ms>   song time of the first step     (bpm)  tempo
//   {n}           each comma = 1/n of a 4-beat bar  x      note, empty = rest
//   E             end of chart                      X      big note (both keys)
//   || ... comment

export interface ParsedChart {
  notes: number[];
  // big[i]: notes[i] is a big note, hit with both keys.
  big: boolean[];
  // Song time of the E marker (or the last step when there is none).
  endMs: number;
}

const CONTROL = /^\s*(\([^)]*\)|\{[^}]*\})/;

export function parseSimai(text: string, minGapMs = 0): ParsedChart {
  const body = text.replace(/\|\|[^\n]*/g, "");
  const first = Number(body.match(/^\s*&first=(-?[\d.]+)/m)?.[1] ?? 0);
  const chart = body.replace(/^\s*&[^\n]*$/gm, "");

  let bpm: number | null = null;
  let div = 4;
  let t = first;
  let endMs: number | null = null;
  const notes: number[] = [];
  const big: boolean[] = [];

  for (let piece of chart.split(",")) {
    let m: RegExpMatchArray | null;
    while ((m = piece.match(CONTROL))) {
      const token = m[1];
      if (token.startsWith("(")) bpm = Number(token.slice(1, -1));
      else if (!token.startsWith("{#")) div = Number(token.slice(1, -1));
      piece = piece.slice(m[0].length);
    }
    const note = piece.trim();
    if (note === "E") {
      endMs = t;
      break;
    }
    if (bpm === null) throw new Error("simai chart has no (bpm) before its first step");
    // Notes closer than minGapMs can't be told apart on one lane: keep the first.
    if (note && (!notes.length || t - notes[notes.length - 1] >= minGapMs)) {
      notes.push(Math.round(t * 10) / 10);
      big.push(note === "X");
    }
    t += 240000 / bpm / div;
  }

  return { notes, big, endMs: endMs ?? t };
}
