import { triggerDownload } from "@/lib/scaleExport";

/**
 * Render the tab staff SVG inside `container` into a single-page PDF sized to the
 * staff, scaled to fit a Letter page. Uses jspdf + svg2pdf.js, loaded on demand.
 */
export async function downloadPdfFromContainer(
  container: HTMLElement | null,
  filename: string,
) {
  if (!container) return;
  const svg = container.querySelector("svg");
  if (!svg) return;

  const w = svg.width.baseVal.value || svg.viewBox.baseVal.width;
  const h = svg.height.baseVal.value || svg.viewBox.baseVal.height;
  if (!w || !h) return;

  const { jsPDF } = await import("jspdf");
  await import("svg2pdf.js"); // augments jsPDF with the async .svg() method

  const orientation = w > h ? "landscape" : "portrait";
  const pdf = new jsPDF({ orientation, unit: "pt", format: "letter" });
  const margin = 36;
  const pageW = pdf.internal.pageSize.getWidth();
  const scale = Math.min(1, (pageW - margin * 2) / w);

  // svg2pdf augments the instance with `.svg()` at runtime.
  await (pdf as unknown as {
    svg: (el: SVGElement, o: { x: number; y: number; width: number; height: number }) => Promise<void>;
  }).svg(svg, { x: margin, y: margin, width: w * scale, height: h * scale });

  const blob = pdf.output("blob");
  const url = URL.createObjectURL(blob);
  triggerDownload(url, filename);
  URL.revokeObjectURL(url);
}
