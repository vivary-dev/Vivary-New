import { createHash } from "node:crypto";
import path from "node:path";

import type { GovernedInput } from "../app/lib/project-evaluate-schema.ts";
import type { LocalProjectWorkspace } from "./project-services.mjs";

export type BoundActor = { kind: "human" | "agent"; id: string };
export type HostPaths = { root: string; dataDir: string };

const STRATO_REQUEST_SCHEMA = "vivary.strato-decision-request/v0";
const STRATO_POLICY_VERSION = "vivary.strato-policy/v0";
const EXO_REQUEST_SCHEMA = "vivary.exo-control-request/v0";
const AUTHORITY_CLASS = "contributor";

/**
 * "agent_" + sha256("vivary.native-agent/v1\0" + ownerActorId + "\0" + projectId), 70 ASCII bytes.
 * One id per owner and project, so claims survive across chats and never cross projects.
 */
export function projectAgentActorId(ownerActorId: string, projectId: string): string {
  return "agent_" + createHash("sha256")
    .update("vivary.native-agent/v1\0" + ownerActorId + "\0" + projectId).digest("hex");
}

/** A string the codec cannot carry without changing what it means. */
export class EvidenceCodecError extends Error {
  constructor(readonly reason: "foreign_path" | "unencodable_evidence") {
    super(reason === "foreign_path" ? "A project path leaves the project." : "The evidence cannot be shown without a host path.");
  }
}

/** The host's path rules. Tests pass `path.win32` or `path.posix` to check another host's roots. */
export type PathFlavor = Pick<typeof path, "sep" | "join" | "isAbsolute">;

const drivePrefix = /^[A-Za-z]:/;

/** Core's `canonical.normalize_path`: forward slashes, lowercase drive letter, no trailing slash. Capsules use it. */
export function coreCanonicalPath(value: string): string {
  let spelled = value.replaceAll("\\", "/");
  if (drivePrefix.test(spelled)) spelled = spelled[0].toLowerCase() + spelled.slice(1);
  return spelled.length > 1 ? spelled.replace(/\/+$/, "") : spelled;
}

// Python's casefold differs from toLowerCase for a few characters, such as
// U+00DF. A root spelled with one never matches Core's scope spelling here, and
// encodeEvidence refuses such output as unencodable instead of guessing.
const fold = (segment: string) => segment.toLowerCase().normalize("NFC");
// Close to casefold, for detection only: U+00DF upper-cases to "SS".
const looseFold = (text: string) => text.replaceAll("\\", "/").toUpperCase().toLowerCase().normalize("NFC");
const collapse = (segments: string[]) => segments.reduce<string[]>((kept, segment) => {
  if (segment === "..") kept.pop();
  else if (segment !== "" && segment !== ".") kept.push(segment);
  return kept;
}, []);

/** Core's `control_scope._normalize_scope_path` for an absolute path. Claim scopes use it. */
export function coreScopePath(value: string): string {
  const spelled = value.replaceAll("\\", "/");
  if (drivePrefix.test(spelled)) {
    const segments = collapse(spelled.slice(2).split("/")).map(fold);
    return fold(spelled.slice(0, 2)) + (spelled.slice(2).startsWith("/") ? "/" + segments.join("/") : segments.join("/"));
  }
  if (spelled.startsWith("//")) {
    const parts = spelled.split("/").filter(Boolean);
    if (parts.length >= 2 && (parts[0] === "?" || parts[0] === ".")) {
      const device = parts.slice(1);
      const joined = device.join("/");
      if (drivePrefix.test(joined)) return coreScopePath(joined.length === 2 ? joined + "/" : joined);
      if (fold(device[0]) === "unc" && device.length >= 3) return coreScopePath("//" + device.slice(1).join("/"));
    }
    if (parts.length >= 2) return "//" + [...parts.slice(0, 2), ...collapse(parts.slice(2))].map(fold).join("/");
  }
  return "/" + collapse(spelled.split("/")).join("/");
}

// The project root as it appears in evidence: the host's own spelling, the
// capsule spelling, and the claim scope spelling. On Linux all three agree.
function rootSpellings(root: string, flavor: PathFlavor) {
  const canonical = coreCanonicalPath(root);
  const scope = coreScopePath(root);
  const withSeparator = (spelled: string, separator: string) => spelled.endsWith(separator) ? spelled : spelled + separator;
  return {
    canonical, scope,
    prefixes: [[root, withSeparator(root, flavor.sep)], [canonical, withSeparator(canonical, "/")], [scope, withSeparator(scope, "/")]],
  };
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// The same spelling rule as the project read redaction: either separator, any case.
const anySpelling = (hostPath: string) => new RegExp(hostPath.split(/[\\/]/).map(escapeRegExp).join("[\\\\/]"), "gi");

type Trail = (string | number)[];
function mapStrings(value: unknown, map: (text: string, trail: Trail) => string, trail: Trail = []): unknown {
  if (typeof value === "string") return map(value, trail);
  if (Array.isArray(value)) return value.map((item, index) => mapStrings(item, map, [...trail, index]));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [map(key, trail), mapStrings(item, map, [...trail, key])]));
  }
  return value;
}

const namesProject = (text: string) => text === "." || text.startsWith("./");

/**
 * The project root reads as "." and a descendant as "./" plus the remainder,
 * byte for byte, whichever of the three root spellings it starts with, so
 * decoding restores claim ids and capsule fingerprints. Any other occurrence of
 * the root or the data directory is redacted. A string that would read as a
 * project path without being one cannot round trip.
 */
