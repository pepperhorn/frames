import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import opentype, { type Font } from "opentype.js";

/**
 * Glyph-level text measurement backed by bundled TTF files. Used to synthesize
 * getBBox() results under svgdom so the post-process re-anchoring and title
 * auto-shrink work server-side.
 *
 * Fonts live in public/fonts/ so they ship to both the client (web font
 * fallback) and the server (Astro copies public/ → dist/client/ on build).
 * In dev the same files are served straight from public/.
 *
 * For system-fallback families (Georgia, Comic Sans, etc.), measurement
 * returns null and the post-process pipeline degrades to "skip re-anchor".
 */

type FontKey =
  | "Poppins-Regular"
  | "Poppins-Medium"
  | "Poppins-SemiBold"
  | "Poppins-Bold"
  | "Poppins-ExtraBold"
  | "PatrickHand-Regular"
  | "Caveat-VF"
  | "ShadowsIntoLight-Regular"
  | "Inter-VF";

const FONT_FILES: Record<FontKey, string> = {
  "Poppins-Regular": "Poppins-Regular.ttf",
  "Poppins-Medium": "Poppins-Medium.ttf",
  "Poppins-SemiBold": "Poppins-SemiBold.ttf",
  "Poppins-Bold": "Poppins-Bold.ttf",
  "Poppins-ExtraBold": "Poppins-ExtraBold.ttf",
  "PatrickHand-Regular": "PatrickHand-Regular.ttf",
  "Caveat-VF": "Caveat-VF.ttf",
  "ShadowsIntoLight-Regular": "ShadowsIntoLight-Regular.ttf",
  "Inter-VF": "Inter-VF.ttf",
};

/** Locate the fonts dir. Tries dist/client/fonts first (prod), then public/fonts (dev). */
let fontsDir: string | null = null;
function resolveFontsDir(): string | null {
  if (fontsDir) return fontsDir;
  const cwd = process.cwd();
  const candidates = [
    resolve(cwd, "dist/client/fonts"),
    resolve(cwd, "client/fonts"), // when cwd == dist/
    resolve(cwd, "public/fonts"),
  ];
  for (const c of candidates) {
    if (existsSync(c)) {
      fontsDir = c;
      return fontsDir;
    }
  }
  return null;
}

interface FontFile {
  key: FontKey;
  font?: Font | null;
}

const file = (key: FontKey): FontFile => ({ key });

const FAMILIES: Record<string, Record<number, FontFile>> = {
  poppins: {
    400: file("Poppins-Regular"),
    500: file("Poppins-Medium"),
    600: file("Poppins-SemiBold"),
    700: file("Poppins-Bold"),
    800: file("Poppins-ExtraBold"),
  },
  "patrick hand": {
    400: file("PatrickHand-Regular"),
  },
  caveat: {
    400: file("Caveat-VF"),
  },
  "shadows into light": {
    400: file("ShadowsIntoLight-Regular"),
  },
  inter: {
    400: file("Inter-VF"),
  },
};

function canonicalFamily(fontFamily: string | null | undefined): string | null {
  if (!fontFamily) return null;
  const first = fontFamily.split(",")[0]?.trim() ?? "";
  const unquoted = first.replace(/^['"]|['"]$/g, "");
  const key = unquoted.toLowerCase();
  return FAMILIES[key] ? key : null;
}

function pickWeight(family: string, weight: number): FontFile | null {
  const table = FAMILIES[family];
  if (!table) return null;
  const available = Object.keys(table).map(Number).sort((a, b) => a - b);
  if (available.length === 0) return null;
  let chosen = available[0];
  for (const w of available) {
    if (w <= weight) chosen = w;
    else break;
  }
  return table[chosen];
}

function loadFont(file: FontFile): Font | null {
  if (file.font !== undefined) return file.font;
  const dir = resolveFontsDir();
  if (!dir) {
    file.font = null;
    return null;
  }
  try {
    const buf = readFileSync(resolve(dir, FONT_FILES[file.key]));
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    file.font = opentype.parse(ab);
  } catch {
    file.font = null;
  }
  return file.font;
}

export interface TextMetrics {
  width: number;
  height: number;
  ascender: number;
  descender: number;
}

export function measureText(
  fontFamily: string | null | undefined,
  fontWeight: number,
  fontSize: number,
  text: string,
): TextMetrics | null {
  const family = canonicalFamily(fontFamily);
  if (!family) return null;
  const f = pickWeight(family, fontWeight);
  if (!f) return null;
  const font = loadFont(f);
  if (!font) return null;

  const width = font.getAdvanceWidth(text, fontSize);
  const scale = fontSize / font.unitsPerEm;
  const ascender = font.ascender * scale;
  const descender = font.descender * scale;
  const height = ascender - descender;
  return { width, height, ascender, descender };
}
