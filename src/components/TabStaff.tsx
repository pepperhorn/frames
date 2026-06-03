// src/components/TabStaff.tsx
import type { ReactElement } from "react";
import { LAYOUT, type PlacedBeat, type TabLayout, type TabSystem } from "@/lib/tab/layout";

interface TabStaffProps {
  layout: TabLayout;
  cursorIndex?: number | null;
  fontFamily?: string;
  color?: string;
  backgroundColor?: string;
  fretFontSize?: number;
  fingerFontSize?: number;
  chordFontSize?: number;
  chordFontFamily?: string;
  className?: string;
}

const TUNING_FONT_SIZE = 11;

export function TabStaff({
  layout,
  cursorIndex = null,
  fontFamily = "Poppins, sans-serif",
  color = "#0a0a0a",
  backgroundColor = "transparent",
  fretFontSize = 13,
  fingerFontSize = 10,
  chordFontSize = 13,
  chordFontFamily,
  className,
}: TabStaffProps) {
  const chordFont = chordFontFamily || fontFamily;
  return (
    <svg
      className={className}
      width={layout.width}
      height={layout.height}
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      xmlns="http://www.w3.org/2000/svg"
      style={{ fontFamily }}
    >
      <rect x={0} y={0} width={layout.width} height={layout.height} fill={backgroundColor} />

      {/* Page header (title / subtitle / feel / key), top-left */}
      {layout.header.map((line, i) => (
        <text
          key={`hdr-${i}`}
          className="tab-header-line"
          x={4}
          y={line.y}
          fontSize={line.size}
          fontFamily={fontFamily}
          fontWeight={line.weight}
          fontStyle={line.italic ? "italic" : "normal"}
          fill={color}
          textAnchor="start"
          dominantBaseline="central"
        >
          {line.text}
        </text>
      ))}

      {layout.systems.map((sys, i) => (
        <SystemView
          key={i}
          sys={sys}
          layout={layout}
          showTimeSig={i === 0}
          stemBaseY={sys.lineYs[layout.stringCount - 1]}
          color={color}
          cursorIndex={cursorIndex}
          fontFamily={fontFamily}
          fretFontSize={fretFontSize}
          fingerFontSize={fingerFontSize}
          chordFontSize={chordFontSize}
          chordFont={chordFont}
        />
      ))}
    </svg>
  );
}

function SystemView({
  sys,
  layout,
  showTimeSig,
  stemBaseY,
  color,
  cursorIndex,
  fontFamily,
  fretFontSize,
  fingerFontSize,
  chordFontSize,
  chordFont,
}: {
  sys: TabSystem;
  layout: TabLayout;
  showTimeSig: boolean;
  stemBaseY: number;
  color: string;
  cursorIndex: number | null;
  fontFamily: string;
  fretFontSize: number;
  fingerFontSize: number;
  chordFontSize: number;
  chordFont: string;
}) {
  const beamY = stemBaseY + LAYOUT.STEM_LEN;
  return (
    <g className="tab-system">
      {/* Staff lines */}
      {sys.lineYs.map((y, i) => (
        <line
          key={`line-${i}`}
          x1={sys.lineX0}
          y1={y}
          x2={sys.lineX1}
          y2={y}
          stroke={color}
          strokeWidth={1}
        />
      ))}

      {/* Tuning letters (clef substitute), to the right of the time signature */}
      {layout.tuning.map((t, i) => (
        <text
          key={`tuning-${i}`}
          x={40}
          y={sys.lineYs[i]}
          fontSize={TUNING_FONT_SIZE}
          fontFamily={fontFamily}
          fontWeight={600}
          fill={color}
          textAnchor="middle"
          dominantBaseline="central"
        >
          {t}
        </text>
      ))}

      {/* Time signature on the first system, far left of the string names */}
      {showTimeSig && (
        <g className="tab-timesig">
          <text x={14} y={(sys.lineYs[0] + sys.lineYs[layout.stringCount - 1]) / 2 - 16}
            fontSize={32} fontWeight={700} fill={color} textAnchor="middle" dominantBaseline="central">
            {layout.timeSig.num}
          </text>
          <text x={14} y={(sys.lineYs[0] + sys.lineYs[layout.stringCount - 1]) / 2 + 16}
            fontSize={32} fontWeight={700} fill={color} textAnchor="middle" dominantBaseline="central">
            {layout.timeSig.den}
          </text>
        </g>
      )}


      {/* Barlines */}
      {sys.barlines.map((bar, i) => (
        <line
          key={`bar-${i}`}
          x1={bar.x}
          y1={sys.lineYs[0]}
          x2={bar.x}
          y2={sys.lineYs[layout.stringCount - 1]}
          stroke={color}
          strokeWidth={bar.final ? 3 : 1.5}
        />
      ))}

      {/* Beats */}
      {sys.beats.map((beat) => (
        <BeatView
          key={beat.globalBeatIndex}
          beat={beat}
          sys={sys}
          layout={layout}
          stemBaseY={stemBaseY}
          color={color}
          fontFamily={fontFamily}
          fretFontSize={fretFontSize}
          highlighted={cursorIndex === beat.globalBeatIndex}
        />
      ))}

      {/* Beams (one horizontal line per multi-note group) */}
      {layout.showStems && drawBeams(sys, beamY, color)}

      {/* Triplet brackets with a "3" */}
      {layout.showStems && drawTriplets(sys, beamY, color, fontFamily)}

      {/* Fretting-hand fingering row beneath the staff */}
      {layout.showFingerings && drawFingerings(sys, beamY, color, fontFamily, fingerFontSize)}

      {/* Chord symbols + mini frames in the row above the staff */}
      {layout.chordRowH > 0 &&
        drawChordRow(sys, layout, color, chordFont, chordFontSize)}
    </g>
  );
}

