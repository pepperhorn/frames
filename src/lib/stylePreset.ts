import type { ChordSettings } from "svguitar";
import type { TextStyle } from "@/components/FretboardChart";

const STORAGE_KEY = "frames.stylePresets";
const PRESET_VERSION = 1;

export interface StylePreset {
  version: number;
  fontFamily?: string;
  titleFontSize?: number;
  fretLabelFontSize?: number;
  tuningsFontSize?: number;
  textStyle: TextStyle;
}

export function extractPreset(settings: ChordSettings, textStyle: TextStyle): StylePreset {
  return {
    version: PRESET_VERSION,
    fontFamily: settings.fontFamily,
    titleFontSize: settings.titleFontSize,
    fretLabelFontSize: settings.fretLabelFontSize,
    tuningsFontSize: settings.tuningsFontSize,
    textStyle,
  };
}

export function applyPreset(
  preset: StylePreset,
  setSettings: (updater: (s: ChordSettings) => ChordSettings) => void,
  setTextStyle: (next: TextStyle) => void,
): void {
  setSettings((s) => ({
    ...s,
    fontFamily: preset.fontFamily ?? s.fontFamily,
    titleFontSize: preset.titleFontSize ?? s.titleFontSize,
    fretLabelFontSize: preset.fretLabelFontSize ?? s.fretLabelFontSize,
    tuningsFontSize: preset.tuningsFontSize ?? s.tuningsFontSize,
  }));
  setTextStyle(preset.textStyle ?? {});
}

function readMap(): Record<string, StylePreset> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed ? parsed : {};
  } catch {
    return {};
  }
}

function writeMap(map: Record<string, StylePreset>): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

export function listPresetNames(): string[] {
  return Object.keys(readMap()).sort((a, b) => a.localeCompare(b));
}

export function loadPreset(name: string): StylePreset | null {
  const map = readMap();
  return map[name] ?? null;
}

export function savePreset(name: string, preset: StylePreset): void {
  const map = readMap();
  map[name] = preset;
  writeMap(map);
}

export function deletePreset(name: string): void {
  const map = readMap();
  delete map[name];
  writeMap(map);
}

export function downloadPresetJson(preset: StylePreset, name: string): void {
  const blob = new Blob([JSON.stringify(preset, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(name || "style-preset").replace(/[^\w\-]+/g, "_")}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function importPresetFromFile(file: File): Promise<StylePreset> {
  const text = await file.text();
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== "object" || !parsed.textStyle) {
    throw new Error("Invalid style preset file");
  }
  return parsed as StylePreset;
}
