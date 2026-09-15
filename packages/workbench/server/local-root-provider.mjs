import { createHash, randomUUID } from "node:crypto";
import { open, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { and, eq } from "@agent-native/core/db/schema";
import { listAppMemberRoles, orgMembers, setAppMemberRole } from "@agent-native/core/org";
import { deleteSettingIfValue, getSetting, mutateSetting } from "@agent-native/core/settings";
import { z } from "zod";
import { getDb } from "./db/index.mjs";

export const LOCAL_ROOT_VERIFICATION = "local-stat-revalidated-v1";
const id = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
const decimal = z.string().regex(/^\d+$/);
const grantSchema = z.strictObject({
  locationRef: id, rootId: id, canonicalPath: z.string().min(1),
  label: z.string().min(1).max(200), platform: z.string().min(1),
  dev: decimal, ino: decimal, birthtimeNs: decimal,
});
const inventorySchema = z.strictObject({
  version: z.literal(1), collectionId: id, policyRevision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  roleInitialized: z.boolean(), defaultFolderInitialized: z.boolean(),
  grants: z.array(grantSchema).max(16),
});
const allocate = prefix => prefix + "_" + randomUUID().replaceAll("-", "");
const unknownVcs = () => ({ kind: "unobserved", repositoryId: null, checkoutId: null, mutationOwner: null });
const unavailable = () => ({ code: "identity-unverified" });
export const localRootInventoryKey = (email, orgId) => "vivary-private:local-folders-v1:"
  + localRootActorId(email, orgId);
export const parseLocalRootInventory = value => inventorySchema.parse(value);
export const localRootIdentity = value => [value.platform, value.dev, value.ino, value.birthtimeNs].join(":");
const identity = localRootIdentity;
const contains = (parent, child) => {
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith(".." + path.sep) && relative !== ".." && !path.isAbsolute(relative));
};
export const localRootActorId = (email, orgId) => "actor_" + createHash("sha256")
  .update(orgId + "\0" + email.trim().toLowerCase()).digest("hex");

function stamp(info) {
  if (!info.isDirectory() || info.ino <= 0n || info.birthtimeNs < 0n) {
    throw new Error("This folder does not provide a reusable local filesystem identity.");
  }
  // Zero means this filesystem does not supply creation times. Keep it exact.
  return { platform: process.platform, dev: String(info.dev), ino: String(info.ino),
    birthtimeNs: String(info.birthtimeNs) };
}

async function capture(folder) {
  if (typeof folder !== "string" || !path.isAbsolute(folder)) throw new Error("Choose an absolute project folder.");
  const canonicalPath = await realpath(folder);
  const handle = await open(canonicalPath, "r");
  try {
    const observed = stamp(await handle.stat({ bigint: true }));
    const current = stamp(await stat(canonicalPath, { bigint: true }));
    if (identity(observed) !== identity(current) || await realpath(folder) !== canonicalPath) {
      throw new Error("The selected folder changed while it was opening.");
    }
    return { canonicalPath, handle, ...observed };
  } catch (error) {
    await handle.close();
    throw error;
  }
}

/**
 * Local directory access uses a saved grant and fresh filesystem metadata.
 * It supplies no content snapshot, VCS identity, or destructive-operation authority.
 * Without creation times, inode reuse during downtime can hide folder replacement.
 */