function drawFingerings(
  sys: TabSystem,
  beamY: number,
  color: string,
  fontFamily: string,
  fingerFontSize: number,
) {
  const out: ReactElement[] = [];
  const rowY = beamY + 22; // clears stems, beams, triplet brackets and technique labels
  const lineStep = fingerFontSize + 1;
  for (const beat of sys.beats) {
    if (beat.isRest) continue;
    const fingered = beat.notes.filter((n) => n.finger);
    if (fingered.length === 0) continue;
    // Stack a chord's fingers top-to-bottom by string (string 1 = top line).
    const ordered = [...fingered].sort((a, b) => a.string - b.string);
    ordered.forEach((n, i) => {
      out.push(
        <text
          key={`fin-${beat.globalBeatIndex}-${i}`}
          x={beat.x}
          y={rowY + i * lineStep}
          fontSize={fingerFontSize}
          fontFamily={fontFamily}
          fill={color}
          textAnchor="middle"
          dominantBaseline="central"
        >
          {n.finger}
        </text>,
      );
    });
  }
  return out;
}

function drawChordRow(
  sys: TabSystem,
  layout: TabLayout,
  color: string,
  font: string,
  fontSize: number,
) {
  const out: ReactElement[] = [];
  const topLineY = sys.lineYs[0];
  const rowTop = topLineY - layout.chordRowH;
  const labelY = topLineY - fontSize / 2 - 5; // just above the staff, consistent row
  for (const beat of sys.beats) {
    const chord = beat.chord;
    if (!chord) continue;
    if (chord.frame) {
      out.push(
        ...drawChordFrame(chord.frame.frets, beat.x, rowTop + 2, layout.stringCount, color),
      );
    }
    if (chord.label) {
      out.push(
        <text
          key={`chord-${beat.globalBeatIndex}`}
          className="tab-chord-label"
          x={beat.x}
          y={labelY}
          fontSize={fontSize}
          fontFamily={font}
          fontWeight={600}
          fill={color}
          textAnchor="middle"
          dominantBaseline="central"
        >
          {chord.label}
        </text>,
      );
    }
  }
  return out;
}

