import { z } from "zod";

const identifier = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
const safeText = z.string().refine(value => value.isWellFormed());
const encodedJsonBytes = (value: unknown) => {
  try { return new TextEncoder().encode(JSON.stringify(value)).byteLength; }
  catch { return Number.POSITIVE_INFINITY; }
};
const jsonValue: z.ZodType<unknown> = z.lazy(() => z.union([
  z.string(), z.number().finite(), z.boolean(), z.null(),
  z.array(jsonValue).max(128), z.record(z.string().max(128), jsonValue),
]));

function canonicalRevision(minimum: number) {
  return z.string().regex(/^(0|[1-9][0-9]{0,15})$/)
    .refine(value => Number.isSafeInteger(Number(value)) && Number(value) >= minimum)
    .transform(Number);
}

export const runtimeActivityRequestSchema = z.strictObject({
  projectId: identifier,
  expectedBindingRevision: canonicalRevision(1),
  expectedPolicyRevision: canonicalRevision(1),
  scopeKey: identifier,
});

const activityMetadataSchema = z.strictObject({
  type: z.enum(["thinking", "tool_start", "tool_done"]).optional(),
  tool: safeText.optional(),
  input: jsonValue.optional(),
  result: safeText.optional(),
  errorCode: safeText.optional(),
  reason: safeText.optional(),
});

export const runtimeActivityItemSchema = z.strictObject({
  id: safeText,
  runId: identifier,
  kind: z.enum(["system", "artifact", "status", "note"]),
  message: safeText,
  createdAt: z.iso.datetime(),
  metadata: activityMetadataSchema.optional(),
});

const boundedRuntimeActivityItemSchema = runtimeActivityItemSchema
  .refine(value => encodedJsonBytes(value) <= 8 * 1024);

const nativeRuntimeScopeSchema = z.strictObject({
  type: z.literal("vivary-project-runtime-v1"),
  id: z.string().regex(/^[0-9a-f]{64}$/),
});

const activity = z.strictObject({
  code: z.literal("activity"),
  projectId: identifier,
  scopeKey: identifier,
  bindingRevision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  policyRevision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  referenceRevision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  nativeThreadId: identifier,
  nativeScope: nativeRuntimeScopeSchema,
  nativeRunId: identifier,
  items: z.array(boundedRuntimeActivityItemSchema).max(128),
}).refine(value => encodedJsonBytes(value) <= 256 * 1024);

export const runtimeActivityResultSchema = z.union([
  z.strictObject({ code: z.enum([
    "denied", "stale-claim", "ambiguous-binding", "unavailable", "activity-too-large",
  ]) }),
  activity,
]);

export type RuntimeActivityItem = z.infer<typeof runtimeActivityItemSchema>;
export type RuntimeActivityResult = z.infer<typeof runtimeActivityResultSchema>;
