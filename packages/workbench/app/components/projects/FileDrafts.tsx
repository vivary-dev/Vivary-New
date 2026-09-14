import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { readClientAppState } from "@agent-native/core/client/hooks";
import { useAppStateWriter } from "@/lib/native-state";

import { parseFileDraft, storedFileDraft, type FileDraft } from "@/lib/file-draft-state";
export type { FileDraft } from "@/lib/file-draft-state";
type DraftStatus = "saving" | "saved" | "error";
type DraftContext = {
  put: (key: string, draft: FileDraft | null) => void;
  retry: (key: string) => void;
  status: Record<string, DraftStatus>;
};
const Context = createContext<DraftContext | null>(null);

export function FileDraftProvider({ children }: { children: ReactNode }) {
  const { writeAppState } = useAppStateWriter();
  const cache = useQueryClient();
  const pending = useRef(new Map<string, FileDraft | null>());
  const working = useRef(new Set<string>());
  const [status, setStatus] = useState<Record<string, DraftStatus>>({});
  const statusRef = useRef(status);
  statusRef.current = status;

  useEffect(() => {
    const guard = (event: BeforeUnloadEvent) => {
      if (Object.values(statusRef.current).some(value => value !== "saved")) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, []);

  async function drain(key: string) {
    if (working.current.has(key)) return;
    working.current.add(key);
    try {
      while (pending.current.has(key)) {
        const value = pending.current.get(key) ?? null;
        pending.current.delete(key);
        try {
          await writeAppState(key, storedFileDraft(value));
        } catch {
          if (!pending.current.has(key)) pending.current.set(key, value);
          setStatus(current => ({ ...current, [key]: "error" }));
          return;
        }
      }
      setStatus(current => ({ ...current, [key]: "saved" }));
    } finally {
      working.current.delete(key);
    }
  }

  function put(key: string, draft: FileDraft | null) {
    cache.setQueryData([key], draft);
    pending.current.set(key, draft);
    setStatus(current => ({ ...current, [key]: "saving" }));
    void drain(key);
  }
  function retry(key: string) {
    setStatus(current => ({ ...current, [key]: "saving" }));
    void drain(key);
  }

  const failed = Object.entries(status).filter(([, value]) => value === "error").map(([key]) => key);
  return <Context.Provider value={{ put, retry, status }}>
    {children}
    {failed.length > 0 && <div className="file-draft-alert" role="alert">
      <span>A file draft could not be saved to this host. Keep Vivary open.</span>
      <button onClick={() => failed.forEach(retry)}>Retry drafts</button>
    </div>}
  </Context.Provider>;
}

export async function fileDraftKey(scope: string, project: string, path: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify([scope, project, path])));
  return "vivary-file-draft-v1:" + Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, "0")).join("");
}

export function useFileDraft(key: string) {
  const context = useContext(Context);
  if (!context) throw new Error("FileDraftProvider is required");
  const query = useQuery({
    queryKey: [key], staleTime: Infinity, gcTime: Infinity, retry: false,
    queryFn: async ({ signal }) => {
      const value = await readClientAppState(key, { signal });
      return parseFileDraft(value);
    },
  });
  return { ...query, put: (draft: FileDraft | null) => context.put(key, draft),
    retrySave: () => context.retry(key), saveStatus: context.status[key] };
}
