import { useMemo, useRef, useState } from "react";
import type { Chord, ChordSettings, Finger, FingerOptions } from "svguitar";
import {
  FretboardChart,
  type FontStyle,
  type FontWeight,
  type TextShadow,
  type TextStyle,
} from "./FretboardChart";
import { FONT_OPTIONS } from "@/lib/fontOptions";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select } from "./ui/select";
import { INSTRUMENTS, type InstrumentId } from "@/lib/instruments";
import {
  KEY_OPTIONS,
  POSITIONS,
  SCALES,
  SCALE_LABELS,
  generateScale,
  intervalToDegree,
  makeBlankScaleFrame,
  mergeDots,
  noteAt,
  noteToPitchClass,
  pitchClassToName,
  type DotShape,
  type LabelMode,
  type NoteName,
  type ScaleDot,
  type ScaleFrame,
  type ScaleName,
} from "@/lib/scales";
import {
  downloadPngFromContainer,
  downloadSvgFromContainer,
  safeFilename,
} from "@/lib/scaleExport";

const SCALE_KEYS = Object.keys(SCALES) as ScaleName[];
const SHAPES: DotShape[] = ["circle", "square", "triangle"];

function autoLabelFor(
  dot: ScaleDot,
  frame: Pick<ScaleFrame, "labelMode">,
  context: { instrument: InstrumentId; key: NoteName },
): string | undefined {
  if (frame.labelMode === "none") return undefined;
  const pc = noteAt(context.instrument, dot.string, dot.fret);
  if (frame.labelMode === "note") return pitchClassToName(pc, context.key);
  const rootPc = noteToPitchClass(context.key);
  const semis = (pc - rootPc + 12) % 12;
  return intervalToDegree(semis);
}

function frameToChord(
  frame: ScaleFrame,
  context: { instrument: InstrumentId; key: NoteName },
): Chord {
  const fingers: Finger[] = [];
  for (const dot of frame.dots) {
    const isOpen = dot.fret === 0;
    const relFret = isOpen ? 0 : dot.fret - frame.position + 1;
    if (relFret < 0) continue;

    const labelOverride = dot.label;
    const label =
      labelOverride !== undefined ? labelOverride : autoLabelFor(dot, frame, context);
    const color = dot.color ?? (dot.isRoot ? frame.rootColor : frame.noteColor);
    const shape = dot.shape ?? "circle";
    const needsOptions = dot.color !== undefined || dot.shape !== undefined || dot.isRoot;

    if (needsOptions) {
      const opts: FingerOptions = {
        color,
        shape: shape as FingerOptions["shape"],
        textColor: "#ffffff",
      };
      if (label) opts.text = label;
      fingers.push([dot.string, relFret as Finger[1], opts]);
    } else if (label) {
      fingers.push([dot.string, relFret as Finger[1], label]);
    } else {
      fingers.push([dot.string, relFret as Finger[1]]);
    }
  }
  return {
    fingers,
    barres: [],
    position: frame.position,
    title: frame.title,
  };
}

