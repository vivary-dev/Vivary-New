import assert from "node:assert/strict";
import test from "node:test";

import {
  CONTROL_FIELDS, STATE_SHAPE, STATE_TEMPLATES, actorLine, controlRequest, decideRequest, emptyControlDraft, emptyDecideDraft,
  reasonCodes, returnedState, shownOutput,
} from "../app/lib/project-evaluate-form.ts";
import { CONTROL_OPERATIONS, projectEvaluateOwnInputSchema, projectEvaluateToolInputSchema } from "../app/lib/project-evaluate-schema.ts";

const capsule = { schema: "vivary.task-capsule/v0", task: { scope: ["src"] } };

test("invalid JSON is reported in a plain sentence and builds no request", () => {
  assert.deepEqual(decideRequest({ ...emptyDecideDraft(), capsule: "{\"task\": " }, "me"),
    { ok: false, message: "The Task Capsule is not valid JSON. Check for a missing quote, comma, or bracket." });
  assert.deepEqual(decideRequest({ ...emptyDecideDraft(), capsule: "[]" }, "me"),
    { ok: false, message: "The Task Capsule must be a JSON object in braces." });
  assert.deepEqual(decideRequest(emptyDecideDraft(), "agent"), { ok: false, message: "Enter the Task Capsule as JSON." });
  assert.deepEqual(controlRequest({ ...emptyControlDraft(), paths: "src", states: { ...STATE_TEMPLATES, claims: "{claims: []}" } }, {}),
    { ok: false, message: "The state is not valid JSON. Check for a missing quote, comma, or bracket." });
  assert.deepEqual(decideRequest({ ...emptyDecideDraft(), capsule: "{}", turns_used: "1.5" }, "me"),
    { ok: false, message: "Turns used must be a whole number of 0 or more." });
});

test("decide sends receipt and verdict only as the owner, and budgets only when given", () => {
  const draft = { ...emptyDecideDraft(), capsule: JSON.stringify(capsule), turns_used: "2", max_actions: "9",
    receipt: "{\"ok\": true}", verdict: "\"pass\"" };
  const me = decideRequest(draft, "me");
  assert.deepEqual(me, { ok: true, input: { operation: "decide", capsule, state: { turns_used: 2 }, limits: { max_actions: 9 },
    receipt: { ok: true }, verdict: "pass" } });
  const agent = decideRequest(draft, "agent");
  assert.deepEqual(agent, { ok: true, input: { operation: "decide", capsule, state: { turns_used: 2 }, limits: { max_actions: 9 } } });
  assert.ok(me.ok && projectEvaluateOwnInputSchema.safeParse(me.input).success);
  assert.ok(agent.ok && projectEvaluateToolInputSchema.safeParse(agent.input).success);
  assert.deepEqual(decideRequest({ ...emptyDecideDraft(), capsule: "{}" }, "me"), { ok: true, input: { operation: "decide", capsule: {} } });
});

test("control sends only the selected operation's fields, and each built request passes the owner schema", () => {
  const known = { human: "actor_owner", agent: "agent_project" };
  const filled = { ...emptyControlDraft(), paths: " src/api \n\n docs \n", lease: "", claim_id: " c1 ", task_id: "t1",
    receipt: "{}", capsule: "{}", workspace_revision: "rev" };
  const expected = {
    claim: { operation: "claim", state: { claims: [] }, paths: ["src/api", "docs"] },
    release: { operation: "release", state: { claims: [] }, claim_id: "c1" },
    expire_leases: { operation: "expire_leases", state: { claims: [] } },
    dependencies: { operation: "dependencies", state: { tasks: [] }, task_id: "t1" },
    task_view: { operation: "task_view", state: { task: {}, execution_log: [] } },
    complete: { operation: "complete", state: { task: {}, execution_log: [] } },
    handoff: { operation: "handoff", state: { claims: [] }, claim_id: "c1", receipt: {}, capsule: {},
      to_actor: { kind: "agent", id: "agent_project" }, workspace_revision: "rev" },
    record_execution: { operation: "record_execution", state: { execution_log: [] }, receipt: {}, capsule: {} },
  };
  for (const operation of CONTROL_OPERATIONS) {
    const built = controlRequest({ ...filled, operation }, known);
    assert.deepEqual(built, { ok: true, input: expected[operation] }, operation);
    assert.ok(built.ok && projectEvaluateOwnInputSchema.safeParse(built.input).success, operation);
  }
  assert.deepEqual(Object.keys(CONTROL_FIELDS).sort(), [...CONTROL_OPERATIONS].sort());
  assert.deepEqual(Object.keys(STATE_SHAPE).sort(), [...CONTROL_OPERATIONS].sort());
});

