import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  createCodeAgentRunRecord,
  listCodeAgentTranscriptEvents,
  type CodeAgentTranscriptEvent,
} from "@agent-native/core/code-agents";
import codeStateAction from "../actions/vivary-code-state.ts";
import codeApproveAction from "../actions/vivary-code-approve.ts";
import codeDenyAction from "../actions/vivary-code-deny.ts";

import {
  approveVivaryCodeMessage,
  buildVivaryCodeFollowUpPrompt,
  denyVivaryCodeMessage,
  getVivaryCodeFiles,
  getVivaryCodeHostState,
  requireVivaryCodeUser,
  VIVARY_CODE_DEFAULT_MODEL,
  VIVARY_CODE_MODELS,
  resolveVivaryCodeModel,
  isVivaryAppRun,
  sendVivaryCodeMessage,
} from "../server/local-code-agent.ts";

const temporaryRoots: string[] = [];

afterEach(async () => {
  // guard:allow-env-credential - Isolated test workspace path.
  delete process.env.VIVARY_LOCAL_AGENT_WORKSPACE; // guard:allow-env-credential - Isolated test runtime configuration, not user credentials.
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("local Vivary code agent boundaries", () => {
  it("offers only the supported Claude model aliases", () => {
    assert.deepEqual(VIVARY_CODE_MODELS, ["sonnet", "opus", "fable"]);
    assert.equal(VIVARY_CODE_DEFAULT_MODEL, "sonnet");
  });

  it("keeps each runtime's model selection in its own model family", () => {
    assert.equal(resolveVivaryCodeModel("claude-cli"), "sonnet");
    assert.equal(resolveVivaryCodeModel("codex-cli"), "default");
    assert.equal(resolveVivaryCodeModel("claude-cli", "opus"), "opus");
    assert.throws(() => resolveVivaryCodeModel("claude-cli", "default"), { errorCode: "vivary_code_model_unsupported" });
    assert.throws(() => resolveVivaryCodeModel("codex-cli", "opus"), { errorCode: "vivary_code_model_unsupported" });
  });

  it("requires an authenticated owner and reads only bounded workspace files", async () => {
    assert.throws(
      () => requireVivaryCodeUser(),
      /could not confirm access to this local workspace/,
    );
    assert.equal(
      requireVivaryCodeUser({ caller: "frontend", userEmail: "OWNER@Example.com" }),
      "owner@example.com",
    );

    const workspace = await mkdtemp(path.join(os.tmpdir(), "vivary-code-test-"));
    temporaryRoots.push(workspace);
    // guard:allow-env-credential - Isolated test workspace path.
    process.env.VIVARY_LOCAL_AGENT_WORKSPACE = workspace; // guard:allow-env-credential - Isolated test runtime configuration, not user credentials.
    await writeFile(path.join(workspace, "result.md"), "# Visible result\n", "utf8");
    await writeFile(path.join(workspace, "blocked.js"), "export {};\n", "utf8");

    const listing = await getVivaryCodeFiles();
    assert.deepEqual(listing.files.map((file) => file.path), ["result.md"]);

    const result = await getVivaryCodeFiles("result.md");
    assert.deepEqual(result.file, {
      path: "result.md",
      name: "result.md",
      sizeBytes: 17,
      updatedAt: result.file?.updatedAt,
      content: "# Visible result\n",
    });

    await assert.rejects(getVivaryCodeFiles("../outside.md"), {
      errorCode: "vivary_code_file_path_blocked",
    });
    await assert.rejects(getVivaryCodeFiles("blocked.js"), {
      errorCode: "vivary_code_file_type_blocked",
    });
  });

  it("keeps project history bound to the registered root even when paths match", () => {
    const workspace = { root: "/workspace/alpha", label: "Alpha", projectId: "project_alpha",
      bindingId: "binding_alpha", rootId: "root_alpha" };
    const run = { goalId: "vivary-local-code", cwd: workspace.root, metadata: {
      app: "vivary-workbench-local-code", workspaceRoot: workspace.root,
      projectId: workspace.projectId, bindingId: workspace.bindingId, rootId: workspace.rootId,
    } };
    assert.equal(isVivaryAppRun(run, workspace), true);
    assert.equal(isVivaryAppRun(run, { ...workspace, projectId: "project_beta" }), false);
    assert.equal(isVivaryAppRun(run, { ...workspace, rootId: "root_replaced" }), false);
    assert.equal(isVivaryAppRun(run, { root: workspace.root, label: "Default workspace" }), false);
    assert.equal(isVivaryAppRun(run, { ...workspace, root: "/workspace/beta" }), false);
  });

  it("keeps host status separate from project and transcript requests", () => {
    assert.deepEqual(codeStateAction.schema.parse({ scope: "host" }), { scope: "host" });
    assert.deepEqual(codeStateAction.schema.parse({}), {});
    assert.deepEqual(codeStateAction.schema.parse({ projectId: "project_alpha", runId: "run_alpha" }),
      { projectId: "project_alpha", runId: "run_alpha" });
    assert.equal(codeStateAction.schema.safeParse({ scope: "host", projectId: "project_alpha" }).success, false);
    assert.equal(codeStateAction.schema.safeParse({ scope: "host", runId: "run_alpha" }).success, false);
    assert.equal(codeStateAction.schema.safeParse({ scope: "project" }).success, false);
  });

  it("binds approval controls to strict run, request, and project identifiers", () => {
    const input = {
      projectId: "project_alpha",
      runId: "run_alpha",
      requestId: "11111111-1111-4111-8111-111111111111",
    };
    assert.deepEqual(codeApproveAction.schema.parse(input), input);
    assert.deepEqual(codeDenyAction.schema.parse(input), input);
    assert.equal(codeApproveAction.schema.safeParse({ ...input, requestId: "stale" }).success, false);
    assert.equal(codeDenyAction.schema.safeParse({ ...input, unexpected: true }).success, false);
    assert.equal(codeApproveAction.agentTool, false);
    assert.equal(codeDenyAction.agentTool, false);
  });

  it("retains owner-only Stop metadata when a project and Personal workspace are unavailable", async () => {
    const store = await mkdtemp(path.join(os.tmpdir(), "vivary-code-host-test-"));
    temporaryRoots.push(store);
    // guard:allow-env-credential - Preserve the Native record-store directory around this isolated test.
    const originalStore = process.env.AGENT_NATIVE_CODE_AGENTS_HOME;
    // guard:allow-env-credential - Isolated Native record-store directory, containing synthetic records only.
    process.env.AGENT_NATIVE_CODE_AGENTS_HOME = store;
    // guard:allow-env-credential - Deliberately missing local workspace verifies that host state never resolves it.
    process.env.VIVARY_LOCAL_AGENT_WORKSPACE = path.join(store, "missing-personal"); // guard:allow-env-credential - Isolated test runtime configuration, not user credentials.
    const host: unknown = Reflect.get(globalThis, Symbol.for("vivary.workbench.code-host"));
    assert.ok(host && typeof host === "object" && "activeRuns" in host && host.activeRuns instanceof Map);
    const controller = new AbortController();
    const timeout = setTimeout(() => undefined, 10_000);
    const runId = "host-state-test";
    try {
      assert.deepEqual(await getVivaryCodeHostState("owner@example.com"), {
        activeRun: null, pendingApproval: null, recentRun: null, busy: false,
      });
      createCodeAgentRunRecord({
        id: runId, goalId: "vivary-local-code", title: "Disconnected project", status: "running",
        cwd: path.join(store, "missing-project"),
        metadata: { app: "vivary-workbench-local-code", ownerEmail: "owner@example.com", projectId: "project_alpha" },
      });
      host.activeRuns.set(runId, { controller, timeout, ownerEmail: "owner@example.com", execution: null, stopReason: null });
      assert.deepEqual(await codeStateAction.run({ scope: "host" }, { caller: "frontend", userEmail: "owner@example.com" }), {
        activeRun: { id: runId, title: "Disconnected project", projectId: "project_alpha" },
        pendingApproval: null, recentRun: null, busy: true,
      });
      assert.deepEqual(await getVivaryCodeHostState("other@example.com"), {
        activeRun: null, pendingApproval: null, recentRun: null, busy: true,
      });
    } finally {
      host.activeRuns.delete(runId);
      clearTimeout(timeout);
      // guard:allow-env-credential - Restore the previous nonsecret Native store path exactly.
      if (originalStore === undefined) delete process.env.AGENT_NATIVE_CODE_AGENTS_HOME;
      // guard:allow-env-credential - Restore the previous nonsecret Native store path exactly.
      else process.env.AGENT_NATIVE_CODE_AGENTS_HOME = originalStore;
    }
  });

  it("stages an exact approval, revalidates it, and denies without launching or adding a user prompt", async () => {
    const store = await mkdtemp(path.join(os.tmpdir(), "vivary-code-approval-test-"));
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "vivary-code-workspace-test-"));
    const bin = await mkdtemp(path.join(os.tmpdir(), "vivary-code-bin-test-"));
    temporaryRoots.push(store, workspaceRoot, bin);
    const executable = path.join(bin, "claude");
    await writeFile(executable, `#!/usr/bin/env node
if (JSON.stringify(process.argv.slice(2)) !== '["auth","status","--json"]') process.exit(2);
process.stdout.write('{"loggedIn":true}');
`, { mode: 0o755 });
    const previous = {
      store: process.env.AGENT_NATIVE_CODE_AGENTS_HOME,
      path: process.env.PATH, // guard:allow-env-credential - Isolated test runtime configuration, not user credentials.
      mode: process.env.VIVARY_ACCESS_MODE, // guard:allow-env-credential - Isolated test runtime configuration, not user credentials.
      workspace: process.env.VIVARY_LOCAL_AGENT_WORKSPACE, // guard:allow-env-credential - Isolated test runtime configuration, not user credentials.
    };
    const workspace = {
      root: workspaceRoot,
      label: "Approval project",
      projectId: "project_approval",
      bindingId: "binding_approval",
      rootId: "root_approval",
      bindingRevision: 3,
    };
    try {
      process.env.AGENT_NATIVE_CODE_AGENTS_HOME = store;
      process.env.PATH = bin + path.delimiter + (previous.path ?? ""); // guard:allow-env-credential - Isolated test runtime configuration, not user credentials.
      process.env.VIVARY_ACCESS_MODE = "local"; // guard:allow-env-credential - Isolated test runtime configuration, not user credentials.

      const staged = await sendVivaryCodeMessage({
        ownerEmail: "owner@example.com",
        orgId: "org-alpha",
        message: "Change the project after I approve.",
        engine: "claude-cli",
        model: "sonnet",
        workspace,
        revalidateWorkspace: async () => workspace,
      });
      assert.equal(staged.run?.status, "needs-approval");
      assert.deepEqual(staged.pendingApproval, {
        runId: staged.run?.id,
        requestId: staged.pendingApproval?.requestId,
        title: "Change the project after I approve.",
        message: "Change the project after I approve.",
        projectId: "project_approval",
        workspaceLabel: "Approval project",
        engine: "claude-cli",
        engineLabel: "Claude Code",
        model: "sonnet",
        timeoutMs: 120_000,
        continuesAfterBrowserClose: true,
      });
      assert.ok(staged.pendingApproval?.requestId);
      assert.deepEqual(
        listCodeAgentTranscriptEvents(staged.run!.id).map(event => event.kind),
        ["status"],
      );
      const host = await getVivaryCodeHostState("owner@example.com", "org-alpha");
      assert.equal(host.busy, true);
      assert.equal(host.activeRun, null);
      assert.equal(host.pendingApproval?.requestId, staged.pendingApproval?.requestId);
      const otherOrg = await getVivaryCodeHostState("owner@example.com", "org-beta");
      assert.equal(otherOrg.pendingApproval, null);
      assert.equal(otherOrg.busy, true);

      await assert.rejects(
        sendVivaryCodeMessage({
          ownerEmail: "owner@example.com",
          message: "A second request must not take the host slot.",
          workspace,
        }),
        { errorCode: "vivary_code_run_active" },
      );
      await assert.rejects(
        approveVivaryCodeMessage({
          ownerEmail: "owner@example.com",
          orgId: "org-alpha",
          runId: staged.run!.id,
          requestId: staged.pendingApproval!.requestId,
          workspace,
          revalidateWorkspace: async () => ({ ...workspace, bindingRevision: 4 }),
        }),
        { errorCode: "vivary_code_approval_project_changed" },
      );
      assert.equal((await getVivaryCodeHostState("owner@example.com", "org-alpha")).activeRun, null);
      await assert.rejects(
        denyVivaryCodeMessage({
          ownerEmail: "other@example.com",
          orgId: "org-alpha",
          runId: staged.run!.id,
          requestId: staged.pendingApproval!.requestId,
          projectId: workspace.projectId,
        }),
        { errorCode: "vivary_code_run_not_found" },
      );

      await assert.rejects(
        denyVivaryCodeMessage({
          ownerEmail: "owner@example.com",
          orgId: "org-beta",
          runId: staged.run!.id,
          requestId: staged.pendingApproval!.requestId,
          projectId: workspace.projectId,
        }),
        { errorCode: "vivary_code_run_not_found" },
      );

      await rm(workspaceRoot, { recursive: true, force: true });
      const denied = await denyVivaryCodeMessage({
        ownerEmail: "owner@example.com",
        orgId: "org-alpha",
        runId: staged.run!.id,
        requestId: staged.pendingApproval!.requestId,
        projectId: workspace.projectId,
      });
      assert.equal(denied.run?.status, "paused");
      assert.equal(denied.pendingApproval, null);
      assert.equal((await getVivaryCodeHostState("owner@example.com", "org-alpha")).busy, false);
      const events = listCodeAgentTranscriptEvents(staged.run!.id);
      assert.equal(events.some(event => event.kind === "user"), false);
      assert.match(events.at(-1)?.message ?? "", /No model or tools were started/);
      await assert.rejects(
        denyVivaryCodeMessage({
          ownerEmail: "owner@example.com",
          orgId: "org-alpha",
          runId: staged.run!.id,
          requestId: staged.pendingApproval!.requestId,
          projectId: workspace.projectId,
        }),
        { errorCode: "vivary_code_approval_stale" },
      );
      const personalRoot = await mkdtemp(path.join(os.tmpdir(), "vivary-code-personal-test-"));
      temporaryRoots.push(personalRoot);
      process.env.VIVARY_LOCAL_AGENT_WORKSPACE = personalRoot; // guard:allow-env-credential - Isolated test runtime configuration, not user credentials.
      process.env.VIVARY_ACCESS_MODE = "local"; // guard:allow-env-credential - Isolated test runtime configuration, not user credentials.
      const personal = await sendVivaryCodeMessage({
        ownerEmail: "owner@example.com",
        orgId: "org-alpha",
        message: "Personal workspace request.",
        engine: "claude-cli",
        model: "sonnet",
      });
      process.env.VIVARY_ACCESS_MODE = "hosted"; // guard:allow-env-credential - Isolated test runtime configuration, not user credentials.
      await assert.rejects(
        codeApproveAction.run({
          runId: personal.run!.id,
          requestId: personal.pendingApproval!.requestId,
        }, {
          caller: "frontend",
          userEmail: "owner@example.com",
          orgId: "org-alpha",
        }),
        { errorCode: "vivary_code_runtime_unavailable" },
      );
      const deniedPersonal = await codeDenyAction.run({
        runId: personal.run!.id,
        requestId: personal.pendingApproval!.requestId,
      }, {
        caller: "frontend",
        userEmail: "owner@example.com",
        orgId: "org-alpha",
      });
      assert.equal(deniedPersonal.run?.status, "paused");
      assert.equal(deniedPersonal.recentRun?.phase, "approval-denied");
    } finally {
      if (previous.store === undefined) delete process.env.AGENT_NATIVE_CODE_AGENTS_HOME;
      else process.env.AGENT_NATIVE_CODE_AGENTS_HOME = previous.store;
      if (previous.path === undefined) delete process.env.PATH; // guard:allow-env-credential - Isolated test runtime configuration, not user credentials.
      else process.env.PATH = previous.path; // guard:allow-env-credential - Isolated test runtime configuration, not user credentials.
      if (previous.workspace === undefined) delete process.env.VIVARY_LOCAL_AGENT_WORKSPACE; // guard:allow-env-credential - Isolated test runtime configuration, not user credentials.
      else process.env.VIVARY_LOCAL_AGENT_WORKSPACE = previous.workspace; // guard:allow-env-credential - Isolated test runtime configuration, not user credentials.
      if (previous.mode === undefined) delete process.env.VIVARY_ACCESS_MODE; // guard:allow-env-credential - Isolated test runtime configuration, not user credentials.
      else process.env.VIVARY_ACCESS_MODE = previous.mode; // guard:allow-env-credential - Isolated test runtime configuration, not user credentials.
    }
  });

  it("adds bounded run context without repeated final assistant text", () => {
    const events = [
      {
        schemaVersion: 1,
        id: "event-user",
        runId: "run-1",
        kind: "user",
        message: "Create result.md",
        createdAt: "2026-09-12T00:00:00.000Z",
      },
      {
        schemaVersion: 1,
        id: "event-assistant-stream",
        runId: "run-1",
        kind: "system",
        message: "I created result.md.",
        createdAt: "2026-09-12T00:00:01.000Z",
        metadata: { role: "assistant", source: "claude-cli" },
      },
      {
        schemaVersion: 1,
        id: "event-assistant-final",
        runId: "run-1",
        kind: "system",
        message: "I created result.md.",
        createdAt: "2026-09-12T00:00:02.000Z",
        metadata: { role: "assistant", engine: "claude-cli" },
      },
    ] satisfies CodeAgentTranscriptEvent[];

    const prompt = buildVivaryCodeFollowUpPrompt(events, "Add a summary.");
    assert.match(prompt, /# Previous conversation/);
    assert.match(prompt, /# Current request\nAdd a summary\./);
    assert.equal(prompt.match(/Assistant: I created result\.md\./g)?.length, 1);
    assert.ok(prompt.length < 12_500);
  });
});
