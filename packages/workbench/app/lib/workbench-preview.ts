export function previewUrl(value: string, origin: string): string {
  const url = new URL(value, origin);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Use an HTTP or HTTPS address.");
  }
  if (url.username || url.password) {
    throw new Error("Use an address without embedded credentials.");
  }
  return url.href;
}

export function previewDocument(html: string): string {
  // The iframe also omits allow-same-origin. Keep generated code isolated.
  const policy = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src https: data:; font-src https:; connect-src 'none'; form-action 'none'; base-uri 'none'";
  return `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="${policy}"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>${html}</body></html>`;
}
