import { useState } from "react";
import { ChordWorkbench } from "./ChordWorkbench";
import { ScaleWorkbench } from "./ScaleWorkbench";
import { Button } from "./ui/button";

type Mode = "chord" | "scale";

export function Workbench() {
  const [mode, setMode] = useState<Mode>("chord");
  return (
    <div className="workbench-root flex flex-col gap-6">
      <div className="mode-toggle flex gap-2 items-center">
        <span className="mode-label text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Mode
        </span>
        <Button
          variant={mode === "chord" ? "default" : "outline"}
          size="sm"
          onClick={() => setMode("chord")}
        >
          Chord
        </Button>
        <Button
          variant={mode === "scale" ? "default" : "outline"}
          size="sm"
          onClick={() => setMode("scale")}
        >
          Scale
        </Button>
      </div>
      {mode === "chord" ? <ChordWorkbench /> : <ScaleWorkbench />}
    </div>
  );
}
