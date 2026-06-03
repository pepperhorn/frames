// src/components/TabWorkbench.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { TabStaff } from "./TabStaff";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select } from "./ui/select";
import { parseTab } from "@/lib/tab/parse";
import { layoutTab } from "@/lib/tab/layout";
import { createTabPlayer, type TabPlayerHandle } from "@/lib/tab/playback";
import { TAB_INSTRUMENTS } from "@/lib/tab/instruments";
import type { TabDoc, TabInstrument } from "@/lib/tab/types";
import {
  downloadPngFromContainer,
  downloadSvgFromContainer,
  safeFilename,
} from "@/lib/scaleExport";

type InstrumentUi = "guitar" | "bass" | "ukulele";

const MAJOR_KEYS = ["C", "G", "D", "A", "E", "B", "F#", "Db", "Ab", "Eb", "Bb", "F"];
const MINOR_KEYS = ["Am", "Em", "Bm", "F#m", "C#m", "G#m", "D#m", "Bbm", "Fm", "Cm", "Gm", "Dm"];
const TIME_SIGS = ["4/4", "3/4", "2/4", "6/8", "12/8"];

const SAMPLE = `q:0/3 e:0/2 0/1 q:1/2 | h:2/3 q:r q:3/4
e:0/1 0/2 (h) q:2/2 q:3/2`;