function drawChordFrame(
  frets: number[],
  cx: number,
  top: number,
  stringCount: number,
  color: string,
) {
  const cell = LAYOUT.CHORD_CELL;
  const gridW = (stringCount - 1) * cell;
  const left = cx - gridW / 2;
  const rows = 4;
  const nonzero = frets.filter((f) => f > 0);
  const maxFret = nonzero.length ? Math.max(...nonzero) : 0;
  const baseFret = maxFret > rows ? Math.min(...nonzero) : 1;
  const markerY = top + 3;
  const nutY = top + 9;
  const gridBottom = nutY + rows * cell;
  const out: ReactElement[] = [];

  // string (vertical) lines
  for (let i = 0; i < stringCount; i++) {
    const x = left + i * cell;
    out.push(
      <line key={`cs-${i}`} x1={x} y1={nutY} x2={x} y2={gridBottom} stroke={color} strokeWidth={0.8} />,
    );
  }
  // fret (horizontal) lines; the nut is heavier when the frame starts at fret 1
  for (let r = 0; r <= rows; r++) {
    const y = nutY + r * cell;
    out.push(
      <line
        key={`cf-${r}`}
        x1={left}
        y1={y}
        x2={left + gridW}
        y2={y}
        stroke={color}
        strokeWidth={r === 0 && baseFret === 1 ? 2 : 0.8}
      />,
    );
  }
  if (baseFret > 1) {
    out.push(
      <text key="cbf" x={left - 4} y={nutY + cell * 0.7} fontSize={7} fill={color} textAnchor="end" dominantBaseline="central">
        {baseFret}
      </text>,
    );
  }
  const r = cell * 0.38;
  // Barre detection: the lowest fretted fret, when it lands on >=2 strings, is the
  // index-finger barre. Draw one bar across its span; higher notes sit on top as dots.
  const barred = new Set<number>();
  const fretted = frets.map((f, i) => ({ f, i })).filter((o) => o.f > 0);
  const minFret = fretted.length ? Math.min(...fretted.map((o) => o.f)) : 0;
  const barreIdxs = fretted.filter((o) => o.f === minFret).map((o) => o.i);
  if (minFret > 0 && barreIdxs.length >= 2) {
    const lo = Math.min(...barreIdxs);
    const hi = Math.max(...barreIdxs);
    const y = nutY + (minFret - baseFret + 0.5) * cell;
    out.push(
      <rect
        key={`cbar-${minFret}`}
        x={left + lo * cell - r}
        y={y - r}
        width={(hi - lo) * cell + 2 * r}
        height={2 * r}
        rx={r}
        fill={color}
      />,
    );
    barreIdxs.forEach((i) => barred.add(i));
  }
  // per-string dots / open / muted markers (skip strings covered by a barre)
  frets.forEach((f, i) => {
    const x = left + i * cell;
    if (f === -1) {
      out.push(
        <text key={`cm-${i}`} x={x} y={markerY} fontSize={7} fill={color} textAnchor="middle" dominantBaseline="central">
          ×
        </text>,
      );
    } else if (f === 0) {
      out.push(
        <circle key={`co-${i}`} cx={x} cy={markerY} r={2.2} fill="none" stroke={color} strokeWidth={0.8} />,
      );
    } else if (!barred.has(i)) {
      out.push(
        <circle key={`cd-${i}`} cx={x} cy={nutY + (f - baseFret + 0.5) * cell} r={r} fill={color} />,
      );
    }
  });
  return out;
}

function drawTriplets(sys: TabSystem, beamY: number, color: string, fontFamily: string) {
  const groups = new Map<number, PlacedBeat[]>();
  for (const b of sys.beats) {
    if (b.tripletGroup === null) continue;
    const arr = groups.get(b.tripletGroup) ?? [];
    arr.push(b);
    groups.set(b.tripletGroup, arr);
  }
  const out: ReactElement[] = [];
  const y = beamY + 9; // just below the beam/flag row
  for (const [id, members] of groups) {
    const x0 = members[0].x;
    const x1 = members[members.length - 1].x;
    const mid = (x0 + x1) / 2;
    // light bracket
    out.push(
      <path
        key={`trip-${id}`}
        d={`M ${x0} ${y - 3} L ${x0} ${y} L ${mid - 5} ${y} M ${mid + 5} ${y} L ${x1} ${y} L ${x1} ${y - 3}`}
        stroke={color}
        strokeWidth={0.8}
        fill="none"
      />,
    );
    out.push(
      <text
        key={`trip-label-${id}`}
        x={mid}
        y={y}
        fontSize={9}
        fontFamily={fontFamily}
        fontStyle="italic"
        fill={color}
        textAnchor="middle"
        dominantBaseline="central"
      >
        3
      </text>,
    );
  }
  return out;
}

function drawBeams(sys: TabSystem, beamY: number, color: string) {
  const groups = new Map<number, PlacedBeat[]>();
  for (const b of sys.beats) {
    if (b.beamGroup === null || b.isRest) continue;
    const arr = groups.get(b.beamGroup) ?? [];
    arr.push(b);
    groups.set(b.beamGroup, arr);
  }
  const out: ReactElement[] = [];
  for (const [id, members] of groups) {
    if (members.length < 2) continue; // singletons get a flag in BeatView
    const x0 = members[0].x;
    const x1 = members[members.length - 1].x;
    const maxFlags = Math.max(...members.map((m) => m.flags));
    for (let f = 0; f < maxFlags; f++) {
      out.push(
        <line
          key={`beam-${id}-${f}`}
          x1={x0}
          y1={beamY - f * 5}
          x2={x1}
          y2={beamY - f * 5}
          stroke={color}
          strokeWidth={3}
        />,
      );
    }
  }
  return out;
}

