declare module "svgdom" {
  export function createSVGWindow(): {
    document: Document;
    [key: string]: unknown;
  };
  export function createHTMLWindow(): {
    document: Document;
    [key: string]: unknown;
  };
}