export function encodeEvidence(value: unknown, hostPaths: HostPaths, flavor: PathFlavor = path): unknown {
  const { prefixes } = rootSpellings(hostPaths.root, flavor);
  const redactions = [[hostPaths.root, "."], [hostPaths.dataDir, "<app data>"]]
    .sort((left, right) => right[0].length - left[0].length)
    .map(([hostPath, label]) => [anySpelling(hostPath), label] as const);
  const hostSpellings = [coreCanonicalPath(hostPaths.root), coreCanonicalPath(hostPaths.dataDir)].map(looseFold);
  return mapStrings(value, text => {
    for (const [root, prefix] of prefixes) {
      if (text === root) return ".";
      if (text.startsWith(prefix)) return "./" + text.slice(prefix.length);
    }
    const redacted = redactions.reduce((current, [pattern, label]) => current.replace(pattern, label), text);
    // A root spelled in a case this module cannot reproduce still fails closed.
    if (namesProject(redacted) || hostSpellings.some(spelled => looseFold(redacted).includes(spelled))) {
      throw new EvidenceCodecError("unencodable_evidence");
    }
    return redacted;
  });
}

// Core refuses a claim ledger whose scope paths are not already in its scope spelling.
const isLedgerScopePath = (trail: Trail) => trail.length === 5 && trail[0] === "claims" && typeof trail[1] === "number"
  && trail[2] === "scope" && trail[3] === "paths" && typeof trail[4] === "number";

/**
 * Reverses encodeEvidence. A claim ledger's scope paths get Core's scope
 * spelling when `ledger` is set, and every other project path gets the
 * capsule spelling. A "./" string that climbs out of the project is refused.
 */
export function decodeEvidence(value: unknown, root: string, options: { ledger?: boolean; flavor?: PathFlavor } = {}): unknown {
  const flavor = options.flavor ?? path;
  const { canonical, scope } = rootSpellings(root, flavor);
  return mapStrings(value, (text, trail) => {
    const spelled = options.ledger && isLedgerScopePath(trail) ? scope : canonical;
    if (text === ".") return spelled;
    if (!text.startsWith("./")) return text;
    const remainder = text.slice(2);
    if (remainder.includes("\0") || remainder.split(/[\\/]/).includes("..") || flavor.isAbsolute(remainder)) {
      throw new EvidenceCodecError("foreign_path");
    }
    return (spelled.endsWith("/") ? spelled : spelled + "/") + remainder;
  });
}

type Evidence = Record<string, unknown>;

/**
 * Builds the whole Strato or Exo document. Only this function writes
 * server-owned fields, and nothing in the caller's input can name one.
 */
export function governedDocument(input: GovernedInput, workspace: LocalProjectWorkspace, actor: BoundActor, now: Date,
  flavor: PathFlavor = path): string {
  const at = now.toISOString();
  const evidence = (value: unknown) => decodeEvidence(value, workspace.root, { flavor });
  if (input.operation === "decide") {
    const capsule = evidence(input.capsule) as Evidence;
    const task = capsule.task as Evidence | undefined;
    const capsuleWorkspace = capsule.workspace as Evidence | undefined;
    // Native has no capsule producer, so the fingerprint is the capsule's own
    // and Strato's workspace match checks only that the capsule agrees with itself.
    return JSON.stringify({
      schema: STRATO_REQUEST_SCHEMA, policy_version: STRATO_POLICY_VERSION, actor, authority_class: AUTHORITY_CLASS,
      workspace: { fingerprint: capsuleWorkspace?.fingerprint },
      scope: { project: workspace.projectId, paths: Array.isArray(task?.scope) ? task.scope : [] },
      requested_at: at, decision_at: at, capsule,
      ...("receipt" in input && input.receipt !== undefined ? { receipt: evidence(input.receipt) } : {}),
      ...("verdict" in input && input.verdict !== undefined ? { verdict: evidence(input.verdict) } : {}),
      ...(input.state ? { state: input.state } : {}),
      ...(input.limits ? { limits: input.limits } : {}),
    });
  }
  const control = (state: unknown, request: Evidence) =>
    JSON.stringify({ schema: EXO_REQUEST_SCHEMA, operation: input.operation,
      state: decodeEvidence(state, workspace.root, { ledger: true, flavor }), input: request });
  switch (input.operation) {
    case "claim": return control(input.state, {
      scope: { project: workspace.projectId, paths: input.paths.map(entry => flavor.join(workspace.root, entry)) },
      actor, now: at, authority_class: AUTHORITY_CLASS, ...(input.lease ? { lease: evidence(input.lease) } : {}),
    });
    case "release": return control(input.state, { claim_id: input.claim_id, actor });
    case "expire_leases": return control(input.state, { now: at });
    case "dependencies": return control(input.state, { task_id: input.task_id });
    case "task_view": case "complete": return control(input.state, {});
    case "handoff": return control(input.state, {
      claim_id: input.claim_id, receipt: evidence(input.receipt), capsule: evidence(input.capsule),
      from_actor: actor, to_actor: input.to_actor, workspace_revision: input.workspace_revision,
      created_at: at, to_authority_class: AUTHORITY_CLASS,
    });
    case "record_execution": return control(input.state, { receipt: evidence(input.receipt), capsule: evidence(input.capsule) });
  }
}
