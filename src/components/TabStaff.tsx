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
  className,
}: TabStaffProps) {
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