function BeatView({
  beat,
  sys,
  layout,
  stemBaseY,
  color,
  fontFamily,
  fretFontSize,
  highlighted,
}: {
  beat: PlacedBeat;
  sys: TabSystem;
  layout: TabLayout;
  stemBaseY: number;
  color: string;
  fontFamily: string;
  fretFontSize: number;
  highlighted: boolean;
}) {
  const beamY = stemBaseY + LAYOUT.STEM_LEN;
  // Start the stem clear of the fret number on the bottom string (>=2px below it).
  const stemTopY = Math.min(stemBaseY + fretFontSize / 2 + 4, beamY - 6);
  const knockoutH = fretFontSize + 3;
  const isFlaggedSingleton =
    layout.showStems && beat.beamGroup !== null && !beat.isRest && isSingleton(sys, beat);

  return (
    <g className="tab-beat">
      {highlighted && (
        <rect
          x={beat.x - 10}
          y={sys.lineYs[0] - 8}
          width={20}
          height={(layout.stringCount - 1) * LAYOUT.LINE_GAP + 16}
          fill="#3b82f6"
          opacity={0.15}
          rx={3}
        />
      )}

      {beat.isRest ? (
        <text
          x={beat.x}
          y={sys.lineYs[Math.floor(layout.stringCount / 2)]}
          fontSize={fretFontSize}
          fontFamily={fontFamily}
          fontStyle="italic"
          fill={color}
          textAnchor="middle"
          dominantBaseline="central"
        >
          𝄽
        </text>
      ) : (
        beat.notes.map((n, i) => {
          const y = sys.lineYs[n.string - 1];
          const rw = String(n.fret).length * fretFontSize * 0.62 + 4;
          return (
            <g key={i} className="tab-note">
              {/* knock out the staff line behind the number */}
              <rect
                x={beat.x - rw / 2}
                y={y - knockoutH / 2}
                width={rw}
                height={knockoutH}
                fill={layoutBg(layout)}
              />
              <text
                x={beat.x}
                y={y}
                fontSize={fretFontSize}
                fontFamily={fontFamily}
                fontWeight={600}
                fill={color}
                textAnchor="middle"
                dominantBaseline="central"
              >
                {n.fret}
              </text>
            </g>
          );
        })
      )}

      {/* Stem (starts below the fret number for clarity) */}
      {layout.showStems && !beat.isRest && beat.duration !== "w" && beat.duration !== "wt" && (
        <line
          x1={beat.x}
          y1={stemTopY}
          x2={beat.x}
          y2={beamY}
          stroke={color}
          strokeWidth={1.5}
        />
      )}

      {/* Flag for an un-beamed eighth/sixteenth */}
      {isFlaggedSingleton &&
        Array.from({ length: beat.flags }).map((_, f) => (
          <line
            key={`flag-${f}`}
            x1={beat.x}
            y1={beamY - f * 5}
            x2={beat.x + 7}
            y2={beamY - f * 5}
            stroke={color}
            strokeWidth={3}
          />
        ))}

      {/* Dot for dotted durations (just right of the stem top, clear of the number) */}
      {layout.showStems && beat.dotted && !beat.isRest && (
        <circle cx={beat.x + 5} cy={stemTopY + 2} r={1.6} fill={color} />
      )}

      {/* Technique label under the stem */}
      {beat.technique && (
        <text
          x={beat.x}
          y={beamY + 12}
          fontSize={10}
          fontFamily={fontFamily}
          fontStyle="italic"
          fill={color}
          textAnchor="middle"
          dominantBaseline="central"
        >
          {beat.technique.toUpperCase()}
        </text>
      )}
    </g>
  );
}

function isSingleton(sys: TabSystem, beat: PlacedBeat): boolean {
  if (beat.beamGroup === null) return false;
  return sys.beats.filter((b) => b.beamGroup === beat.beamGroup && !b.isRest).length === 1;
}

function layoutBg(_layout: TabLayout): string {
  // Numbers sit on lines; knock the line out with the page background. We use
  // white as a safe default — the preview card background is white.
  return "#ffffff";
}