export function TabWorkbench() {
  const [text, setText] = useState(SAMPLE);
  const [instrumentUi, setInstrumentUi] = useState<InstrumentUi>("guitar");
  const [bassStrings, setBassStrings] = useState<4 | 5>(4);
  const [keySig, setKeySig] = useState("C");
  const [timeSigStr, setTimeSigStr] = useState("4/4");
  const [bpm, setBpm] = useState(96);
  const [showStems, setShowStems] = useState(true);
  const [showFingerings, setShowFingerings] = useState(false);
  const [cursorIndex, setCursorIndex] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);

  const instrument: TabInstrument =
    instrumentUi === "guitar"
      ? "guitar"
      : instrumentUi === "ukulele"
      ? "ukulele"
      : bassStrings === 5
      ? "bass5"
      : "bass4";

  const timeSig = useMemo(() => {
    const [num, den] = timeSigStr.split("/").map(Number);
    return { num, den };
  }, [timeSigStr]);

  const doc = useMemo(
    () => parseTab(text, { instrument, keySig, timeSig }),
    [text, instrument, keySig, timeSig],
  );

  // Keep the last DOC that parsed cleanly so the preview never blanks on a typo.
  // Cache the doc (not the layout) so the toggles still apply while an error stands.
  const lastGoodDoc = useRef<TabDoc | null>(null);
  if (doc.errors.length === 0) lastGoodDoc.current = doc;
  const renderDoc = doc.errors.length === 0 ? doc : lastGoodDoc.current ?? doc;

  // Track the preview's available width so the staff wraps to fill it.
  const measureRef = useRef<HTMLDivElement | null>(null);
  const [previewWidth, setPreviewWidth] = useState(880);
  useEffect(() => {
    const el = measureRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      if (w > 0) setPreviewWidth(Math.max(320, Math.floor(w)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const layout = useMemo(
    () =>
      layoutTab(renderDoc, {
        width: previewWidth,
        tuning: renderDoc.tuning,
        stringCount: renderDoc.stringCount,
        timeSig: renderDoc.timeSig,
        showStems,
        showFingerings,
      }),
    [renderDoc, showStems, showFingerings, previewWidth],
  );

  const playerRef = useRef<TabPlayerHandle | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const playGenRef = useRef(0);

  const stop = () => {
    playGenRef.current += 1;
    playerRef.current?.stop();
    playerRef.current = null;
    setPlaying(false);
    setCursorIndex(null);
  };

  const play = async () => {
    stop(); // bumps the generation and clears any current player
    const gen = playGenRef.current;
    setPlaying(true);
    const player = await createTabPlayer(doc, bpm, {
      onCursor: (i) => setCursorIndex(i),
      onEnd: () => stop(),
    });
    if (gen !== playGenRef.current) {
      // a Stop (or another Play) happened during the async load — discard this player
      player.stop();
      return;
    }
    playerRef.current = player;
  };

  useEffect(() => {
    return () => {
      playerRef.current?.stop();
      playerRef.current = null;
    };
  }, []);

  const filename = (ext: string) => safeFilename(["tab", TAB_INSTRUMENTS[instrument].label], ext);
  const downloadSvg = () => downloadSvgFromContainer(previewRef.current, filename("svg"));
  const downloadPng = () =>
    downloadPngFromContainer(previewRef.current, filename("png"), { backgroundColor: "#ffffff" });

  return (
    <div className="tab-workbench flex flex-col gap-6">
      <Card className="tab-setup-card">
          <CardHeader>
            <CardTitle className="text-lg">Instrument & Time</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="instrument-tabs flex flex-wrap gap-2">
              {(["guitar", "bass", "ukulele"] as InstrumentUi[]).map((id) => (
                <Button
                  key={id}
                  variant={id === instrumentUi ? "default" : "outline"}
                  size="sm"
                  onClick={() => setInstrumentUi(id)}
                >
                  {id[0].toUpperCase() + id.slice(1)}
                </Button>
              ))}
              {instrumentUi === "bass" && (
                <Select
                  value={String(bassStrings)}
                  onChange={(e) => setBassStrings(Number(e.target.value) as 4 | 5)}
                >
                  <option value="4">4-string</option>
                  <option value="5">5-string</option>
                </Select>
              )}
            </div>
            <div className="setup-grid grid grid-cols-3 gap-3">
              <Label>
                <span>Key</span>
                <Select value={keySig} onChange={(e) => setKeySig(e.target.value)}>
                  <optgroup label="Major">
                    {MAJOR_KEYS.map((k) => (
                      <option key={k} value={k}>{k}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Minor">
                    {MINOR_KEYS.map((k) => (
                      <option key={k} value={k}>{k.slice(0, -1)} minor</option>
                    ))}
                  </optgroup>
                </Select>
              </Label>
              <Label>
                <span>Time</span>
                <Select value={timeSigStr} onChange={(e) => setTimeSigStr(e.target.value)}>
                  {TIME_SIGS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </Select>
              </Label>
              <Label>
                <span>Tempo (BPM)</span>
                <Input
                  type="number"
                  min={30}
                  max={300}
                  value={bpm}
                  onChange={(e) => setBpm(Math.max(30, Number(e.target.value) || 96))}
                />
              </Label>
            </div>
            <div className="toggles flex flex-wrap gap-2 items-center pt-2 border-t">
              <Button
                variant={showStems ? "default" : "outline"}
                size="sm"
                onClick={() => setShowStems((s) => !s)}
              >
                Beams/stems: {showStems ? "on" : "off"}
              </Button>
              <Button
                variant={showFingerings ? "default" : "outline"}
                size="sm"
                onClick={() => setShowFingerings((s) => !s)}
              >
                Fingerings: {showFingerings ? "on" : "off"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="preview-card">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-lg">Preview</CardTitle>
            <div className="preview-actions flex gap-2">
              {playing ? (
                <Button size="sm" variant="outline" onClick={stop} className="stop-btn">
                  Stop
                </Button>
              ) : (
                <Button size="sm" onClick={play} className="play-btn">
                  ▶ Play
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={downloadSvg} className="download-svg-btn">
                SVG
              </Button>
              <Button size="sm" variant="outline" onClick={downloadPng} className="download-png-btn">
                PNG
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div ref={measureRef} className="preview-measure w-full">
              <div ref={previewRef} className="preview-svg-wrap overflow-x-auto bg-white rounded">
                <TabStaff layout={layout} cursorIndex={cursorIndex} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="tab-editor-card">
          <CardHeader>
            <CardTitle className="text-lg">Tab</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <textarea
              className="tab-editor-textarea w-full min-h-[220px] rounded-md border p-3 font-mono text-sm"
              value={text}
              spellCheck={false}
              onChange={(e) => setText(e.target.value)}
            />
            {doc.errors.length > 0 ? (
              <div className="tab-errors text-xs text-red-600">
                {doc.errors.map((err, i) => (
                  <div key={i}>line {err.line}: {err.message}</div>
                ))}
              </div>
            ) : (
              <div className="tab-help text-xs text-muted-foreground">
                e.g. <code>q:5/2</code> note · <code>q:2/4:3/5</code> chord ·{" "}
                <code>ed:</code> dotted · <code>(h)</code> hammer · <code>r</code> rest ·{" "}
                <code>x</code> repeat · <code>|</code> barline
              </div>
            )}
          </CardContent>
        </Card>
    </div>
  );
}
