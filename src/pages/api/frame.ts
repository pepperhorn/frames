import type { APIRoute } from "astro";
import { renderFrameToSvg } from "@/lib/render/server";
import type { FrameSpec } from "@/lib/render/types";

export const prerender = false;

const MAX_DOTS = 200;
const MAX_FINGERS = 64;

function isFrameSpec(value: unknown): value is FrameSpec {
  if (!value || typeof value !== "object") return false;
  const v = value as { kind?: unknown };
  return v.kind === "chord" || v.kind === "scale";
}

function validateSize(spec: FrameSpec): string | null {
  if (spec.kind === "scale" && spec.frame?.dots?.length > MAX_DOTS) {
    return `scale.frame.dots exceeds limit of ${MAX_DOTS}`;
  }
  if (spec.kind === "chord" && spec.chord?.fingers?.length > MAX_FINGERS) {
    return `chord.fingers exceeds limit of ${MAX_FINGERS}`;
  }
  return null;
}

export const POST: APIRoute = async ({ request }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid JSON body" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  if (!isFrameSpec(body)) {
    return new Response(
      JSON.stringify({
        error: "body must be a FrameSpec with kind: 'chord' | 'scale'",
      }),
      { status: 400, headers: { "content-type": "application/json" } },
    );
  }

  const sizeError = validateSize(body);
  if (sizeError) {
    return new Response(JSON.stringify({ error: sizeError }), {
      status: 413,
      headers: { "content-type": "application/json" },
    });
  }

  try {
    const { svg } = await renderFrameToSvg(body);
    return new Response(svg, {
      status: 200,
      headers: {
        "content-type": "image/svg+xml; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
};

export const GET: APIRoute = () =>
  new Response(
    JSON.stringify({
      message: "POST a FrameSpec JSON body to render an SVG.",
      example: {
        kind: "chord",
        chord: {
          title: "C",
          fingers: [
            [5, 3],
            [4, 2],
            [2, 1],
            [1, 0],
            [6, "x"],
          ],
          barres: [],
        },
      },
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
