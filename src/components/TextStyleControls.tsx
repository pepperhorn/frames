import { useEffect, useRef, useState } from "react";
import type { ChordSettings } from "svguitar";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select } from "./ui/select";
import {
  type FontStyle,
  type FontWeight,
  type RoleStyle,
  type TextShadow,
  type TextStyle,
} from "./FretboardChart";
import {
  applyPreset,
  deletePreset,
  downloadPresetJson,
  extractPreset,
  importPresetFromFile,
  listPresetNames,
  loadPreset,
  savePreset,
} from "@/lib/stylePreset";

type RoleKey = "dot" | "title" | "fretLabel" | "tuning";
const ROLE_LABELS: Record<RoleKey, string> = {
  dot: "Dot label",
  title: "Title",
  fretLabel: "Fret position",
  tuning: "Tuning",
};

interface Props {
  settings: ChordSettings;
  setSettings: (updater: (s: ChordSettings) => ChordSettings) => void;
  textStyle: TextStyle;
  setTextStyle: (next: TextStyle) => void;
}

function RoleRow({
  role,
  textStyle,
  setTextStyle,
}: {
  role: RoleKey;
  textStyle: TextStyle;
  setTextStyle: (next: TextStyle) => void;
}) {
  const current: RoleStyle = textStyle[role] ?? {};
  const update = (patch: Partial<RoleStyle>) => {
    setTextStyle({
      ...textStyle,
      [role]: { ...(textStyle[role] ?? {}), ...patch },
    });
  };
  return (
    <div className={`role-row role-row-${role} grid grid-cols-[100px_1fr_1fr] gap-2 items-center`}>
      <span className="role-label text-sm font-medium">{ROLE_LABELS[role]}</span>
      <Select
        value={current.fontWeight ?? "600"}
        onChange={(e) => update({ fontWeight: e.target.value as FontWeight })}
      >
        <option value="400">400 — regular</option>
        <option value="500">500 — medium</option>
        <option value="600">600 — semibold</option>
        <option value="700">700 — bold</option>
        <option value="800">800 — extrabold</option>
      </Select>
      <Select
        value={current.fontStyle ?? "normal"}
        onChange={(e) => update({ fontStyle: e.target.value as FontStyle })}
      >
        <option value="normal">normal</option>
        <option value="italic">italic</option>
      </Select>
    </div>
  );
}

