import { useMemo, useRef, useState } from "react";
import type { Chord, ChordSettings, Barre, Finger, FingerOptions } from "svguitar";
import { ChordChart } from "./ChordChart";
import type { TextStyle } from "./FretboardChart";
import { TextStyleControls } from "./TextStyleControls";
import { FONT_OPTIONS } from "@/lib/fontOptions";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select } from "./ui/select";
import {
  CHORDS_DB,
  INSTRUMENTS,
  dbPositionToChord,
  type InstrumentId,
} from "@/lib/instruments";
import { BASS_PRESETS, GUITAR_TOP3_PRESETS, type StaticPreset } from "@/lib/staticPresets";
import { chordToFretCode, fretCodeToChord } from "@/lib/tab/chordCode";
import {
  downloadPngFromContainer,
  downloadSvgFromContainer,
  safeFilename,
} from "@/lib/scaleExport";

function fretToInput(v: number | "x" | 0): string {
  if (v === "x") return "x";
  if (v === 0) return "0";
  return String(v);
}
function parseFret(v: string): number | "x" | 0 | null {
  const t = v.trim().toLowerCase();
  if (t === "x" || t === "-1" || t === "mute") return "x";
  if (t === "0" || t === "o" || t === "open") return 0;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

function makeBlankChord(stringCount: number): Chord {
  const fingers: Finger[] = [];
  for (let s = 1; s <= stringCount; s++) fingers.push([s, 0]);
  return { fingers, barres: [], position: 1, title: "" };
}

function fingerForString(chord: Chord, stringNum: number): Finger | undefined {
  return chord.fingers.find((f) => f[0] === stringNum);
}

function setFinger(chord: Chord, stringNum: number, next: Finger | null): Chord {
  const others = chord.fingers.filter((f) => f[0] !== stringNum);
  return { ...chord, fingers: next ? [...others, next] : others };
}

interface PresetOption {
  key: string;
  suffix: string;
  positionIndex?: number;
  label: string;
  chord: Chord;
}

function buildPresets(instrumentId: InstrumentId): PresetOption[] {
  const inst = INSTRUMENTS[instrumentId];
  if (instrumentId === "guitar" || instrumentId === "ukulele") {
    const db = CHORDS_DB[instrumentId];
    const out: PresetOption[] = [];
    for (const key of db.keys) {
      const entries = db.chords[key] || [];
      for (const e of entries) {
        e.positions.forEach((pos, i) => {
          const title = `${e.key}${e.suffix === "major" ? "" : e.suffix}`;
          out.push({
            key: e.key,
            suffix: e.suffix,
            positionIndex: i,
            label: `${title}${e.positions.length > 1 ? ` · pos ${i + 1}` : ""}`,
            chord: dbPositionToChord(pos, inst.strings, title),
          });
        });
      }
    }
    return out;
  }
  const list: StaticPreset[] = instrumentId === "bass" ? BASS_PRESETS : GUITAR_TOP3_PRESETS;
  return list.map((p) => {
    const title = `${p.key}${p.suffix === "major" ? "" : p.suffix}`;
    let chord: Chord = { ...p.chord, title };
    if (instrumentId === "guitar-top3") {
      // Top-3 presets are written for strings 1-3 only; pad strings 4-6 as muted
      // so the diagram renders the full 6-string neck (E A D G B E) with the
      // unused low strings explicitly silenced.
      const padded: Finger[] = [
        ...chord.fingers,
        [4, "x"],
        [5, "x"],
        [6, "x"],
      ];
      chord = { ...chord, fingers: padded };
    }
    return { key: p.key, suffix: p.suffix, label: title, chord };
  });
}

export function ChordWorkbench() {
  const [instrumentId, setInstrumentId] = useState<InstrumentId>("guitar");
  const inst = INSTRUMENTS[instrumentId];

  const presets = useMemo(() => buildPresets(instrumentId), [instrumentId]);

  const [chord, setChord] = useState<Chord>(() => presets[0]?.chord ?? makeBlankChord(inst.strings));
  const [settings, setSettings] = useState<ChordSettings>(() => ({
    orientation: "vertical" as ChordSettings["orientation"],
    strings: inst.strings,
    frets: inst.frets,
    tuning: inst.tuning,
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
  const [highlightColor, setHighlightColor] = useState<string>("#f59e0b");
  const [highlightedStrings, setHighlightedStrings] = useState<Set<number>>(() => new Set());

  const toggleHighlight = (stringNum: number, on: boolean) => {
    setHighlightedStrings((prev) => {
      const next = new Set(prev);
      if (on) next.add(stringNum);
      else next.delete(stringNum);
      return next;
    });
  };

  const renderedChord = useMemo<Chord>(() => {
    if (highlightedStrings.size === 0) return chord;
    const fingers: Finger[] = chord.fingers.map((f) => {
      const [s, fret, extra] = f;
      if (!highlightedStrings.has(s)) return f;
      if (fret === "x" || fret === 0) return f;
      const base: FingerOptions =
        extra && typeof extra === "object" ? { ...(extra as FingerOptions) } : {};
      if (extra && typeof extra === "string") base.text = extra;
      base.color = highlightColor;
      base.textColor = base.textColor ?? "#ffffff";
      return [s, fret, base];
    });
    return { ...chord, fingers };
  }, [chord, highlightedStrings, highlightColor]);

  const [textStyle, setTextStyle] = useState<TextStyle>({
    dot: { fontWeight: "600", fontStyle: "normal", shadow: null },
    title: { fontWeight: "700", fontStyle: "normal" },
    fretLabel: { fontWeight: "600", fontStyle: "normal" },
    tuning: { fontWeight: "600", fontStyle: "normal" },
  });

  const handleInstrumentChange = (next: InstrumentId) => {
    setInstrumentId(next);
    const nextInst = INSTRUMENTS[next];
    const nextPresets = buildPresets(next);
    setChord(nextPresets[0]?.chord ?? makeBlankChord(nextInst.strings));
    setSettings((s) => ({
      ...s,
      strings: nextInst.strings,
      frets: nextInst.frets,
      tuning: nextInst.tuning,
    }));
  };

  const applyPreset = (idx: number) => {
    const p = presets[idx];
    if (!p) return;
    setChord(p.chord);
  };

  const updateFret = (stringNum: number, raw: string) => {
    const parsed = parseFret(raw);
    if (parsed === null) return;
    const existing = fingerForString(chord, stringNum);
    if (parsed === "x" || parsed === 0) {
      setChord(setFinger(chord, stringNum, [stringNum, parsed]));
      return;
    }
    const text = existing && typeof existing[2] === "string" ? existing[2] : undefined;
    setChord(
      setFinger(
        chord,
        stringNum,
        text ? [stringNum, parsed, text] : [stringNum, parsed],
      ),
    );
  };
  const updateFingerLabel = (stringNum: number, raw: string) => {
    const existing = fingerForString(chord, stringNum);
    if (!existing) return;
    const fret = existing[1];
    if (fret === "x" || fret === 0) return;
    const text = raw.trim();
    setChord(
      setFinger(
        chord,
        stringNum,
        text ? [stringNum, fret, text] : [stringNum, fret],
      ),
    );
  };

  const addBarre = () => {
    const newBarre: Barre = {
      fromString: inst.strings,
      toString: 1,
      fret: chord.position ?? 1,
      text: "1",
    };
    setChord({ ...chord, barres: [...chord.barres, newBarre] });
  };
  const updateBarre = (idx: number, patch: Record<string, unknown>) => {
    setChord({
      ...chord,
      barres: chord.barres.map((b, i) => (i === idx ? ({ ...b, ...patch } as Barre) : b)),
    });
  };
  const removeBarre = (idx: number) => {
    setChord({ ...chord, barres: chord.barres.filter((_, i) => i !== idx) });
  };

  const updateTuningLabel = (idx: number, value: string) => {
    const next = [...(settings.tuning ?? [])];
    next[idx] = value;
    setSettings({ ...settings, tuning: next });
  };

  const stringRows = Array.from({ length: inst.strings }, (_, i) => i + 1);

  const currentCode = useMemo(() => chordToFretCode(chord, inst.strings), [chord, inst.strings]);
  const [codeInput, setCodeInput] = useState("");
  const [codeErr, setCodeErr] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showJson, setShowJson] = useState(false);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(currentCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };
  const loadCode = () => {
    const next = fretCodeToChord(codeInput, inst.strings, chord.title || undefined);
    if (next) {
      setChord(next);
      setCodeErr(false);
    } else {
      setCodeErr(true);
    }
  };

  const previewRef = useRef<HTMLDivElement | null>(null);

  const filename = (ext: string) =>
    safeFilename([chord.title || "chord", inst.label], ext);

  const downloadSvg = () =>
    downloadSvgFromContainer(previewRef.current, filename("svg"));
  const downloadPng = () =>
    downloadPngFromContainer(previewRef.current, filename("png"), {
      backgroundColor: settings.backgroundColor,
    });

  return (
    <div className="chord-workbench grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
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

        <Card className="preset-card">
          <CardHeader>
            <CardTitle className="text-lg">Preset</CardTitle>
          </CardHeader>
          <CardContent>
            <Label className="preset-label">
              <span>Choose a preset chord ({presets.length} available)</span>
              <Select
                className="preset-select"
                onChange={(e) => applyPreset(Number(e.target.value))}
                defaultValue=""
              >
                <option value="" disabled>
                  Pick a chord…
                </option>
                {presets.map((p, i) => (
                  <option key={`${p.key}-${p.suffix}-${i}`} value={i}>
                    {p.label}
                  </option>
                ))}
              </Select>
            </Label>
            <div className="load-code mt-3 flex items-end gap-2">
              <Label className="load-code-label flex-1">
                <span>…or load from a chord code</span>
                <Input
                  className="load-code-input"
                  value={codeInput}
                  placeholder="e.g. x02210"
                  onChange={(e) => {
                    setCodeInput(e.target.value);
                    setCodeErr(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") loadCode();
                  }}
                />
              </Label>
              <Button size="sm" variant="outline" className="load-code-btn" onClick={loadCode}>
                Load
              </Button>
            </div>
            {codeErr ? (
              <p className="load-code-err mt-1 text-xs text-red-600">
                Need {inst.strings} frets low→high (x = muted), e.g.{" "}
                <code>{"x".repeat(Math.max(0, inst.strings - 5))}02210</code>.
              </p>
            ) : (
              <p className="preset-hint mt-2 text-xs text-muted-foreground">
                {inst.presetSource === "chords-db"
                  ? "Source: @tombatossals/chords-db"
                  : "Curated beginner voicings"}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="frame-editor-card">
          <CardHeader>
            <CardTitle className="text-lg">Chord Frame</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="frame-grid grid grid-cols-2 gap-3">
              <Label className="title-label">
                <span>Title</span>
                <Input
                  value={chord.title ?? ""}
                  onChange={(e) => setChord({ ...chord, title: e.target.value })}
                  placeholder="e.g. Cmaj7"
                />
              </Label>
              <Label className="position-label">
                <span>Starting Fret (position)</span>
                <Input
                  type="number"
                  min={1}
                  value={chord.position ?? 1}
                  onChange={(e) =>
                    setChord({ ...chord, position: Math.max(1, Number(e.target.value) || 1) })
                  }
                />
              </Label>
            </div>

            <div className="strings-table">
              <div className="strings-header grid grid-cols-[60px_1fr_1fr_1fr_50px] gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                <span>String</span>
                <span>Tuning</span>
                <span>Fret (x / 0 / N)</span>
                <span>Finger label</span>
                <span>Hi</span>
              </div>
              {stringRows.map((stringNum) => {
                const finger = fingerForString(chord, stringNum);
                const fretValRaw = finger ? finger[1] : 0;
                const fretDisplay = fretToInput(fretValRaw as number | "x" | 0);
                const fingerText =
                  finger && typeof finger[2] === "string" ? finger[2] : "";
                const tuningIdx = inst.strings - stringNum;
                return (
                  <div
                    key={stringNum}
                    className="string-row grid grid-cols-[60px_1fr_1fr_1fr_50px] gap-2 items-center mb-1"
                  >
                    <span className="string-num text-sm font-mono text-muted-foreground">
                      {stringNum}
                    </span>
                    <Input
                      className="tuning-input"
                      value={settings.tuning?.[tuningIdx] ?? ""}
                      onChange={(e) => updateTuningLabel(tuningIdx, e.target.value)}
                    />
                    <Input
                      className="fret-input"
                      value={fretDisplay}
                      onChange={(e) => updateFret(stringNum, e.target.value)}
                    />
                    <Input
                      className="finger-label-input"
                      value={fingerText}
                      placeholder={fretValRaw === "x" || fretValRaw === 0 ? "—" : "1-4"}
                      disabled={fretValRaw === "x" || fretValRaw === 0}
                      onChange={(e) => updateFingerLabel(stringNum, e.target.value)}
                    />
                    <input
                      type="checkbox"
                      className="highlight-checkbox justify-self-center"
                      disabled={fretValRaw === "x" || fretValRaw === 0}
                      checked={highlightedStrings.has(stringNum)}
                      onChange={(e) => toggleHighlight(stringNum, e.target.checked)}
                    />
                  </div>
                );
              })}
            </div>

            <div className="barres-section">
              <div className="barres-header flex items-center justify-between mb-2">
                <span className="text-sm font-semibold">Barres</span>
                <Button size="sm" variant="outline" onClick={addBarre}>
                  + Add barre
                </Button>
              </div>
              {chord.barres.length === 0 && (
                <p className="text-xs text-muted-foreground">No barres.</p>
              )}
              {chord.barres.map((b, i) => (
                <div
                  key={i}
                  className="barre-row grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2 items-end mb-2"
                >
                  <Label>
                    <span className="text-xs">From string</span>
                    <Input
                      type="number"
                      min={1}
                      max={inst.strings}
                      value={b.fromString}
                      onChange={(e) =>
                        updateBarre(i, { fromString: Number(e.target.value) || 1 })
                      }
                    />
                  </Label>
                  <Label>
                    <span className="text-xs">To string</span>
                    <Input
                      type="number"
                      min={1}
                      max={inst.strings}
                      value={b.toString}
                      onChange={(e) =>
                        updateBarre(i, { toString: Number(e.target.value) || 1 })
                      }
                    />
                  </Label>
                  <Label>
                    <span className="text-xs">Fret</span>
                    <Input
                      type="number"
                      min={1}
                      value={b.fret}
                      onChange={(e) => updateBarre(i, { fret: Number(e.target.value) || 1 })}
                    />
                  </Label>
                  <Label>
                    <span className="text-xs">Label</span>
                    <Input
                      value={b.text ?? ""}
                      onChange={(e) => updateBarre(i, { text: e.target.value })}
                    />
                  </Label>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => removeBarre(i)}
                    aria-label="Remove barre"
                  >
                    ✕
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="settings-card">
          <button
            type="button"
            className="settings-toggle w-full"
            onClick={() => setShowSettings((v) => !v)}
            aria-expanded={showSettings}
          >
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-lg">Diagram Settings</CardTitle>
              <span className="text-muted-foreground text-sm">{showSettings ? "▲" : "▼"}</span>
            </CardHeader>
          </button>
          {showSettings && (
          <CardContent className="grid grid-cols-2 gap-3">
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
              <span>Style</span>
              <Select
                value={settings.style}
                onChange={(e) =>
                  setSettings({ ...settings, style: e.target.value as ChordSettings["style"] })
                }
              >
                <option value="normal">normal</option>
                <option value="handdrawn">handdrawn</option>
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
              <span>Frets shown</span>
              <Input
                type="number"
                min={3}
                max={24}
                value={settings.frets ?? inst.frets}
                onChange={(e) =>
                  setSettings({ ...settings, frets: Number(e.target.value) || inst.frets })
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
              <span>Finger color</span>
              <Input
                type="color"
                className="h-9 p-1"
                value={settings.fingerColor ?? "#000000"}
                onChange={(e) => setSettings({ ...settings, fingerColor: e.target.value })}
              />
            </Label>
            <Label>
              <span>Highlight color</span>
              <Input
                type="color"
                className="h-9 p-1"
                value={highlightColor}
                onChange={(e) => setHighlightColor(e.target.value)}
              />
            </Label>
            <Label>
              <span>Finger text color</span>
              <Input
                type="color"
                className="h-9 p-1"
                value={settings.fingerTextColor ?? "#ffffff"}
                onChange={(e) =>
                  setSettings({ ...settings, fingerTextColor: e.target.value })
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
          </CardContent>
          )}
        </Card>

        <TextStyleControls
          settings={settings}
          setSettings={(updater) => setSettings(updater(settings))}
          textStyle={textStyle}
          setTextStyle={setTextStyle}
          collapsible
        />
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
              <ChordChart
                chord={renderedChord}
                settings={settings}
                textStyle={textStyle}
                className="preview-chart flex justify-center"
              />
            </div>
            <div className="chord-code-row mt-3 flex items-center justify-center gap-2 text-sm">
              <span className="text-muted-foreground">code</span>
              <code className="chord-code rounded bg-muted/60 px-2 py-1 font-mono">{currentCode}</code>
              <Button
                size="sm"
                variant="outline"
                className="copy-code-btn"
                onClick={copyCode}
                title="Copy chord code to clipboard"
              >
                {copied ? "Copied!" : "⧉ Copy"}
              </Button>
            </div>
          </CardContent>
        </Card>
        <Card className="json-card">
          <button
            type="button"
            className="json-toggle w-full"
            onClick={() => setShowJson((v) => !v)}
            aria-expanded={showJson}
          >
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-sm">Chord JSON</CardTitle>
              <span className="text-muted-foreground text-sm">{showJson ? "▲" : "▼"}</span>
            </CardHeader>
          </button>
          {showJson && (
            <CardContent>
              <pre className="chord-json text-xs overflow-x-auto bg-muted/40 rounded p-3">
                {JSON.stringify(chord, null, 2)}
              </pre>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}
