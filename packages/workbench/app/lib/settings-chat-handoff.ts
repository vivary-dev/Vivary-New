import { parseSubmitChatMessage } from "@agent-native/core/client/agent-chat";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useProjects } from "@/components/projects/ProjectContext";

// Core keeps a same-window submit this long so a chat that mounts later can
// replay it (SELF_SUBMIT_BUFFER_TTL_MS in @agent-native/core agent-chat).
const CORE_SUBMIT_BUFFER_MS = 8_000;
// Core fires this once a chat picks the thread for a submit. The public
// agent-chat entry does not export the constant, so it is repeated here.
const SUBMIT_TARGET_EVENT = "agentNative.chatSubmitTarget";
export const SETTINGS_CHAT_PATH = "/?runtime=native&history=project";

export type UndeliveredSettingsPrompt = {
  submitMessageId: string | null;
  prompt: string;
  reason: "selection-failed" | "not-delivered";
};

/**
 * Settings pages mount no chat. Core controls there, such as New automation and
 * the Resources create menu, post their prompt to this window and buffer it for
 * a chat that mounts later. While `active`, this hook switches to Personal
 * workspace and opens a Native chat, so Core replays the prompt, with its
 * context, into a new Personal thread. A prompt that no chat claims before the
 * buffer expires is returned so the layout can show it for copying.
 */
export function useSettingsChatHandoff(active: boolean) {
  const navigate = useNavigate();
  const { activeProject, selectProject } = useProjects();
  const latest = useRef({ hasProject: false, selectProject, navigate });
  latest.current = { hasProject: activeProject !== null, selectProject, navigate };
  const waiting = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const [undelivered, setUndelivered] = useState<UndeliveredSettingsPrompt | null>(null);

  useEffect(() => {
    const pending = waiting.current;
    const delivered = (event: Event) => {
      const id = (event as CustomEvent<{ submitMessageId?: unknown }>).detail?.submitMessageId;
      if (typeof id !== "string") return;
      clearTimeout(pending.get(id));
      pending.delete(id);
      // A late delivery still counts, so withdraw an alert already shown for it.
      setUndelivered(current => current?.submitMessageId === id ? null : current);
    };
    window.addEventListener(SUBMIT_TARGET_EVENT, delivered);
    return () => {
      window.removeEventListener(SUBMIT_TARGET_EVENT, delivered);
      for (const timer of pending.values()) clearTimeout(timer);
      pending.clear();
    };
  }, []);

  useEffect(() => {
    if (!active) return;
    const pending = waiting.current;
    const handOff = async (submitMessageId: string | undefined, prompt: string) => {
      // Core buffers only submits that carry an id, so nothing can replay this one.
      if (!submitMessageId) {
        setUndelivered({ submitMessageId: null, prompt, reason: "not-delivered" });
        return;
      }
      if (pending.has(submitMessageId)) return;
      pending.set(submitMessageId, setTimeout(() => {
        pending.delete(submitMessageId);
        setUndelivered({ submitMessageId, prompt, reason: "not-delivered" });
      }, CORE_SUBMIT_BUFFER_MS));
      const { hasProject, selectProject: select, navigate: go } = latest.current;
      if (hasProject && !await select(null)) {
        clearTimeout(pending.get(submitMessageId));
        pending.delete(submitMessageId);
        setUndelivered({ submitMessageId, prompt, reason: "selection-failed" });
        return;
      }
      go(SETTINGS_CHAT_PATH);
    };
    const received = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const submit = parseSubmitChatMessage(event);
      if (submit) void handOff(submit.submitMessageId, submit.message);
    };
    window.addEventListener("message", received);
    return () => window.removeEventListener("message", received);
  }, [active]);

  const dismiss = useCallback(() => setUndelivered(null), []);
  return { undelivered, dismiss };
}