export function TextStyleControls({ settings, setSettings, textStyle, setTextStyle }: Props) {
  const dotShadow = textStyle.dot?.shadow ?? null;
  const updateShadow = (patch: Partial<TextShadow>) => {
    setTextStyle({
      ...textStyle,
      dot: {
        ...(textStyle.dot ?? {}),
        shadow: {
          offsetX: 1,
          offsetY: 1,
          blur: 2,
          color: "#00000080",
          ...(textStyle.dot?.shadow ?? {}),
          ...patch,
        },
      },
    });
  };
  const toggleShadow = () => {
    setTextStyle({
      ...textStyle,
      dot: {
        ...(textStyle.dot ?? {}),
        shadow: dotShadow ? null : { offsetX: 1, offsetY: 1, blur: 2, color: "#00000080" },
      },
    });
  };

  // Preset state
  const [presetNames, setPresetNames] = useState<string[]>([]);
  const [selectedPreset, setSelectedPreset] = useState("");
  const [newPresetName, setNewPresetName] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setPresetNames(listPresetNames());
  }, []);

  const refreshNames = () => setPresetNames(listPresetNames());

  const handleApply = (name: string) => {
    if (!name) return;
    const preset = loadPreset(name);
    if (!preset) return;
    applyPreset(preset, setSettings, setTextStyle);
  };
  const handleSave = () => {
    const name = newPresetName.trim();
    if (!name) return;
    savePreset(name, extractPreset(settings, textStyle));
    refreshNames();
    setSelectedPreset(name);
    setNewPresetName("");
  };
  const handleDelete = () => {
    if (!selectedPreset) return;
    deletePreset(selectedPreset);
    refreshNames();
    setSelectedPreset("");
  };
  const handleExport = () => {
    const name = selectedPreset || newPresetName || "style-preset";
    downloadPresetJson(extractPreset(settings, textStyle), name);
  };
  const handleImportClick = () => fileInputRef.current?.click();
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const preset = await importPresetFromFile(file);
      applyPreset(preset, setSettings, setTextStyle);
    } catch (err) {
      console.error("Failed to import preset", err);
      alert("Couldn't read that file as a style preset.");
    }
  };

  return (
    <Card className="text-style-card">
      <CardHeader>
        <CardTitle className="text-lg">Text Style</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="role-table flex flex-col gap-2">
          <div className="role-header grid grid-cols-[100px_1fr_1fr] gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <span>Role</span>
            <span>Weight</span>
            <span>Style</span>
          </div>
          {(Object.keys(ROLE_LABELS) as RoleKey[]).map((role) => (
            <RoleRow
              key={role}
              role={role}
              textStyle={textStyle}
              setTextStyle={setTextStyle}
            />
          ))}
        </div>

        <div className="size-grid grid grid-cols-3 gap-3 pt-3 border-t">
          <Label>
            <span className="text-xs">Title size</span>
            <Input
              type="number"
              min={10}
              max={120}
              value={settings.titleFontSize ?? 48}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  titleFontSize: Number(e.target.value) || 48,
                }))
              }
            />
          </Label>
          <Label>
            <span className="text-xs">Fret label size</span>
            <Input
              type="number"
              min={6}
              max={60}
              value={settings.fretLabelFontSize ?? 38}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  fretLabelFontSize: Number(e.target.value) || 38,
                }))
              }
            />
          </Label>
          <Label>
            <span className="text-xs">Tuning size</span>
            <Input
              type="number"
              min={6}
              max={60}
              value={settings.tuningsFontSize ?? 28}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  tuningsFontSize: Number(e.target.value) || 28,
                }))
              }
            />
          </Label>
        </div>

        <div className="shadow-block pt-3 border-t flex flex-col gap-3">
          <div className="shadow-header flex items-center justify-between">
            <span className="text-sm font-medium">Dot shadow</span>
            <Button
              size="sm"
              variant={dotShadow ? "default" : "outline"}
              onClick={toggleShadow}
            >
              {dotShadow ? "On" : "Off"}
            </Button>
          </div>
          {dotShadow && (
            <div className="shadow-grid grid grid-cols-2 gap-3">
              <Label>
                <span className="text-xs">Offset X</span>
                <Input
                  type="number"
                  step={0.5}
                  value={dotShadow.offsetX}
                  onChange={(e) => updateShadow({ offsetX: Number(e.target.value) || 0 })}
                />
              </Label>
              <Label>
                <span className="text-xs">Offset Y</span>
                <Input
                  type="number"
                  step={0.5}
                  value={dotShadow.offsetY}
                  onChange={(e) => updateShadow({ offsetY: Number(e.target.value) || 0 })}
                />
              </Label>
              <Label>
                <span className="text-xs">Blur</span>
                <Input
                  type="number"
                  step={0.5}
                  min={0}
                  value={dotShadow.blur}
                  onChange={(e) => updateShadow({ blur: Math.max(0, Number(e.target.value) || 0) })}
                />
              </Label>
              <Label>
                <span className="text-xs">Color</span>
                <Input
                  type="color"
                  className="h-9 p-1"
                  value={dotShadow.color.length === 7 ? dotShadow.color : "#000000"}
                  onChange={(e) => updateShadow({ color: e.target.value })}
                />
              </Label>
            </div>
          )}
        </div>

        <div className="preset-block pt-3 border-t flex flex-col gap-3">
          <span className="text-sm font-medium">Style presets</span>
          <div className="preset-row grid grid-cols-[1fr_auto_auto] gap-2 items-center">
            <Select
              value={selectedPreset}
              onChange={(e) => {
                setSelectedPreset(e.target.value);
                handleApply(e.target.value);
              }}
            >
              <option value="">Load saved preset…</option>
              {presetNames.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
            <Button
              size="sm"
              variant="outline"
              onClick={handleDelete}
              disabled={!selectedPreset}
            >
              Delete
            </Button>
            <Button size="sm" variant="outline" onClick={handleExport}>
              Export JSON
            </Button>
          </div>
          <div className="preset-save grid grid-cols-[1fr_auto_auto] gap-2 items-center">
            <Input
              placeholder="New preset name"
              value={newPresetName}
              onChange={(e) => setNewPresetName(e.target.value)}
            />
            <Button size="sm" onClick={handleSave} disabled={!newPresetName.trim()}>
              Save
            </Button>
            <Button size="sm" variant="outline" onClick={handleImportClick}>
              Import JSON
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={handleImport}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
