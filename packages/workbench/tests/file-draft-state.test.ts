import assert from "node:assert/strict";
import test from "node:test";
import { parseFileDraft, storedFileDraft, restoreFileLineEndings } from "../app/lib/file-draft-state.ts";

test("a cleared draft survives Native's null-body normalization", () => {
  const nativeBody = (body: string) => JSON.parse(body) ?? {};
  assert.equal(parseFileDraft(nativeBody(JSON.stringify(storedFileDraft(null)))), null);
});

test("an unsaved draft round-trips without changing source or its base", () => {
  const draft = { content: "# Work\n\nUnsent edits.\n", baseContent: "# Work\n", baseVersion: "pf_previous" };
  assert.deepEqual(parseFileDraft(JSON.parse(JSON.stringify(storedFileDraft(draft)))), draft);
});

test("retained preview drafts and exact empty clear values remain readable", () => {
  const legacy = { content: "draft", baseContent: "base", baseVersion: "pf_previous" };
  assert.deepEqual(parseFileDraft(legacy), legacy);
  assert.equal(parseFileDraft({}), null);
  assert.equal(parseFileDraft(null), null);
});

test("a damaged or unknown stored draft is not silently discarded", () => {
  assert.throws(() => parseFileDraft({ version: 2, draft: null }));
  assert.throws(() => parseFileDraft({ content: "retain me" }));
  assert.throws(() => parseFileDraft([]));
});

test("source editing retains CRLF, LF, and CR newline conventions", () => {
  assert.equal(restoreFileLineEndings("one\ntwo changed\n", "one\r\ntwo\r\n"), "one\r\ntwo changed\r\n");
  assert.equal(restoreFileLineEndings("one\ntwo changed\n", "one\ntwo\n"), "one\ntwo changed\n");
  assert.equal(restoreFileLineEndings("one\ntwo changed\n", "one\rtwo\r"), "one\rtwo changed\r");
  assert.equal(restoreFileLineEndings("new\nline", ""), "new\nline");
});
