import { useState } from "react";
import type { Chord } from "svguitar";
import { ChordChart } from "./ChordChart";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { Button } from "./ui/button";

interface ChordDef {
  name: string;
  description: string;
  chord: Chord;
}

const CHORDS: ChordDef[] = [
  {
    name: "C major",
    description: "Open position",
    chord: {
      fingers: [
        [5, 3, "3"],
        [4, 2, "2"],
        [2, 1, "1"],
        [1, 0],
        [3, 0],
        [6, "x"],
      ],
      barres: [],
    },
  },
  {
    name: "G major",
    description: "Open position",
    chord: {
      fingers: [
        [6, 3, "2"],
        [5, 2, "1"],
        [1, 3, "3"],
        [2, 0],
        [3, 0],
        [4, 0],
      ],
      barres: [],
    },
  },
  {
    name: "D major",
    description: "Open position",
    chord: {
      fingers: [
        [3, 2, "1"],
        [1, 2, "2"],
        [2, 3, "3"],
        [4, 0],
        [5, "x"],
        [6, "x"],
      ],
      barres: [],
    },
  },
  {
    name: "A major",
    description: "Open position",
    chord: {
      fingers: [
        [4, 2, "1"],
        [3, 2, "2"],
        [2, 2, "3"],
        [1, 0],
        [5, 0],
        [6, "x"],
      ],
      barres: [],
    },
  },
  {
    name: "E major",
    description: "Open position",
    chord: {
      fingers: [
        [5, 2, "2"],
        [4, 2, "3"],
        [3, 1, "1"],
        [1, 0],
        [2, 0],
        [6, 0],
      ],
      barres: [],
    },
  },
  {
    name: "F major",
    description: "Barre chord",
    chord: {
      fingers: [
        [3, 2, "2"],
        [5, 3, "4"],
        [4, 3, "3"],
      ],
      barres: [{ fromString: 6, toString: 1, fret: 1, text: "1" }],
    },
  },
];

export function ChordGallery() {
  const [selected, setSelected] = useState(0);
  const current = CHORDS[selected]!;

  return (
    <div className="chord-gallery flex flex-col gap-8">
      <div className="chord-buttons flex flex-wrap gap-2">
        {CHORDS.map((c, i) => (
          <Button
            key={c.name}
            variant={i === selected ? "default" : "outline"}
            size="sm"
            onClick={() => setSelected(i)}
          >
            {c.name}
          </Button>
        ))}
      </div>

      <Card className="chord-card max-w-md mx-auto w-full">
        <CardHeader>
          <CardTitle className="text-2xl">{current.name}</CardTitle>
          <CardDescription>{current.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <ChordChart
            chord={current.chord}
            settings={{ title: current.name }}
            className="flex justify-center"
          />
        </CardContent>
      </Card>
    </div>
  );
}
