import { useCallback, useMemo, useRef, useState } from "react";
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
};
type DraftResponse = { record: RecordState | null; changed?: boolean; saved?: boolean };
type DraftObservation = { generation: number; revision: string | null; submitId: string | null };

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
      current = { loaded: false, record: null, text: "", reset: 0, saving: null, timer: null, generation: 0, error: null, conflict: false, discarding: false };
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
        current.record = result.record;
        current.text = result.record?.status === "draft" ? result.record.text : "";
        current.loaded = true;
        current.reset++;
        current.error = result.record?.status === "pending"
          ? "This draft may have been sent. Check the conversation, then retry its saved status."
          : null;
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
    changed();
  }, [call, changed, entry, params]);

  const flush = useCallback(async (threadId: string) => {
    const current = entry(threadId);
    if (current.timer) { clearTimeout(current.timer); current.timer = null; }
    if (current.saving) await current.saving;
    if (!current.loaded || current.record?.status === "pending" || current.error) throw new Error("The saved draft needs attention.");
    if (current.record?.status === "draft" && current.record.text === current.text) return;
    const generation = current.generation;
    const expected = current.record;
    const text = current.text;
    current.saving = change(threadId, expected, text === ""
      ? { status: "cleared", text: "", submitId: null }
      : { status: "draft", text, submitId: null }, generation)
      .finally(() => { current.saving = null; });
    await current.saving;
    if (current.text !== text) await flush(threadId);
  }, [change, entry]);

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

  const discard = useCallback(async (threadId: string) => {
    const current = entry(threadId);
    if (current.discarding) return;
    current.discarding = true;
    changed();
    if (current.timer) { clearTimeout(current.timer); current.timer = null; }
    if (current.saving) {
      try { await current.saving; } catch { /* CAS below reports a conflict if the write landed. */ }
    }
    if (!current.loaded) {
      current.error = "The saved draft is still loading. Retry discard after it opens.";
      current.discarding = false;
      changed();
      return;
    }
    const generation = ++current.generation;
    try {
      await change(threadId, current.record, { status: "cleared", text: "", submitId: null }, generation);
      current.text = "";
      current.reset++;
    } catch {
      current.error = "The draft could not be discarded. Retry.";
    } finally {
      current.discarding = false;
      changed();
    }
  }, [change, changed, entry]);

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
    hasPendingForThread: (threadId: string) => entry(threadId).record?.status === "pending",
    restorePending,
    hasDraftForThread: (threadId: string) => {
      const current = entry(threadId);
      return current.loaded && current.record?.status === "draft" && current.text.length > 0;
    },
    retry: (threadId: string) => {
      const current = entry(threadId);
      if (current.record?.status === "pending") { void reconcile(threadId); return; }
      if (current.conflict) {
        current.loaded = false;
        current.error = null;
        current.conflict = false;
        void ensureThread(threadId);
        return;
      }
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
