import type { Chord, Finger } from "svguitar";
import { parseFretCode } from "./parse";

/** Encode per-string absolute frets (low -> high; -1 = muted) into a code:
 *  compact "x02210" when every fret is 0-9, else dash-separated "x-0-2-2-1-0". */
export function encodeFrets(frets: number[]): string {
  const cell = (f: number) => (f < 0 ? "x" : String(f));
  const compact = frets.every((f) => f >= -1 && f <= 9);
  return frets.map(cell).join(compact ? "" : "-");
}

/** Absolute fret for an svguitar string (1 = highest pitch). svguitar finger
 *  frets are relative to `position`, so absolute = position - 1 + fret. */
function absFretForString(chord: Chord, s: number): number {
  const finger = chord.fingers.find((f) => f[0] === s);
  let rel: number | "x" = 0;
  if (finger) {
    const v = finger[1];
    if (v === "x") rel = "x";
    else if (typeof v === "number") rel = v;
  }
  if (rel !== "x") {
    const barre = (chord.barres ?? []).find((b) => {
      const lo = Math.min(b.fromString, b.toString);
      const hi = Math.max(b.fromString, b.toString);
      return s >= lo && s <= hi;
    });
    if (barre && barre.fret > rel) rel = barre.fret;
  }
  if (rel === "x") return -1;
  if (rel === 0) return 0;
  const pos = chord.position && chord.position > 1 ? chord.position : 1;
  return pos - 1 + rel;
}

/** Convert an svguitar chord into a low->high absolute fret-code. */
export function chordToFretCode(chord: Chord, stringCount: number): string {
  const frets: number[] = [];
  for (let s = stringCount; s >= 1; s--) frets.push(absFretForString(chord, s));
  return encodeFrets(frets);
}

/** Build an svguitar chord from a fret-code (absolute frets, low -> high). */
export function fretCodeToChord(
  code: string,
  stringCount: number,
  title?: string,
): Chord | null {
  const frets = parseFretCode(code.trim(), stringCount);
  if (!frets) return null;
  const nonzero = frets.filter((f) => f > 0);
  const position = nonzero.length && Math.max(...nonzero) > 4 ? Math.min(...nonzero) : 1;
  const fingers: Finger[] = frets.map((abs, i) => {
    const s = stringCount - i; // code is low -> high
    if (abs === -1) return [s, "x"];
    if (abs === 0) return [s, 0];
    return [s, position > 1 ? abs - position + 1 : abs];
  });
  return { fingers, barres: [], position, ...(title ? { title } : {}) };
}
