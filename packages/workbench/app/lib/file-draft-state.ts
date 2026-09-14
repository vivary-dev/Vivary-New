import { z } from "zod";

const draftSchema = z.strictObject({
  content: z.string(), baseVersion: z.string(), baseContent: z.string(),
});
export type FileDraft = z.infer<typeof draftSchema>;
const storedSchema = z.strictObject({ version: z.literal(1), draft: draftSchema.nullable() });

export function storedFileDraft(draft: FileDraft | null) {
  // Native's body reader converts a top-level null to {}, so keep null nested.
  return { version: 1 as const, draft };
}

export function parseFileDraft(value: unknown): FileDraft | null {
  if (value == null) return null;
  // Earlier preview saves cleared this exclusively owned key to an empty object.
  if (typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0) return null;
  if (typeof value === "object" && "version" in value) return storedSchema.parse(value).draft;
  return draftSchema.parse(value);
}

export function restoreFileLineEndings(content: string, baseContent: string): string {
  const newline = baseContent.match(/\r\n|\r|\n/)?.[0] ?? "\n";
  return content.replace(/\r\n|\r|\n/g, newline);
}