export function ScaleWorkbench() {
  const [instrumentId, setInstrumentId] = useState<InstrumentId>("guitar");
  const inst = INSTRUMENTS[instrumentId];

  const [key, setKey] = useState<NoteName>("A");
  const [scale, setScale] = useState<ScaleName>("minorPentatonic");
  const [genMode, setGenMode] = useState<"span" | "position">("position");
  const [fromFret, setFromFret] = useState(5);
  const [toFret, setToFret] = useState(8);
  const [positionId, setPositionId] = useState<string>("box1");
  const [stringFilter, setStringFilter] = useState<number[]>(() =>
    Array.from({ length: INSTRUMENTS.guitar.strings }, (_, i) => i + 1),
  );

  const [frame, setFrame] = useState<ScaleFrame>(() => makeBlankScaleFrame("guitar"));
  const [settings, setSettings] = useState<ChordSettings>(() => ({
    orientation: "vertical" as ChordSettings["orientation"],
    strings: INSTRUMENTS.guitar.strings,
    frets: INSTRUMENTS.guitar.frets,
    tuning: INSTRUMENTS.guitar.tuning,
    color: "#0a0a0a",
    backgroundColor: "transparent",
    fingerColor: "#0a0a0a",
    fingerTextColor: "#ffffff",
    fontFamily: "Poppins, sans-serif",
    fretSize: 1.5,
    fingerSize: 1,
    titleFontSize: 48,
    strokeWidth: 2,
    style: "normal" as ChordSettings["style"],
  }));
  const [textStyle, setTextStyle] = useState<TextStyle>({
    fontWeight: "600",
    fontStyle: "normal",
    shadow: null,
  });
  const updateShadow = (patch: Partial<TextShadow>) =>
    setTextStyle((ts) => ({
      ...ts,
      shadow: { offsetX: 1, offsetY: 1, blur: 2, color: "#00000080", ...(ts.shadow ?? {}), ...patch },
    }));

  const positions = useMemo(() => POSITIONS[scale] ?? [], [scale]);
  const hasPositions = positions.length > 0;

  const handleInstrumentChange = (next: InstrumentId) => {
    setInstrumentId(next);
    const nextInst = INSTRUMENTS[next];
    const allStrings = Array.from({ length: nextInst.strings }, (_, i) => i + 1);
    const defaultFilter =
      next === "guitar-top3" ? [1, 2, 3].filter((s) => s <= nextInst.strings) : allStrings;
    setStringFilter(defaultFilter);
    setFrame(makeBlankScaleFrame(next));
    setSettings((s) => ({
      ...s,
      strings: nextInst.strings,
      frets: nextInst.frets,
      tuning: nextInst.tuning,
    }));
  };

  const generate = (mergeMode: "replace" | "merge") => {
    const result = generateScale({
      key,
      scale,
      instrument: instrumentId,
      mode: genMode,
      fromFret,
      toFret,
      positionId: hasPositions ? positionId : undefined,
      stringFilter,
      labelMode: frame.labelMode,
    });
    if (mergeMode === "replace") {
      setFrame((f) => ({
        ...f,
        title: f.title || `${key} ${SCALE_LABELS[scale]}`,
        position: result.position,
        fretSpan: result.fretSpan,
        dots: result.dots,
      }));
      setSettings((s) => ({ ...s, frets: result.fretSpan }));
    } else {
      setFrame((f) => ({ ...f, dots: mergeDots(f.dots, result.dots) }));
    }
  };

  const updateDot = (idx: number, patch: Partial<ScaleDot>) => {
    setFrame((f) => ({
      ...f,
      dots: f.dots.map((d, i) => (i === idx ? { ...d, ...patch } : d)),
    }));
  };
  const removeDot = (idx: number) => {
    setFrame((f) => ({ ...f, dots: f.dots.filter((_, i) => i !== idx) }));
  };
  const addDot = () => {
    setFrame((f) => ({
      ...f,
      dots: [...f.dots, { string: 1, fret: f.position }],
    }));
  };

  const toggleString = (s: number) => {
    setStringFilter((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s].sort((a, b) => a - b),
    );
  };
  const allStrings = Array.from({ length: inst.strings }, (_, i) => i + 1);

  const chord = useMemo(
    () => frameToChord(frame, { instrument: instrumentId, key }),
    [frame, instrumentId, key],
  );

  const previewRef = useRef<HTMLDivElement | null>(null);
  const filename = (ext: string) =>
    safeFilename([frame.title || `${key}_${scale}`, inst.label], ext);
  const downloadSvg = () => downloadSvgFromContainer(previewRef.current, filename("svg"));
  const downloadPng = () =>
    downloadPngFromContainer(previewRef.current, filename("png"), {
      backgroundColor: settings.backgroundColor,
    });

  return (
    <div className="scale-workbench grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
      <div className="workbench-controls flex flex-col gap-6">
        <Card className="instrument-card">
          <CardHeader>
            <CardTitle className="text-lg">Instrument & Style</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="instrument-tabs flex flex-wrap gap-2">
              {(Object.keys(INSTRUMENTS) as InstrumentId[]).map((id) => (
                <Button
                  key={id}
                  variant={id === instrumentId ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleInstrumentChange(id)}
                >
                  {INSTRUMENTS[id].label}
                </Button>
              ))}
            </div>
            <p className="instrument-desc text-sm text-muted-foreground">
              {inst.description}
            </p>
            <div className="style-toggle flex flex-wrap gap-2 items-center pt-2 border-t">
              <span className="style-label text-sm font-medium">Style</span>
              {(["normal", "handdrawn"] as const).map((s) => (
                <Button
                  key={s}
                  variant={settings.style === s ? "default" : "outline"}
                  size="sm"
                  onClick={() =>
                    setSettings({ ...settings, style: s as ChordSettings["style"] })
                  }
                >
                  {s}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="scale-generator-card">
          <CardHeader>
            <CardTitle className="text-lg">Scale Generator</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="generator-grid grid grid-cols-2 gap-3">
              <Label className="key-label">
                <span>Key</span>
                <Select value={key} onChange={(e) => setKey(e.target.value as NoteName)}>
                  {KEY_OPTIONS.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </Select>
              </Label>
              <Label className="scale-label">
                <span>Scale</span>
                <Select
                  value={scale}
                  onChange={(e) => setScale(e.target.value as ScaleName)}
                >
                  {SCALE_KEYS.map((s) => (
                    <option key={s} value={s}>
                      {SCALE_LABELS[s]}
                    </option>
                  ))}
                </Select>
              </Label>
            </div>

            <div className="gen-mode-toggle flex flex-wrap gap-2 items-center">
              <span className="text-sm font-medium">Mode</span>
              {(["position", "span"] as const).map((m) => (
                <Button
                  key={m}
                  variant={genMode === m ? "default" : "outline"}
                  size="sm"
                  disabled={m === "position" && !hasPositions}
                  onClick={() => setGenMode(m)}
                >
                  {m === "position" ? "Position" : "Span"}
                </Button>
              ))}
            </div>

            {genMode === "span" && (
              <div className="span-grid grid grid-cols-2 gap-3">
                <Label>
                  <span>From fret</span>
                  <Input
                    type="number"
                    min={0}
                    value={fromFret}
                    onChange={(e) => setFromFret(Math.max(0, Number(e.target.value) || 0))}
                  />
                </Label>
                <Label>
                  <span>To fret</span>
                  <Input
                    type="number"
                    min={0}
                    value={toFret}
                    onChange={(e) => setToFret(Math.max(0, Number(e.target.value) || 0))}
                  />
                </Label>
              </div>
            )}

            {genMode === "position" && hasPositions && (
              <Label className="position-preset-label">
                <span>Position</span>
                <Select value={positionId} onChange={(e) => setPositionId(e.target.value)}>
                  {positions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </Select>
              </Label>
            )}

            <div className="string-filter">
              <div className="string-filter-header flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Strings</span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setStringFilter(allStrings)}
                  >
                    All
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setStringFilter([])}
                  >
                    None
                  </Button>
                </div>
              </div>
              <div className="string-filter-row flex flex-wrap gap-2">
                {allStrings.map((s) => {
                  const tuningIdx = inst.strings - s;
                  const tuningLabel = inst.tuning[tuningIdx];
                  const active = stringFilter.includes(s);
                  return (
                    <Button
                      key={s}
                      variant={active ? "default" : "outline"}
                      size="sm"
                      onClick={() => toggleString(s)}
                    >
                      {s} ({tuningLabel})
                    </Button>
                  );
                })}
              </div>
            </div>

            <div className="label-mode-toggle flex flex-wrap gap-2 items-center">
              <span className="text-sm font-medium">Labels</span>
              {(["note", "degree", "none"] as LabelMode[]).map((m) => (
                <Button
                  key={m}
                  variant={frame.labelMode === m ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFrame((f) => ({ ...f, labelMode: m }))}
                >
                  {m}
                </Button>
              ))}
            </div>

            <div className="gen-colors grid grid-cols-2 gap-3">
              <Label>
                <span>Root color</span>
                <Input
                  type="color"
                  className="h-9 p-1"
                  value={frame.rootColor}
                  onChange={(e) => setFrame((f) => ({ ...f, rootColor: e.target.value }))}
                />
              </Label>
              <Label>
                <span>Note color</span>
                <Input
                  type="color"
                  className="h-9 p-1"
                  value={frame.noteColor}
                  onChange={(e) => setFrame((f) => ({ ...f, noteColor: e.target.value }))}
                />
              </Label>
            </div>

            <div className="gen-actions flex gap-2 pt-2 border-t">
              <Button onClick={() => generate("replace")}>Generate</Button>
              <Button variant="outline" onClick={() => generate("merge")}>
                Add to existing
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="dots-editor-card">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-lg">Dots ({frame.dots.length})</CardTitle>
            <Button size="sm" variant="outline" onClick={addDot}>
              + Add dot
            </Button>
          </CardHeader>
          <CardContent>
            {frame.dots.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No dots yet. Generate a scale or add dots manually.
              </p>
            )}
            {frame.dots.length > 0 && (
              <div className="dots-table">
                <div className="dots-header grid grid-cols-[60px_60px_1fr_60px_90px_50px_40px] gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                  <span>String</span>
                  <span>Fret</span>
                  <span>Label</span>
                  <span>Color</span>
                  <span>Shape</span>
                  <span>Root</span>
                  <span></span>
                </div>
                {frame.dots.map((d, i) => {
                  const autoLabel = autoLabelFor(d, frame, {
                    instrument: instrumentId,
                    key,
                  });
                  return (
                    <div
                      key={i}
                      className="dot-row grid grid-cols-[60px_60px_1fr_60px_90px_50px_40px] gap-2 items-center mb-1"
                    >
                      <Input
                        type="number"
                        min={1}
                        max={inst.strings}
                        value={d.string}
                        onChange={(e) =>
                          updateDot(i, { string: Math.max(1, Number(e.target.value) || 1) })
                        }
                      />
                      <Input
                        type="number"
                        min={0}
                        value={d.fret}
                        onChange={(e) =>
                          updateDot(i, { fret: Math.max(0, Number(e.target.value) || 0) })
                        }
                      />
                      <Input
                        value={d.label ?? ""}
                        placeholder={autoLabel ?? "—"}
                        onChange={(e) => {
                          const v = e.target.value;
                          updateDot(i, { label: v.length === 0 ? undefined : v });
                        }}
                      />
                      <Input
                        type="color"
                        className="h-9 p-1"
                        value={
                          d.color ??
                          (d.isRoot ? frame.rootColor : frame.noteColor)
                        }
                        onChange={(e) => updateDot(i, { color: e.target.value })}
                      />
                      <Select
                        value={d.shape ?? "circle"}
                        onChange={(e) =>
                          updateDot(i, { shape: e.target.value as DotShape })
                        }
                      >
                        {SHAPES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </Select>
                      <input
                        type="checkbox"
                        className="root-checkbox justify-self-center"
                        checked={Boolean(d.isRoot)}
                        onChange={(e) => updateDot(i, { isRoot: e.target.checked })}
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeDot(i)}
                        aria-label="Remove dot"
                      >
                        ✕
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="settings-card">
          <CardHeader>
            <CardTitle className="text-lg">Diagram Settings</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <Label className="title-label col-span-2">
              <span>Title</span>
              <Input
                value={frame.title}
                onChange={(e) => setFrame({ ...frame, title: e.target.value })}
                placeholder={`e.g. ${key} ${SCALE_LABELS[scale]}`}
              />
            </Label>
            <Label>
              <span>Starting fret (position)</span>
              <Input
                type="number"
                min={1}
                value={frame.position}
                onChange={(e) => {
                  const v = Math.max(1, Number(e.target.value) || 1);
                  setFrame((f) => ({ ...f, position: v }));
                }}
              />
            </Label>
            <Label>
              <span>Frets shown (span)</span>
              <Input
                type="number"
                min={3}
                max={24}
                value={frame.fretSpan}
                onChange={(e) => {
                  const v = Math.max(3, Number(e.target.value) || 5);
                  setFrame((f) => ({ ...f, fretSpan: v }));
                  setSettings((s) => ({ ...s, frets: v }));
                }}
              />
            </Label>
            <Label>
              <span>Orientation</span>
              <Select
                value={settings.orientation}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    orientation: e.target.value as ChordSettings["orientation"],
                  })
                }
              >
                <option value="vertical">vertical</option>
                <option value="horizontal">horizontal</option>
              </Select>
            </Label>
            <Label>
              <span>Strings</span>
              <Input
                type="number"
                min={2}
                max={12}
                value={settings.strings ?? inst.strings}
                onChange={(e) =>
                  setSettings({ ...settings, strings: Number(e.target.value) || inst.strings })
                }
              />
            </Label>
            <Label>
              <span>Color</span>
              <Input
                type="color"
                className="h-9 p-1"
                value={settings.color ?? "#000000"}
                onChange={(e) => setSettings({ ...settings, color: e.target.value })}
              />
            </Label>
            <Label>
              <span>Background</span>
              <Input
                type="color"
                className="h-9 p-1"
                value={
                  settings.backgroundColor && settings.backgroundColor !== "transparent"
                    ? settings.backgroundColor
                    : "#ffffff"
                }
                onChange={(e) =>
                  setSettings({ ...settings, backgroundColor: e.target.value })
                }
              />
            </Label>
            <Label>
              <span>Finger size</span>
              <Input
                type="number"
                step={0.1}
                min={0.4}
                max={2}
                value={settings.fingerSize ?? 1}
                onChange={(e) =>
                  setSettings({ ...settings, fingerSize: Number(e.target.value) || 1 })
                }
              />
            </Label>
            <Label>
              <span>Fret size</span>
              <Input
                type="number"
                step={0.1}
                min={0.5}
                max={3}
                value={settings.fretSize ?? 1.5}
                onChange={(e) =>
                  setSettings({ ...settings, fretSize: Number(e.target.value) || 1.5 })
                }
              />
            </Label>
            <Label>
              <span>Stroke width</span>
              <Input
                type="number"
                step={0.5}
                min={0.5}
                max={6}
                value={settings.strokeWidth ?? 2}
                onChange={(e) =>
                  setSettings({ ...settings, strokeWidth: Number(e.target.value) || 2 })
                }
              />
            </Label>
            <Label>
              <span>Title font size</span>
              <Input
                type="number"
                min={10}
                max={120}
                value={settings.titleFontSize ?? 48}
                onChange={(e) =>
                  setSettings({ ...settings, titleFontSize: Number(e.target.value) || 48 })
                }
              />
            </Label>
            <Label className="col-span-2">
              <span>Font family</span>
              <Select
                value={settings.fontFamily ?? "Poppins, sans-serif"}
                onChange={(e) => setSettings({ ...settings, fontFamily: e.target.value })}
              >
                {FONT_OPTIONS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </Select>
            </Label>
            <Label>
              <span>Font weight</span>
              <Select
                value={textStyle.fontWeight ?? "600"}
                onChange={(e) =>
                  setTextStyle({ ...textStyle, fontWeight: e.target.value as FontWeight })
                }
              >
                <option value="400">400 — regular</option>
                <option value="500">500 — medium</option>
                <option value="600">600 — semibold</option>
                <option value="700">700 — bold</option>
                <option value="800">800 — extrabold</option>
              </Select>
            </Label>
            <Label>
              <span>Font style</span>
              <Select
                value={textStyle.fontStyle ?? "normal"}
                onChange={(e) =>
                  setTextStyle({ ...textStyle, fontStyle: e.target.value as FontStyle })
                }
              >
                <option value="normal">normal</option>
                <option value="italic">italic</option>
              </Select>
            </Label>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-lg">Text Shadow</CardTitle>
            <Button
              size="sm"
              variant={textStyle.shadow ? "default" : "outline"}
              onClick={() =>
                setTextStyle((ts) => ({
                  ...ts,
                  shadow: ts.shadow
                    ? null
                    : { offsetX: 1, offsetY: 1, blur: 2, color: "#00000080" },
                }))
              }
            >
              {textStyle.shadow ? "On" : "Off"}
            </Button>
          </CardHeader>
          {textStyle.shadow && (
            <CardContent className="grid grid-cols-2 gap-3">
              <Label>
                <span>Offset X</span>
                <Input
                  type="number"
                  step={0.5}
                  value={textStyle.shadow.offsetX}
                  onChange={(e) => updateShadow({ offsetX: Number(e.target.value) || 0 })}
                />
              </Label>
              <Label>
                <span>Offset Y</span>
                <Input
                  type="number"
                  step={0.5}
                  value={textStyle.shadow.offsetY}
                  onChange={(e) => updateShadow({ offsetY: Number(e.target.value) || 0 })}
                />
              </Label>
              <Label>
                <span>Blur</span>
                <Input
                  type="number"
                  step={0.5}
                  min={0}
                  value={textStyle.shadow.blur}
                  onChange={(e) => updateShadow({ blur: Math.max(0, Number(e.target.value) || 0) })}
                />
              </Label>
              <Label>
                <span>Color</span>
                <Input
                  type="color"
                  className="h-9 p-1"
                  value={textStyle.shadow.color.length === 7 ? textStyle.shadow.color : "#000000"}
                  onChange={(e) => updateShadow({ color: e.target.value })}
                />
              </Label>
            </CardContent>
          )}
        </Card>
      </div>

      <div className="workbench-preview lg:sticky lg:top-6 self-start flex flex-col gap-4">
        <Card className="preview-card">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-lg">Preview</CardTitle>
            <div className="download-buttons flex gap-2">
              <Button size="sm" variant="outline" onClick={downloadSvg} className="download-svg-btn">
                SVG
              </Button>
              <Button size="sm" variant="outline" onClick={downloadPng} className="download-png-btn">
                PNG
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div ref={previewRef} className="preview-svg-wrap">
              <FretboardChart
                chord={chord}
                settings={{ ...settings, frets: frame.fretSpan }}
                textStyle={textStyle}
                className="preview-chart flex justify-center"
              />
            </div>
          </CardContent>
        </Card>
        <Card className="json-card">
          <CardHeader>
            <CardTitle className="text-sm">Frame JSON</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="frame-json text-xs overflow-x-auto bg-muted/40 rounded p-3">
              {JSON.stringify(frame, null, 2)}
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
