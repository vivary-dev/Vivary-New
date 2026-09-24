import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AssistantChatProps } from "@agent-native/core/client/agent-chat";
import { useNativeActionCaller } from "./native-actions";

type RecordState = {
  revision: string;
  text: string;
  status: "draft" | "pending" | "cleared";
  submitId: string | null;
};
type Scope = { kind: "project" | "unassigned" | "code"; projectId: string | null };
type Entry = {
  loaded: boolean;
  record: RecordState | null;
  text: string;
  reset: number;
  saving: Promise<void> | null;
  timer: ReturnType<typeof setTimeout> | null;
  generation: number;
  error: string | null;
  conflict: boolean;
  discarding: boolean;
  discardPromise: Promise<void> | null;
  discardFailed: boolean;
};
type DraftResponse = { record: RecordState | null; changed?: boolean; saved?: boolean };
type DraftObservation = { generation: number; revision: string | null; submitId: string | null };
type DraftFlushController = { flush: () => Promise<void>; isDirty: () => boolean; mounted: boolean };
const draftFlushControllers = new Set<DraftFlushController>();

export async function flushChatDraftsForClose(): Promise<boolean> {
  const controllers = [...draftFlushControllers];
  const results = await Promise.allSettled(controllers.map(controller => controller.flush()));
  for (const controller of controllers) {
    if (!controller.mounted && !controller.isDirty()) draftFlushControllers.delete(controller);
  }
  return results.every(result => result.status === "fulfilled")
    && [...draftFlushControllers].every(controller => !controller.isDirty());
}

if (typeof window !== "undefined") {
  const hostWindow = window as Window & { __vivaryFlushChatDraftsForClose?: () => Promise<boolean> };
  hostWindow.__vivaryFlushChatDraftsForClose = flushChatDraftsForClose;
  window.addEventListener("beforeunload", event => {
    if (![...draftFlushControllers].some(controller => controller.isDirty())) return;
    event.preventDefault();
    event.returnValue = "";
  });
  window.addEventListener("pagehide", () => { void flushChatDraftsForClose(); });
}


export function drainDraftChanges(current: Entry,
  write: (expected: RecordState | null, next: Omit<RecordState, "revision">, generation: number) => Promise<void>,
  notify: () => void): Promise<void> {
  if (current.saving) return current.saving;
  const drain = async () => {
    while (true) {
      if (!current.loaded || current.record?.status === "pending" || current.error) {
        throw new Error("The saved draft needs attention.");
      }
      const savedText = current.record?.status === "draft" ? current.record.text : "";
      if (current.text === savedText) return;
      const text = current.text;
      await write(current.record, text === ""
        ? { status: "cleared", text: "", submitId: null }
        : { status: "draft", text, submitId: null }, current.generation);
    }
  };
  const saving = drain().finally(() => {
    if (current.saving === saving) current.saving = null;
    notify();
  });
  current.saving = saving;
  notify();
  return saving;
}

export function draftNeedsCloseAttention(current: Entry): boolean {
  return current.timer !== null || current.saving !== null || current.discardPromise !== null
    || current.discardFailed || (!current.loaded && current.text.length > 0)
    || (current.loaded && current.record?.status !== "pending"
      && current.text !== (current.record?.status === "draft" ? current.record.text : ""));
}

export function acceptLoadedDraft(current: Entry, record: RecordState | null): void {
  current.record = record;
  current.text = record?.status === "draft" ? record.text : "";
  current.loaded = true;
  current.reset++;
  current.discardFailed = false;
  current.error = record?.status === "pending"
    ? "This draft may have been sent. Check the conversation, then retry its saved status."
    : null;
}

export function draftObservation(entry: Entry): DraftObservation {
  return { generation: entry.generation, revision: entry.record?.revision ?? null,
    submitId: entry.record?.submitId ?? null };
}

export function applyReconciledDraft(entry: Entry, observed: DraftObservation, result: DraftResponse): boolean {
  if (entry.generation !== observed.generation || (entry.record?.revision ?? null) !== observed.revision
    || (entry.record?.submitId ?? null) !== observed.submitId) return false;
  entry.record = result.record;
  entry.text = result.record?.status === "draft" ? result.record.text : "";
  if (observed.revision !== (result.record?.revision ?? null)) entry.reset++;
  entry.error = result.record?.status === "pending"
    ? "This draft may have been sent. Check the conversation, then retry its saved status."
    : null;
  return true;
}

