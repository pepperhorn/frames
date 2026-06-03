import { chromium, type Browser, type Page } from "playwright";
import type { FrameSpec } from "./types";

/**
 * Headless Chromium rendering path. Used for style="handdrawn" (and any
 * other spec that real-browser rendering is required for). The page at
 * /render-host loads our renderFrameInto from the same lib the UI uses, so
 * output matches the client exactly.
 *
 * Browser + page are reused across requests. First call pays the cold-start
 * cost (~500ms). Subsequent calls reuse the same page (~100ms each).
 */

let browser: Browser | null = null;
let page: Page | null = null;
let initPromise: Promise<void> | null = null;

function hostUrl(): string {
  // Same Node process is serving /render-host; talk to it on localhost.
  const port = process.env.PORT ?? "4321";
  return `http://127.0.0.1:${port}/render-host`;
}

async function ensurePage(): Promise<Page> {
  if (page && !page.isClosed()) return page;
  if (!initPromise) {
    initPromise = (async () => {
      browser = await chromium.launch({ args: ["--no-sandbox"] });
      const ctx = await browser.newContext();
      const p = await ctx.newPage();
      await p.goto(hostUrl(), { waitUntil: "networkidle" });
      await p.waitForFunction(() => (window as { __rendererReady?: boolean }).__rendererReady === true);
      page = p;
    })();
  }
  await initPromise;
  return page!;
}

export async function renderFrameInBrowser(spec: FrameSpec): Promise<string> {
  const p = await ensurePage();
  const out = await p.evaluate(async (s) => {
    type RenderFn = (spec: unknown) => Promise<string | null>;
    const fn = (window as unknown as { renderFrame: RenderFn }).renderFrame;
    return fn(s);
  }, spec as unknown);
  if (!out) throw new Error("browser renderer produced no SVG");
  return out;
}

export async function shutdownBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
    page = null;
    initPromise = null;
  }
}
