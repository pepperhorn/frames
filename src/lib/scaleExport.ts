export interface SvgSource {
  source: string;
  width: number;
  height: number;
}

export function getSvgSource(container: HTMLElement | null): SvgSource | null {
  const svg = container?.querySelector("svg");
  if (!svg) return null;
  const clone = svg.cloneNode(true) as SVGSVGElement;
  if (!clone.getAttribute("xmlns")) {
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  }
  const bbox = svg.getBoundingClientRect();
  const vb = svg.getAttribute("viewBox")?.split(/[\s,]+/).map(Number);
  const width = vb && vb.length === 4 ? vb[2] : bbox.width || 400;
  const height = vb && vb.length === 4 ? vb[3] : bbox.height || 500;
  return {
    source: new XMLSerializer().serializeToString(clone),
    width,
    height,
  };
}

export function triggerDownload(href: string, name: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function safeFilename(parts: Array<string | undefined>, ext: string): string {
  const cleaned = parts
    .filter((p): p is string => Boolean(p && p.trim()))
    .map((p) => p.replace(/[^\w\-]+/g, "_"));
  const base = cleaned.length ? cleaned.join("-") : "frame";
  return `${base}.${ext}`;
}

export function downloadSvgFromContainer(container: HTMLElement | null, filename: string) {
  const data = getSvgSource(container);
  if (!data) return;
  const blob = new Blob([data.source], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  triggerDownload(url, filename);
  URL.revokeObjectURL(url);
}

export function downloadPngFromContainer(
  container: HTMLElement | null,
  filename: string,
  options: { backgroundColor?: string; scale?: number } = {},
) {
  const data = getSvgSource(container);
  if (!data) return;
  const scale = options.scale ?? 3;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(data.width * scale);
  canvas.height = Math.round(data.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const img = new Image();
  const svgUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(data.source)}`;
  img.onload = () => {
    if (options.backgroundColor && options.backgroundColor !== "transparent") {
      ctx.fillStyle = options.backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      triggerDownload(url, filename);
      URL.revokeObjectURL(url);
    }, "image/png");
  };
  img.onerror = () => {
    console.error("Failed to load SVG for PNG export");
  };
  img.src = svgUrl;
}
