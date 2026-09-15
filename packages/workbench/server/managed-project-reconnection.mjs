/** Owner-confirmed replacement of one recorded managed folder identity. */
import { createHash, randomUUID } from "node:crypto";
import { lstatSync, realpathSync } from "node:fs";
import { lstat, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { createDbExec, getRuntimeDatabaseUrl } from "@agent-native/core/db";
import { getSettingsEmitter } from "@agent-native/core/settings";
import { isActiveCodeAgentRun, listCodeAgentRunRecords } from "@agent-native/core/code-agents";
import { z } from "zod";
import {
  localRootActorId, localRootIdentity, localRootInventoryKey, parseLocalRootInventory,
} from "./local-root-provider.mjs";
import { getLocalProjectReconnectionService } from "./project-services.mjs";
import { managedProjectDataDirectory } from "./managed-projects.mjs";

const identifier = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
const digest = z.string().regex(/^sha256:[0-9a-f]{64}$/);
const managedName = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const LOCAL = "local-stat-revalidated-v1";
const OPERATION = "reconnect-managed-folder";

function refuse(message, statusCode = 409) {
  return Object.assign(new Error(message), { statusCode });
}
function hash(value) {
  return "sha256:" + createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
function nextRevision(value) {
  if (!Number.isSafeInteger(value) || value < 0 || value >= Number.MAX_SAFE_INTEGER) {
    throw refuse("The project revision cannot advance. Contact the workspace owner.");
  }
  return value + 1;
}
function physical(value) {
  return { platform: value.platform, dev: value.dev, ino: value.ino, birthtimeNs: value.birthtimeNs };
}
function receiptKey(scope, operationId) {
  return [scope.actorId, scope.collectionId, scope.deviceId, OPERATION, operationId].join(":");
}
function requestDigest(input) {
  return hash({ projectId: input.projectId, operationId: input.operationId,
    acceptedPlanSha256: input.acceptedPlanSha256 });
}
function replacementRootId(scope, operationId) {
  return "root_" + createHash("sha256").update(
    [scope.actorId, scope.collectionId, scope.deviceId, operationId].join("\0"),
  ).digest("hex").slice(0, 32);
}
async function localExec() {
  const url = getRuntimeDatabaseUrl();
  if (!url.startsWith("file:")) {
    throw refuse("Managed-folder reconnection requires the local Vivary database.", 503);
  }
  return createDbExec({ url });
}
async function one(tx, sql, args) {
  const { rows } = await tx.execute({ sql, args });
  return rows;
}

/** Every authority and scope row is read through the transaction's private connection. */
async function loadSnapshot(tx, owner, projectId) {
  const email = owner.owner.userEmail.trim().toLowerCase();
  const actorId = localRootActorId(email, owner.owner.orgId);
  const [member] = await one(tx, `SELECT m.role AS ownerRole, r.role AS appRole
    FROM org_members m LEFT JOIN app_member_roles r
      ON r.org_id = m.org_id AND r.app_id = 'workbench'
      AND LOWER(r.email) = LOWER(m.email)
    WHERE m.org_id = ? AND LOWER(m.email) = ? LIMIT 1`, [owner.owner.orgId, email]);
  if (member?.ownerRole !== "owner"
    || !["project-registrar", "project-mutator"].includes(member?.appRole)) {
    throw refuse("Only the authorized workspace owner can reconnect this project.", 403);
  }
  const [device] = await one(tx, "SELECT value FROM settings WHERE key = ?", ["vivary-local-device-v1"]);
  let savedDevice;
  try { savedDevice = JSON.parse(device?.value ?? "null"); }
  catch { throw refuse("The local device identity is invalid.", 403); }
  if (savedDevice?.deviceId !== owner.service.provider.deviceId) {
    throw refuse("The local device identity changed. Restart Vivary before reconnecting.", 403);
  }
  const settingKey = localRootInventoryKey(email, owner.owner.orgId);
  const [setting] = await one(tx, "SELECT value, updated_at AS updatedAt FROM settings WHERE key = ?", [settingKey]);
  let inventory;
  try { inventory = parseLocalRootInventory(JSON.parse(setting?.value ?? "null")); }
  catch { throw refuse("The saved project folder grant is unavailable.", 403); }
  const scope = { actorId, collectionId: inventory.collectionId,
    deviceId: savedDevice.deviceId, policyRevision: inventory.policyRevision };
  const rows = await one(tx, `SELECT b.binding_id AS bindingId, b.project_id AS projectId,
      b.root_id AS rootId, b.location_ref AS locationRef,
      b.binding_revision AS bindingRevision, b.policy_revision AS bindingPolicyRevision,
      b.verification_kind AS verificationKind, p.display_name AS displayName
    FROM vivary_registry_bindings b
    JOIN vivary_registry_projects p ON p.project_id = b.project_id
    WHERE b.project_id = ? AND b.actor_id = ? AND b.collection_id = ?
      AND b.device_id = ? LIMIT 2`,
    [projectId, actorId, inventory.collectionId, savedDevice.deviceId]);
  if (rows.length !== 1 || rows[0].verificationKind !== LOCAL) {
    throw refuse("This project has no single recorded local folder.", 404);
  }
  const binding = rows[0];
  const grant = inventory.grants.find(item => item.locationRef === binding.locationRef);
  if (!grant || grant.rootId !== binding.rootId) {
    throw refuse("The recorded project folder grant and binding disagree. Review the project access.", 409);
  }
  const [revision] = await one(tx, `SELECT revision, collection_id AS collectionId,
      device_id AS deviceId FROM vivary_registry_revisions WHERE scope_key = ?`,
    [inventory.collectionId + ":" + savedDevice.deviceId]);
  if (!revision || revision.collectionId !== inventory.collectionId
    || revision.deviceId !== savedDevice.deviceId) {
    throw refuse("The project registry revision is unavailable.", 409);
  }
  return { ownerEmail: email, orgId: owner.owner.orgId, settingKey, settingRaw: setting.value,
    settingUpdatedAt: Number(setting.updatedAt), inventory, scope, binding, grant,
    registryRevision: Number(revision.revision) };
}

async function managedFolder(grant, dataDir) {
  if (!dataDir || !path.isAbsolute(dataDir)) {
    throw refuse("The managed Projects directory is not configured.", 503);
  }
  const canonicalData = await realpath(dataDir);
  const parent = path.join(canonicalData, "projects");
  const name = path.basename(grant.canonicalPath);
  if (!managedName.test(name) || name.endsWith(".")
    || path.dirname(grant.canonicalPath) !== parent
    || path.join(parent, name) !== grant.canonicalPath) {
    throw refuse("Only a recorded managed project inside Vivary's Projects directory can be reconnected.", 403);
  }
  const parentInfo = await lstat(parent, { bigint: true });
  const targetInfo = await lstat(grant.canonicalPath, { bigint: true });
  if (!parentInfo.isDirectory() || parentInfo.isSymbolicLink()
    || !targetInfo.isDirectory() || targetInfo.isSymbolicLink()
    || await realpath(parent) !== parent
    || await realpath(grant.canonicalPath) !== grant.canonicalPath) {
    throw refuse("The recorded project path is linked or has left the managed Projects directory.", 409);
  }
  return { folderName: name, parent, target: grant.canonicalPath,
    parentIdentity: { dev: String(parentInfo.dev), ino: String(parentInfo.ino),
      birthtimeNs: String(parentInfo.birthtimeNs) } };
}

function plan(snapshot, managed, observed, operationId) {
  const rootId = replacementRootId(snapshot.scope, operationId);
  const planSha256 = hash({
    version: 1, operation: OPERATION, operationId,
    ownerEmail: snapshot.ownerEmail, orgId: snapshot.orgId,
    actorId: snapshot.scope.actorId, collectionId: snapshot.scope.collectionId,
    deviceId: snapshot.scope.deviceId, projectId: snapshot.binding.projectId,
    bindingId: snapshot.binding.bindingId, locationRef: snapshot.binding.locationRef,
    oldRootId: snapshot.binding.rootId, oldIdentity: physical(snapshot.grant),
    newRootId: rootId, newIdentity: physical(observed),
    canonicalPath: snapshot.grant.canonicalPath,
    managedParent: managed.parent, managedParentIdentity: managed.parentIdentity,
    settingRaw: snapshot.settingRaw, settingUpdatedAt: snapshot.settingUpdatedAt,
    policyRevision: snapshot.scope.policyRevision,
    bindingRevision: snapshot.binding.bindingRevision,
    bindingPolicyRevision: snapshot.binding.bindingPolicyRevision,
    registryRevision: snapshot.registryRevision,
  });
  return { rootId, planSha256 };
}
function assertReplacement(snapshot, observed) {
  if (snapshot.grant.platform !== process.platform || observed.canonicalPath !== snapshot.grant.canonicalPath) {
    throw refuse("The recorded folder changed platforms or location.", 409);
  }
  if (localRootIdentity(snapshot.grant) === localRootIdentity(observed)) {
    throw refuse("The recorded folder identity has not changed. Refresh the project list.", 409);
  }
  if (snapshot.inventory.grants.some(grant => grant.locationRef !== snapshot.grant.locationRef
    && localRootIdentity(grant) === localRootIdentity(observed))) {
    throw refuse("This physical folder is already connected to another project.", 409);
  }
}
async function assertStillObserved(managed, observed) {
  const current = await stat(managed.target, { bigint: true });
  const held = await observed.handle.stat({ bigint: true });
  const currentIdentity = { platform: process.platform, dev: String(current.dev),
    ino: String(current.ino), birthtimeNs: String(current.birthtimeNs) };
  const heldIdentity = { platform: process.platform, dev: String(held.dev),
    ino: String(held.ino), birthtimeNs: String(held.birthtimeNs) };
  if (!current.isDirectory() || !held.isDirectory()
    || localRootIdentity(currentIdentity) !== localRootIdentity(observed)
    || localRootIdentity(heldIdentity) !== localRootIdentity(observed)
    || await realpath(managed.target) !== managed.target) {
    throw refuse("The replacement folder changed during confirmation. Review it again.", 409);
  }
}
function assertStillManagedSync(snapshot, managed, observed, dataDir) {
  const currentData = realpathSync(dataDir);
  const parent = path.join(currentData, "projects");
  const parentInfo = lstatSync(parent, { bigint: true });
  const targetInfo = lstatSync(managed.target, { bigint: true });
  const currentParentIdentity = { dev: String(parentInfo.dev), ino: String(parentInfo.ino),
    birthtimeNs: String(parentInfo.birthtimeNs) };
  const currentTargetIdentity = { platform: process.platform, dev: String(targetInfo.dev),
    ino: String(targetInfo.ino), birthtimeNs: String(targetInfo.birthtimeNs) };
  if (parent !== managed.parent || snapshot.grant.canonicalPath !== managed.target
    || !parentInfo.isDirectory() || parentInfo.isSymbolicLink()
    || !targetInfo.isDirectory() || targetInfo.isSymbolicLink()
    || realpathSync(parent) !== parent || realpathSync(managed.target) !== managed.target
    || JSON.stringify(currentParentIdentity) !== JSON.stringify(managed.parentIdentity)
    || localRootIdentity(currentTargetIdentity) !== localRootIdentity(observed)) {
    throw refuse("The managed project path changed. Review the reconnection again.");
  }
}

function nextGrant(snapshot, observed, rootId) {
  return { ...snapshot.grant, rootId, ...physical(observed) };
}
async function readReceipt(tx, snapshot, input) {
  const key = receiptKey(snapshot.scope, input.operationId);
  const [row] = await one(tx, `SELECT receipt_key AS receiptKey, actor_id AS actorId,
      collection_id AS collectionId, device_id AS deviceId, operation, operation_id AS operationId,
      request_digest AS requestDigest, record
    FROM vivary_registry_receipts WHERE receipt_key = ?`, [key]);
  if (!row) return null;
  let record;
  try { record = JSON.parse(row.record); }
  catch { throw refuse("The reconnection receipt is invalid.", 409); }
  if (row.receiptKey !== key || row.actorId !== snapshot.scope.actorId
    || row.collectionId !== snapshot.scope.collectionId || row.deviceId !== snapshot.scope.deviceId
    || row.operation !== OPERATION || row.operationId !== input.operationId
    || row.requestDigest !== requestDigest(input)
    || record?.requestDigest !== row.requestDigest
    || record?.planSha256 !== input.acceptedPlanSha256
    || record?.output?.projectId !== input.projectId) {
    throw refuse("This operation ID belongs to a different reconnection request. Review again.", 409);
  }
  if (snapshot.binding.bindingId !== record.output.bindingId
    || snapshot.binding.rootId !== record.output.rootId
    || snapshot.binding.bindingRevision !== record.output.bindingRevision
    || snapshot.grant.rootId !== record.output.rootId
    || JSON.stringify(snapshot.grant) !== JSON.stringify(record.newGrant)) {
    throw refuse("This completed reconnection was superseded. Review the current project.", 409);
  }
  return { ...record.output, code: "already-reconnected", newGrant: record.newGrant };
}

async function reconcileReplay(exec, owner, request, replay, dataDir) {
  let observed;
  try {
    const managed = await managedFolder(replay.newGrant, dataDir);
    observed = await owner.service.provider.captureReplacement(owner.owner, managed.target);
    if (localRootIdentity(observed) !== localRootIdentity(replay.newGrant)) {
      throw refuse("The completed project folder changed again. Review its current identity.");
    }
    await assertStillObserved(managed, observed);
    // Another reconnection may have committed while the handle was opening.
    await exec.transaction(async tx => {
      const current = await loadSnapshot(tx, owner, request.projectId);
      await readReceipt(tx, current, request);
      assertStillManagedSync(current, managed, observed, dataDir);
    });
    await owner.service.provider.installReplacement(owner.owner.orgId, replay.newGrant, observed);
    observed = null;
    getSettingsEmitter().emit("settings", { source: "settings", type: "change",
      key: localRootInventoryKey(owner.owner.userEmail, owner.owner.orgId),
      requestSource: "vivary-managed-project-reconnection" });
    const { newGrant: _grant, ...output } = replay;
    return output;
  } finally {
    if (observed) await observed.handle.close().catch(() => {});
  }
}

export async function previewManagedProjectReconnection(context, input, dependencies = {}) {
  const projectId = identifier.parse(input.projectId);
  const owner = getLocalProjectReconnectionService(context);
  const exec = await (dependencies.createExec ?? localExec)();
  let observed;
  try {
    const snapshot = await loadSnapshot(exec, owner, projectId);
    const managed = await managedFolder(snapshot.grant,
      managedProjectDataDirectory(dependencies));
    observed = await owner.service.provider.captureReplacement(owner.owner, managed.target);
    assertReplacement(snapshot, observed);
    await assertStillObserved(managed, observed);
    const operationId = randomUUID().replaceAll("-", "");
    const reviewed = plan(snapshot, managed, observed, operationId);
    return { code: "reconnect-preview", projectId, displayName: snapshot.binding.displayName,
      folderName: managed.folderName, identityChanged: true, operationId,
      planSha256: reviewed.planSha256 };
  } finally {
    await observed?.handle.close();
    await exec.close?.();
  }
}

function hasVivaryCodeHostActivity() {
  const host = globalThis[Symbol.for("vivary.workbench.code-host")];
  if (host?.activeRuns instanceof Map && host.activeRuns.size > 0) return true;
  return listCodeAgentRunRecords("vivary-local-code").some(run =>
    run.metadata?.app === "vivary-workbench-local-code" && isActiveCodeAgentRun(run));
}

function requireIdleCodeHost() {
  if (hasVivaryCodeHostActivity()) {
    throw refuse("Stop or deny the active coding request before reconnecting this folder.");
  }
}

export async function confirmManagedProjectReconnection(context, input, dependencies = {}) {
  const projectId = identifier.parse(input.projectId);
  const operationId = identifier.parse(input.operationId);
  const acceptedPlanSha256 = digest.parse(input.acceptedPlanSha256);
  const request = { projectId, operationId, acceptedPlanSha256 };
  const owner = getLocalProjectReconnectionService(context);
  requireIdleCodeHost();
  const exec = await (dependencies.createExec ?? localExec)();
  let observed;
  try {
    // A completed exact retry is checked before the folder or plan is recalculated.
    const replay = await exec.transaction(async tx => {
      const snapshot = await loadSnapshot(tx, owner, projectId);
      return readReceipt(tx, snapshot, request);
    });
    if (replay) return await reconcileReplay(exec, owner, request, replay,
      managedProjectDataDirectory(dependencies));

    const before = await loadSnapshot(exec, owner, projectId);
    const managed = await managedFolder(before.grant,
      managedProjectDataDirectory(dependencies));
    observed = await owner.service.provider.captureReplacement(owner.owner, managed.target);
    assertReplacement(before, observed);
    await assertStillObserved(managed, observed);

    const result = await exec.transaction(async tx => {
      const snapshot = await loadSnapshot(tx, owner, projectId);
      const existing = await readReceipt(tx, snapshot, request);
      if (existing) return existing;
      if (hasVivaryCodeHostActivity()) {
        throw refuse("Stop or deny the active coding request before reconnecting this folder.");
      }
      assertReplacement(snapshot, observed);
      assertStillManagedSync(snapshot, managed, observed,
        managedProjectDataDirectory(dependencies));
      const reviewed = plan(snapshot, managed, observed, operationId);
      if (reviewed.planSha256 !== acceptedPlanSha256) {
        throw refuse("The folder, access, or project revision changed. Review the reconnection again.");
      }
      const [collision] = await one(tx, `SELECT binding_id FROM vivary_registry_bindings
        WHERE collection_id = ? AND device_id = ? AND root_id = ? AND binding_id <> ? LIMIT 1`,
        [snapshot.scope.collectionId, snapshot.scope.deviceId, reviewed.rootId,
          snapshot.binding.bindingId]);
      if (collision) throw refuse("The replacement root ID is already bound to another project.");
      const newPolicyRevision = nextRevision(snapshot.scope.policyRevision);
      const newBindingRevision = nextRevision(snapshot.binding.bindingRevision);
      const newRegistryRevision = nextRevision(snapshot.registryRevision);
      const newGrant = nextGrant(snapshot, observed, reviewed.rootId);
      const inventory = parseLocalRootInventory({ ...snapshot.inventory,
        policyRevision: newPolicyRevision,
        grants: snapshot.inventory.grants.map(grant => grant.locationRef === newGrant.locationRef
          ? newGrant : grant) });
      const updatedAt = Math.max(Date.now(), snapshot.settingUpdatedAt + 1);
      const changedSetting = await tx.execute({ sql: `UPDATE settings SET value = ?, updated_at = ?
        WHERE key = ? AND value = ?`, args: [JSON.stringify(inventory), updatedAt,
        snapshot.settingKey, snapshot.settingRaw] });
      if (changedSetting.rowsAffected !== 1) throw refuse("Project folder access changed. Review again.");
      const changedBinding = await tx.execute({ sql: `UPDATE vivary_registry_bindings
        SET root_id = ?, binding_revision = ?, policy_revision = ?
        WHERE binding_id = ? AND project_id = ? AND actor_id = ? AND collection_id = ?
          AND device_id = ? AND location_ref = ? AND root_id = ?
          AND binding_revision = ? AND policy_revision = ? AND verification_kind = ?`,
        args: [reviewed.rootId, newBindingRevision, newPolicyRevision,
          snapshot.binding.bindingId, projectId, snapshot.scope.actorId,
          snapshot.scope.collectionId, snapshot.scope.deviceId,
          snapshot.binding.locationRef, snapshot.binding.rootId,
          snapshot.binding.bindingRevision, snapshot.binding.bindingPolicyRevision, LOCAL] });
      if (changedBinding.rowsAffected !== 1) throw refuse("The project binding changed. Review again.");
      const changedRevision = await tx.execute({ sql: `UPDATE vivary_registry_revisions
        SET revision = ? WHERE scope_key = ? AND collection_id = ? AND device_id = ? AND revision = ?`,
        args: [newRegistryRevision,
          snapshot.scope.collectionId + ":" + snapshot.scope.deviceId,
          snapshot.scope.collectionId, snapshot.scope.deviceId, snapshot.registryRevision] });
      if (changedRevision.rowsAffected !== 1) throw refuse("The project registry changed. Review again.");
      const output = { code: "reconnected", projectId,
        bindingId: snapshot.binding.bindingId, rootId: reviewed.rootId,
        bindingRevision: newBindingRevision, policyRevision: newPolicyRevision,
        registryRevision: newRegistryRevision };
      const record = { version: 1, requestDigest: requestDigest(request),
        planSha256: acceptedPlanSha256, newGrant, output };
      await tx.execute({ sql: `INSERT INTO vivary_registry_receipts
        (receipt_key, actor_id, collection_id, device_id, operation, operation_id,
          request_digest, record) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [receiptKey(snapshot.scope, operationId), snapshot.scope.actorId,
          snapshot.scope.collectionId, snapshot.scope.deviceId, OPERATION,
          operationId, record.requestDigest, JSON.stringify(record)] });
      return { ...output, newGrant, settingKey: snapshot.settingKey };
    });
    if (result.code === "already-reconnected") return await reconcileReplay(exec, owner, request, result,
      managedProjectDataDirectory(dependencies));
    await owner.service.provider.installReplacement(owner.owner.orgId, result.newGrant, observed);
    observed = null;
    getSettingsEmitter().emit("settings", { source: "settings", type: "change",
      key: result.settingKey, requestSource: "vivary-managed-project-reconnection" });
    const { newGrant: _grant, settingKey: _key, ...output } = result;
    return output;
  } finally {
    if (observed) await observed.handle.close().catch(() => {});
    await exec.close?.();
  }
}
