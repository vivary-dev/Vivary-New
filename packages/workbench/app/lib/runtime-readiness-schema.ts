import { z } from "zod";

const identifier = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
const evidenceCode = z.enum([
  "package-inventory",
  "trusted-configuration",
  "runtime-authentication",
  "runtime-authority",
  "current-binding",
  "root-observation",
  "runtime-execution",
  "verification-receipt",
]);

function canonicalRevision(minimum: number) {
  return z.string().regex(/^(0|[1-9][0-9]{0,15})$/)
    .refine(value => Number.isSafeInteger(Number(value)) && Number(value) >= minimum)
    .transform(Number);
}

const evidence = z.array(evidenceCode).min(1).max(8)
  .refine(codes => new Set(codes).size === codes.length);
const observation = z.discriminatedUnion("state", [
  z.strictObject({ state: z.literal("unknown") }),
  z.strictObject({ state: z.enum(["available", "unavailable"]), evidence }),
]);

export const runtimeReadinessRequestSchema = z.strictObject({
  projectId: identifier,
  expectedBindingRevision: canonicalRevision(1),
  expectedPolicyRevision: canonicalRevision(1),
  scopeKey: identifier,
});

export const runtimeReadinessBlockerSchema = z.enum([
  "runtime-package-missing",
  "runtime-unconfigured",
  "runtime-authentication-unknown",
  "runtime-authentication-unavailable",
  "runtime-authority-unknown",
  "runtime-authority-unavailable",
  "binding-unavailable",
  "runtime-runnability-unknown",
  "runtime-unavailable",
  "verification-unknown",
  "runtime-unverified",
]);

const readiness = z.strictObject({
  code: z.literal("readiness"),
  projectId: identifier,
  scopeKey: identifier,
  bindingRevision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  policyRevision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  observations: z.strictObject({
    installed: observation,
    configured: observation,
    authenticated: observation,
    bound: observation,
    runnable: observation,
    verified: observation,
  }),
  blockers: z.array(runtimeReadinessBlockerSchema).max(11)
    .refine(codes => new Set(codes).size === codes.length),
}).superRefine((value, context) => {
  const allAvailable = Object.values(value.observations)
    .every(item => item.state === "available");
  if ((value.blockers.length === 0) !== allAvailable) {
    context.addIssue({ code: "custom", message: "blockers must match the readiness observations" });
  }
});

export const runtimeReadinessResultSchema = z.union([
  z.strictObject({ code: z.enum(["denied", "stale-claim", "ambiguous-binding", "unavailable"]) }),
  readiness,
]);

export type RuntimeReadinessRequest = z.infer<typeof runtimeReadinessRequestSchema>;
export type RuntimeReadinessResult = z.infer<typeof runtimeReadinessResultSchema>;
export type RuntimeReadiness = Extract<RuntimeReadinessResult, { code: "readiness" }>;
export type RuntimeReadinessObservation = RuntimeReadiness["observations"][keyof RuntimeReadiness["observations"]];
export type RuntimeReadinessBlocker = z.infer<typeof runtimeReadinessBlockerSchema>;
