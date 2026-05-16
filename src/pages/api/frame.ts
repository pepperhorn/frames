import type { APIRoute } from "astro";
import { FrameRequestError, resolveFrameRequest } from "@/lib/apiFrame";
import { renderChordSvg, svgToPng } from "@/lib/renderChord.server";

export const prerender = false;

const USAGE = {
  endpoint: "/api/frame",
  method: "POST",
  contentType: "application/json",
  body: {
    mode: '"chord" | "scale" (required)',
    format: '"svg" | "png" (default "svg")',
    instrument: '"guitar" | "bass" | "ukulele" | "guitar-top3" (default "guitar")',
    imageScale: "PNG resolution multiplier (default 3)",
    raw: "boolean — return image bytes instead of JSON (default false)",
    settings: "optional svguitar ChordSettings overrides",
    chord: {
      key: '"C", "A#", ... (with `suffix`) for a library lookup',
      suffix: '"major", "minor", "7", ...',
      positionIndex: "voicing index, default 0",
      "—or—": "raw `fingers`, `barres`, `position`, `title`",
    },
    scale: {
      key: '"A", "C#", ... (required)',
      scale: '"major" | "minorPentatonic" | "dorian" | ... (required)',
      mode: '"position" | "span" (default "position")',
      positionId: 'e.g. "box1" / "ionian" (position mode)',
      fromFret: "span mode start fret",
      toFret: "span mode end fret",
      stringFilter: "optional array of string numbers",
      labelMode: '"note" | "degree" | "none" (default "note")',
      title: "optional diagram title",
    },
  },
  response:
    "JSON { mode, format, instrument, image:{ mimeType, encoding, data, width, height }, notes:[{name,midi}], noteNames:[] }. " +
    "With raw:true the image bytes are returned directly and notes are in the X-Note-Names / X-Note-Midi headers.",
};

export const GET: APIRoute = () =>
  new Response(JSON.stringify(USAGE, null, 2), {
    headers: { "Content-Type": "application/json" },
  });

export const POST: APIRoute = async ({ request }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  let resolved;
  try {
    resolved = resolveFrameRequest(body);
  } catch (err) {
    if (err instanceof FrameRequestError) {
      return json({ error: err.message }, 400);
    }
    return json({ error: `Resolution failed: ${(err as Error).message}` }, 400);
  }

  const req = body as {
    format?: "svg" | "png";
    imageScale?: number;
    raw?: boolean;
  };
  const format = req.format === "png" ? "png" : "svg";

  let rendered;
  try {
    rendered = await renderChordSvg(resolved.chord, resolved.settings);
  } catch (err) {
    return json({ error: `Render failed: ${(err as Error).message}` }, 500);
  }

  const noteNames = resolved.notes.map((n) => n.name);
  const noteMidi = resolved.notes.map((n) => n.midi);

  if (format === "svg") {
    if (req.raw) {
      return new Response(rendered.svg, {
        headers: {
          "Content-Type": "image/svg+xml; charset=utf-8",
          "X-Note-Names": noteNames.join(","),
          "X-Note-Midi": noteMidi.join(","),
        },
      });
    }
    return json({
      mode: (body as { mode: string }).mode,
      format,
      instrument: resolved.instrument,
      image: {
        mimeType: "image/svg+xml",
        encoding: "utf8",
        data: rendered.svg,
        width: rendered.width,
        height: rendered.height,
      },
      notes: resolved.notes,
      noteNames,
    });
  }

  let png: Buffer;
  try {
    png = await svgToPng(rendered, {
      scale: req.imageScale,
      backgroundColor: resolved.settings.backgroundColor,
    });
  } catch (err) {
    return json({ error: `PNG conversion failed: ${(err as Error).message}` }, 500);
  }

  if (req.raw) {
    return new Response(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        "X-Note-Names": noteNames.join(","),
        "X-Note-Midi": noteMidi.join(","),
      },
    });
  }

  return json({
    mode: (body as { mode: string }).mode,
    format,
    instrument: resolved.instrument,
    image: {
      mimeType: "image/png",
      encoding: "base64",
      data: png.toString("base64"),
      width: rendered.width,
      height: rendered.height,
    },
    notes: resolved.notes,
    noteNames,
  });
};

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
