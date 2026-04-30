import { useEffect, useRef } from "react";
import { SVGuitarChord, type ChordSettings, type Chord } from "svguitar";

interface ChordChartProps {
  chord: Chord;
  settings?: ChordSettings;
  className?: string;
}

export function ChordChart({ chord, settings, className }: ChordChartProps) {
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

  return <div ref={containerRef} className={`chord-chart ${className ?? ""}`} />;
}
