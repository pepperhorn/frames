import { useEffect, useRef } from "react";
import type { ChordSettings, Chord } from "svguitar";
import { renderChordInto } from "@/lib/render/renderIntoElement";

export type FontWeight = "400" | "500" | "600" | "700" | "800";
export type FontStyle = "normal" | "italic";

export interface TextShadow {
  offsetX: number;
  offsetY: number;
  blur: number;
  color: string;
}

export interface RoleStyle {
  fontWeight?: FontWeight;
  fontStyle?: FontStyle;
}

export interface TextStyle {
  dot?: RoleStyle & { shadow?: TextShadow | null };
  title?: RoleStyle;
  fretLabel?: RoleStyle;
  tuning?: RoleStyle;
}

interface FretboardChartProps {
  chord: Chord;
  settings?: ChordSettings;
  textStyle?: TextStyle;
  className?: string;
}

export function FretboardChart({
  chord,
  settings,
  textStyle,
  className,
}: FretboardChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    renderChordInto(el, { chord, settings, textStyle });
    return () => {
      el.innerHTML = "";
    };
  }, [chord, settings, textStyle]);

  return <div ref={containerRef} className={`fretboard-chart ${className ?? ""}`} />;
}

export { FretboardChart as ChordChart };