test("required control fields and an unknown handoff recipient are refused in the panel", () => {
  assert.deepEqual(controlRequest({ ...emptyControlDraft(), paths: " \n " }, {}),
    { ok: false, message: "Enter at least one path, such as src/api." });
  assert.deepEqual(controlRequest({ ...emptyControlDraft(), operation: "release" }, {}), { ok: false, message: "Enter a claim id." });
  assert.deepEqual(controlRequest({ ...emptyControlDraft(), operation: "claim", paths: "src", lease: "7" }, {}),
    { ok: false, message: "The lease must be a JSON object in braces." });
  const handoff = { ...emptyControlDraft(), operation: "handoff" as const, claim_id: "c1", receipt: "{}", capsule: "{}" };
  assert.deepEqual(controlRequest(handoff, { human: "actor_owner" }),
    { ok: false, message: "Run one evaluation as this project's agent first, so the panel knows its actor id." });
  assert.deepEqual(controlRequest({ ...handoff, to_actor: "me" }, { human: "actor_owner" }).ok, true);
});

test("a returned claim ledger feeds the next request, so claim then release needs no retyping", () => {
  const claims = [{ claim_id: "c1", actor: { kind: "agent", id: "agent_project" }, scope: { paths: ["./src"] } }];
  const claimed = { schema: "vivary.exo-control-result/v0", operation: "claim",
    result: { decision: "granted", reason_codes: [], claim: claims[0], claims, conflicts: [] } };
  const returned = returnedState("claim", claimed);
  assert.deepEqual(returned && { ...returned, text: JSON.parse(returned.text) }, { shape: "claims", text: { claims }, claimId: "c1" });

  const draft = { ...emptyControlDraft(), operation: "release" as const, claim_id: returned!.claimId!,
    states: { ...STATE_TEMPLATES, [returned!.shape]: returned!.text } };
  assert.deepEqual(controlRequest(draft, {}), { ok: true, input: { operation: "release", state: { claims }, claim_id: "c1" } });

  const released = { schema: "vivary.exo-control-result/v0", operation: "release", result: { decision: "released", reason_codes: [], claims: [] } };
  assert.deepEqual(returnedState("release", released), { shape: "claims", text: JSON.stringify({ claims: [] }, null, 2) });
  const recorded = { schema: "vivary.exo-control-result/v0", operation: "record_execution", result: { edges: [{ id: "e" }], added: 1, reason_codes: [] } };
  assert.deepEqual(returnedState("record_execution", recorded)?.text, JSON.stringify({ execution_log: [{ id: "e" }] }, null, 2));
  assert.equal(returnedState("dependencies", { operation: "dependencies", result: { ready: true } }), null);
  assert.equal(returnedState("claim", { schema: "vivary.exo-control-refusal/v0", reason_codes: ["x"] }), null);
});

test("reason codes, shown output, and the actor line", () => {
  assert.deepEqual(reasonCodes({ schema: "vivary.exo-control-refusal/v0", reason_codes: ["invalid_state"] }), ["invalid_state"]);
  assert.deepEqual(reasonCodes({ schema: "vivary.strato-decision/v0", decision: "act", reason_codes: ["a", "b"] }), ["a", "b"]);
  assert.deepEqual(reasonCodes({ operation: "claim", result: { reason_codes: ["claim_conflict"] } }), ["claim_conflict"]);
  assert.deepEqual(reasonCodes({ operation: "dependencies", result: { ready: true } }), []);
  assert.deepEqual(shownOutput({ operation: "claim", result: { claims: [] } }), { claims: [] });
  assert.deepEqual(shownOutput({ decision: "act" }), { decision: "act" });
  assert.equal(actorLine({ kind: "human", id: "a", authorityClass: "contributor", role: "owner" }), "Evaluated as you (human, contributor)");
  assert.equal(actorLine({ kind: "agent", id: "b", authorityClass: "contributor", role: "project-agent" }),
    "Evaluated as this project's agent (agent, contributor)");
});
