import { useEffect, useRef } from "react";
import { SVGuitarChord, type ChordSettings, type Chord } from "svguitar";

interface FretboardChartProps {
  chord: Chord;
  settings?: ChordSettings;
  className?: string;
}

export function FretboardChart({ chord, settings, className }: FretboardChartProps) {
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
    return () => {
      el.innerHTML = "";
    };
  }, [chord, settings]);

  return <div ref={containerRef} className={`fretboard-chart ${className ?? ""}`} />;
}

export { FretboardChart as ChordChart };
