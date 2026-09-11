import { describe, expect, it } from "vitest";
import { previewDocument, previewUrl } from "../app/lib/workbench-preview";

describe("workbench previews", () => {
  it("resolves workspace links using the active origin", () => {
    expect(previewUrl("/design", "https://workspace.example")).toBe("https://workspace.example/design");
  });

  it.each(["javascript:alert(1)", "data:text/html,test", "file:///example.html", "https://user:password@example.com"])("rejects unsafe address %s", (value) => {
    expect(() => previewUrl(value, "https://workspace.example")).toThrow();
  });

  it("puts a restrictive policy before generated content", () => {
    const output = previewDocument("<script>fetch('/private')</script>");
    expect(output.indexOf("Content-Security-Policy")).toBeLessThan(output.indexOf("<script>"));
    expect(output).toContain("connect-src 'none'");
    expect(output).toContain("form-action 'none'");
    expect(output).not.toContain("script-src 'unsafe-inline' https:");
  });
});