export function useNativeChatDraft(scope: Scope) {
  const { call } = useNativeActionCaller();
  const entries = useRef(new Map<string, Entry>());
  const [version, bump] = useState(0);
  const changed = useCallback(() => bump(value => value + 1), []);
  const params = useCallback((threadId: string) => ({ ...scope, threadId }), [scope.kind, scope.projectId]);
  const entry = useCallback((threadId: string) => {
    let current = entries.current.get(threadId);
    if (!current) {
      current = { loaded: false, record: null, text: "", reset: 0, saving: null, timer: null, generation: 0, error: null, conflict: false, discarding: false, discardPromise: null, discardFailed: false };
      entries.current.set(threadId, current);
    }
    return current;
  }, []);

  const ensureThread = useCallback(async (threadId: string) => {
    const current = entry(threadId);
    if (current.loaded || current.saving) return current.saving ?? undefined;
    current.saving = (async () => {
      try {
        const read = await call<DraftResponse>("vivary-chat-draft", { operation: "read", ...params(threadId) });
        const result = read.record?.status === "pending"
          ? await call<DraftResponse>("vivary-chat-draft", { operation: "reconcile", ...params(threadId) })
          : read;
        acceptLoadedDraft(current, result.record);
      } catch {
        current.error = "The saved draft could not be loaded. Retry before typing.";
      } finally {
        current.saving = null;
        changed();
      }
    })();
    return current.saving;
  }, [call, changed, entry, params]);

  const change = useCallback(async (threadId: string, expected: RecordState | null,
    next: Omit<RecordState, "revision">, generation: number) => {
    const current = entry(threadId);
    if (current.generation !== generation) throw new Error("The draft changed while saving.");
    const result = await call<DraftResponse>("vivary-chat-draft",
      { operation: "change", ...params(threadId), expected, next });
    if (!result.changed || !result.record || current.generation !== generation) {
      current.error = "The draft changed in another window. Copy your text before loading the saved version.";
      current.conflict = true;
      changed();
      throw new Error(current.error);
    }
    current.record = result.record;
    current.error = null;
    current.conflict = false;
    current.discardFailed = false;
    changed();
  }, [call, changed, entry, params]);

  const flush = useCallback((threadId: string): Promise<void> => {
    const current = entry(threadId);
    if (current.timer) { clearTimeout(current.timer); current.timer = null; }
    return drainDraftChanges(current,
      (expected, next, generation) => change(threadId, expected, next, generation), changed);
  }, [change, changed, entry]);

  const onChange = useCallback((threadId: string, text: string) => {
    const current = entry(threadId);
    if (!current.loaded || current.discarding || current.error || current.record?.status === "pending") return;
    if (current.record?.status === "cleared" && text === "") return;
    current.text = text;
    if (current.timer) clearTimeout(current.timer);
    current.timer = setTimeout(() => { void flush(threadId).catch(() => {
      if (!current.conflict) current.error = "Your draft could not be saved. Retry before leaving this conversation.";
      changed();
    }); }, 350);
    changed();
  }, [changed, entry, flush]);

  const beforeSubmit = useCallback(async (threadId: string, text: string, submitId: string) => {
    const current = entry(threadId);
    current.text = text;
    await flush(threadId);
    const generation = current.generation;
    await change(threadId, current.record, { status: "pending", text, submitId }, generation);
    current.reset++;
    changed();
  }, [change, changed, entry, flush]);

  const onRejected = useCallback(async (threadId: string, submitId: string) => {
    const current = entry(threadId);
    if (current.record?.status !== "pending" || current.record.submitId !== submitId) return;
    try {
      await change(threadId, current.record,
        { status: "draft", text: current.record.text, submitId: null }, current.generation);
      current.reset++;
      changed();
    } catch {
      current.error = "The draft send failed, but its saved status could not be restored. Retry its status.";
      changed();
    }
  }, [change, changed, entry]);

  const reconcile = useCallback(async (threadId: string) => {
    const current = entry(threadId);
    const observed = draftObservation(current);
    try {
      const result = await call<DraftResponse>("vivary-chat-draft", { operation: "reconcile", ...params(threadId) });
      if (applyReconciledDraft(current, observed, result)) changed();
    } catch {
      if (draftObservation(current).generation === observed.generation
        && draftObservation(current).revision === observed.revision) {
        current.error = "The message was accepted, but its saved draft status could not be checked. Retry.";
        changed();
      }
    }
  }, [call, changed, entry, params]);

  const onAccepted = useCallback(async (threadId: string, submitId: string) => {
    const current = entry(threadId);
    const observed = draftObservation(current);
    if (current.record?.status !== "pending" || observed.submitId !== submitId) return;
    current.error = "Saving this sent message. Check its status before sending again.";
    changed();
    void (async () => {
      for (let attempt = 0; attempt < 12; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 500));
        const latest = entry(threadId);
        if (latest.generation !== observed.generation || latest.record?.submitId !== submitId
          || latest.record?.status !== "pending") break;
        await reconcile(threadId);
      }
    })();
  }, [changed, entry, reconcile]);

  const restorePending = useCallback(async (threadId: string) => {
    // Native debounces queued-message persistence. A no-marker read immediately
    // after acceptance is not proof that the user message was rejected.
    await new Promise(resolve => setTimeout(resolve, 400));
    const current = entry(threadId);
    if (current.record?.status !== "pending") return;
    try {
      const observed = draftObservation(current);
      const checked = await call<DraftResponse>("vivary-chat-draft",
        { operation: "reconcile", ...params(threadId) });
      if (!applyReconciledDraft(current, observed, checked)) return;
      if (checked.saved || checked.record?.status !== "pending") {
        changed();
        return;
      }
      await change(threadId, checked.record,
        { status: "draft", text: checked.record.text, submitId: null }, current.generation);
      current.text = checked.record.text;
      current.reset++;
      current.error = null;
      changed();
    } catch {
      current.error = "The pending draft could not be restored. Retry after checking the conversation.";
      changed();
    }
  }, [call, change, changed, entry, params]);

  const discard = useCallback((threadId: string): Promise<void> => {
    const current = entry(threadId);
    if (current.discardPromise) return current.discardPromise;
    current.discarding = true;
    current.discardFailed = false;
    changed();
    const operation = (async () => {
      if (current.timer) { clearTimeout(current.timer); current.timer = null; }
      if (current.saving) {
        try { await current.saving; } catch { /* CAS below reports a conflict if the write landed. */ }
      }
      if (!current.loaded) {
        current.error = "The saved draft is still loading. Retry discard after it opens.";
        current.discardFailed = true;
        return;
      }
      const generation = ++current.generation;
      try {
        await change(threadId, current.record, { status: "cleared", text: "", submitId: null }, generation);
        current.text = "";
        current.reset++;
      } catch {
        current.error = "The draft could not be discarded. Retry.";
        current.discardFailed = true;
      }
    })();
    const tracked = operation.finally(() => {
      if (current.discardPromise === tracked) current.discardPromise = null;
      current.discarding = false;
      changed();
    });
    current.discardPromise = tracked;
    return tracked;
  }, [change, changed, entry]);

  const isDirty = useCallback(() => [...entries.current.values()].some(draftNeedsCloseAttention), []);
  const flushAll = useCallback(async () => {
    for (const [threadId, current] of entries.current) {
      if (current.discardPromise) await current.discardPromise;
      if (current.discardFailed) throw new Error("A draft discard still needs attention.");
      if (!current.timer && !current.saving && (!current.loaded || current.record?.status === "pending"
        || current.text === (current.record?.status === "draft" ? current.record.text : ""))) continue;
      if (current.error && !current.conflict) current.error = null;
      try {
        await flush(threadId);
      } catch {
        if (!current.error) current.error = "Your draft could not be saved. Retry before leaving this conversation.";
        changed();
        throw new Error("A conversation draft still needs to be saved.");
      }
    }
    if (isDirty()) throw new Error("A conversation draft still needs to be saved.");
  }, [changed, flush, isDirty]);
  useEffect(() => {
    const controller = { flush: flushAll, isDirty, mounted: true };
    draftFlushControllers.add(controller);
    return () => {
      controller.mounted = false;
      if (!controller.isDirty()) { draftFlushControllers.delete(controller); return; }
      void controller.flush().then(() => {
        if (!controller.isDirty()) draftFlushControllers.delete(controller);
      }, () => { /* Keep an unsaved controller available for a later close retry. */ });
    };
  }, [flushAll, isDirty]);

  const hostComposerDraft = useMemo<NonNullable<AssistantChatProps["hostComposerDraft"]>>(() => ({
    textForThread: threadId => {
      const current = entry(threadId);
      return current.record?.status === "draft" ? current.text : "";
    },
    resetKeyForThread: threadId => entry(threadId).reset,
    isReady: threadId => {
      const current = entry(threadId);
      return current.loaded && !current.discarding && !current.error && current.record?.status !== "pending";
    },
    hasDraftStateForThread: threadId => {
      const current = entry(threadId);
      return current.loaded && current.record !== null;
    },
    ensureThread,
    onChange, beforeSubmit, onAccepted, onRejected,
  }), [entry, ensureThread, onChange, beforeSubmit, onAccepted, onRejected, version]);
  return {
    hostComposerDraft,
    statusForThread: (threadId: string) => entry(threadId).error,
    hasConflictForThread: (threadId: string) => entry(threadId).conflict,
    hasFailedDiscardForThread: (threadId: string) => entry(threadId).discardFailed,
    hasPendingForThread: (threadId: string) => entry(threadId).record?.status === "pending",
    restorePending,
    draftSaveStatusForThread: (threadId: string): "saving" | "saved" | null => {
      const current = entry(threadId);
      if (!current.loaded || current.error || current.record?.status === "pending" || current.text.length === 0) return null;
      return current.timer || current.saving || current.record?.status !== "draft" || current.record.text !== current.text
        ? "saving" : "saved";
    },
    retry: (threadId: string) => {
      const current = entry(threadId);
      if (current.conflict) {
        current.discardFailed = false;
        current.loaded = false;
        current.error = null;
        current.conflict = false;
        void ensureThread(threadId);
        return;
      }
      if (current.discardFailed) { void discard(threadId); return; }
      if (current.record?.status === "pending") { void reconcile(threadId); return; }
      if (current.loaded) {
        current.error = null;
        void flush(threadId).catch(() => {
          current.error = "Your draft could not be saved. Retry before leaving this conversation.";
          changed();
        });
      } else {
        current.error = null;
        void ensureThread(threadId);
      }
    },
    discard,
  };
}