export async function createLocalRootProvider({ ownerEmail, defaultFolder = null }) {
  if (typeof ownerEmail !== "string" || !ownerEmail.trim()) throw new TypeError("A local owner is required.");
  const email = ownerEmail.trim().toLowerCase();
  const device = await getSetting("vivary-local-device-v1")
    ?? await mutateSetting("vivary-local-device-v1", current => current ?? { deviceId: allocate("device") });
  const deviceId = id.parse(device.deviceId);
  const records = new Map();
  const handles = new Map();
  const preparing = new Map();
  let closed = false;

  const key = orgId => localRootInventoryKey(email, orgId);
  const legacyKey = orgId => "u:" + email + ":vivary-local-folders-v1:" + orgId;
  const newInventory = () => ({ version: 1, collectionId: allocate("collection"),
    policyRevision: 1, roleInitialized: false, defaultFolderInitialized: false, grants: [] });

  async function isOwner(context) {
    if (closed || context?.userEmail?.trim().toLowerCase() !== email
      || !id.safeParse(context?.orgId).success) return false;
    const [member] = await getDb().select({ role: orgMembers.role }).from(orgMembers)
      .where(and(eq(orgMembers.orgId, context.orgId), eq(orgMembers.email, email)));
    return member?.role === "owner";
  }

  function remember(orgId, inventory) {
    for (const grant of inventory.grants) records.set(grant.locationRef, { ...grant, orgId });
    return inventory;
  }

  async function readInventory(orgId) {
    const stored = await getSetting(key(orgId));
    return remember(orgId, inventorySchema.parse(stored));
  }

  async function initializeInventory(orgId) {
    const existing = await getSetting(key(orgId), { bypassCache: true });
    const legacy = await getSetting(legacyKey(orgId), { bypassCache: true });
    const parsedLegacy = legacy === null ? null : inventorySchema.safeParse(legacy);
    if (existing === null && parsedLegacy && !parsedLegacy.success) {
      throw new Error("The saved project folder inventory is invalid.");
    }
    const stored = existing === null
      ? await mutateSetting(key(orgId), current => current === null
        ? parsedLegacy?.success ? legacy : newInventory()
        : inventorySchema.parse(current))
      : inventorySchema.parse(existing);
    const inventory = inventorySchema.parse(stored);
    // Retire only the exact copied value. Concurrent changes remain untouched.
    if (parsedLegacy?.success && JSON.stringify(inventory) === JSON.stringify(parsedLegacy.data)) {
      await deleteSettingIfValue(legacyKey(orgId), legacy);
    }
    return remember(orgId, inventory);
  }

  async function changeInventory(orgId, update) {
    if (closed) throw new Error("Project folders are closed.");
    const stored = await mutateSetting(key(orgId), current => {
      const inventory = inventorySchema.parse(current);
      return inventorySchema.parse(update(inventory));
    });
    return remember(orgId, inventorySchema.parse(stored));
  }

  async function keepHandle(record, observed) {
    if (closed) {
      await observed.handle.close();
      throw new Error("Project folders are closed.");
    }
    const previous = handles.get(record.locationRef);
    if (previous) await observed.handle.close();
    else handles.set(record.locationRef, observed.handle);
  }

  async function addFolder(orgId, folder) {
    const observed = await capture(folder);
    let accepted = false;
    try {
      let selected;
      const inventory = await changeInventory(orgId, current => {
        const same = current.grants.find(grant => identity(grant) === identity(observed));
        if (same) {
          if (same.canonicalPath !== observed.canonicalPath) {
            throw new Error("This folder is already connected at another location.");
          }
          selected = same;
          return current;
        }
        if (current.grants.some(grant => grant.canonicalPath === observed.canonicalPath)) {
          throw new Error("This location contains a different folder. Its existing project needs reconnection.");
        }
        if (current.grants.some(grant => contains(grant.canonicalPath, observed.canonicalPath)
          || contains(observed.canonicalPath, grant.canonicalPath))) {
          throw new Error("Choose a folder outside the projects already connected.");
        }
        if (current.grants.length >= 16) throw new Error("This installation supports up to 16 connected folders.");
        selected = { locationRef: allocate("location"), rootId: allocate("root"),
          canonicalPath: observed.canonicalPath, label: path.basename(observed.canonicalPath) || "Project",
          platform: observed.platform, dev: observed.dev, ino: observed.ino, birthtimeNs: observed.birthtimeNs };
        return { ...current, policyRevision: current.policyRevision + 1, grants: [...current.grants, selected] };
      });
      const record = inventory.grants.find(grant => grant.locationRef === selected.locationRef);
      await keepHandle(record, observed);
      accepted = true;
      return Object.freeze({ locationRef: record.locationRef, rootId: record.rootId, displayName: record.label });
    } finally {
      if (!accepted) await observed.handle.close();
    }
  }

  async function prepare(context) {
    if (!await isOwner(context)) return null;
    const orgId = context.orgId;
    if (!preparing.has(orgId)) {
      const pending = (async () => {
        const inventory = await initializeInventory(orgId);
        if (!inventory.roleInitialized) {
          const assignments = await listAppMemberRoles("workbench", orgId);
          if (!assignments.some(assignment => assignment.email.toLowerCase() === email)) {
            await setAppMemberRole({ appId: "workbench", orgId, email,
              role: "project-registrar", updatedBy: email });
          }
          await changeInventory(orgId, current => ({ ...current, roleInitialized: true }));
        }
        if (!inventory.defaultFolderInitialized) {
          if (defaultFolder) await addFolder(orgId, defaultFolder);
          await changeInventory(orgId, current => ({ ...current, defaultFolderInitialized: true }));
        }
      })().catch(error => {
        preparing.delete(orgId);
        throw error;
      });
      preparing.set(orgId, pending);
    }
    await preparing.get(orgId);
    if (!await isOwner(context)) return null;
    return readInventory(orgId);
  }

  async function resolveGrant(context) {
    const inventory = await prepare(context);
    if (!inventory) return null;
    return Object.freeze({ orgId: context.orgId, collectionId: inventory.collectionId,
      policyRevision: inventory.policyRevision,
      locationRefs: Object.freeze(inventory.grants.map(grant => grant.locationRef)) });
  }

  async function inspectRecord(locationRef) {
    const record = records.get(locationRef);
    if (!record || closed || record.platform !== process.platform) return null;
    let observed;
    try {
      observed = await capture(record.canonicalPath);
      if (observed.canonicalPath !== record.canonicalPath || identity(record) !== identity(observed)) return null;
      const held = handles.get(locationRef);
      if (held && identity(stamp(await held.stat({ bigint: true }))) !== identity(record)) return null;
      await keepHandle(record, observed);
      observed = null;
      return record;
    } catch {
      return null;
    } finally {
      if (observed) await observed.handle.close();
    }
  }

  async function observation(locationRef, operation) {
    const record = await inspectRecord(locationRef);
    if (!record) return unavailable();
    return Object.freeze({ code: operation === "observe" ? "observed" : "available",
      rootId: record.rootId, locationRef, verificationKind: LOCAL_ROOT_VERIFICATION,
      contentRevision: null, ...(operation === "observe" ? { vcs: unknownVcs(), overlapSafe: true } : {}) });
  }

  return Object.freeze({
    deviceId, verificationKind: LOCAL_ROOT_VERIFICATION,
    get locationRefs() { return [...records.keys()]; },
    resolveGrant,
    locationLabels: () => Object.fromEntries([...records].map(([ref, record]) => [ref, record.label])),
    readiness: () => ({ status: closed ? "unavailable" : "ready" }),
    observe: ref => observation(ref, "observe"),
    inspect: ref => observation(ref, "inspect"),
    // Reconnection only receives a server-selected recorded path. The caller never supplies a folder.
    captureReplacement: async (context, folder) => {
      if (!await isOwner(context)) throw new Error("Only the local workspace owner can reconnect folders.");
      return capture(folder);
    },
    installReplacement: async (orgId, grant, observed) => {
      if (closed || observed.canonicalPath !== grant.canonicalPath
        || identity(observed) !== identity(grant)) {
        await observed.handle.close();
        throw new Error("Project folder access changed after reconnection.");
      }
      const previous = handles.get(grant.locationRef);
      records.set(grant.locationRef, { ...grant, orgId });
      handles.set(grant.locationRef, observed.handle);
      if (previous && previous !== observed.handle) {
        await previous.close().catch(() => {});
      }
    },
    addGrantedFolder: async (context, folder) => {
      if (!await prepare(context)) throw new Error("Only the local workspace owner can connect folders.");
      const added = await addFolder(context.orgId, folder);
      if (!await isOwner(context)) throw new Error("Project folder access changed.");
      return added;
    },
    resolvePath: async (context, rootId, locationRef) => {
      const grant = await resolveGrant(context);
      if (!grant?.locationRefs.includes(locationRef)) return null;
      const record = await inspectRecord(locationRef);
      if (!record || record.rootId !== rootId || record.orgId !== context.orgId || !await isOwner(context)) return null;
      return Object.freeze({ path: record.canonicalPath, rootId, locationRef,
        verificationKind: LOCAL_ROOT_VERIFICATION, actorId: localRootActorId(email, context.orgId) });
    },
    close: async () => {
      closed = true;
      await Promise.allSettled([...handles.values()].map(handle => handle.close()));
      handles.clear();
      records.clear();
    },
  });
}
