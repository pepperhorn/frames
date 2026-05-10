import { useEffect, useRef } from "react";
import { SVGuitarChord, type ChordSettings, type Chord } from "svguitar";

export type FontWeight = "400" | "500" | "600" | "700" | "800";
export type FontStyle = "normal" | "italic";

export interface TextStyle {
  fontWeight?: FontWeight;
  fontStyle?: FontStyle;
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
    el.innerHTML = "";
    const chart = new SVGuitarChord(el);
    chart
      .configure({
        fontFamily: "Poppins, sans-serif",
        color: "#0a0a0a",
        backgroundColor: "transparent",
        ...settings,
      })
      .chord(chord)
      .draw();
    if (textStyle) {
      const svg = el.querySelector("svg");
      if (svg) {
        const texts = svg.querySelectorAll("text");
        texts.forEach((t) => {
          if (textStyle.fontWeight) {
            t.setAttribute("font-weight", textStyle.fontWeight);
          }
          if (textStyle.fontStyle) {
            t.setAttribute("font-style", textStyle.fontStyle);
          }
        });
      }
    }
    return () => {
      el.innerHTML = "";
    };
  }, [chord, settings, textStyle]);

  return <div ref={containerRef} className={`fretboard-chart ${className ?? ""}`} />;
}

export { FretboardChart as ChordChart };
