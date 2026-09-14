import {
  readClientAppStateMany,
} from "@agent-native/core/client/hooks";
import { useAppStateWriter } from "@/lib/native-state";
import {
  APPEARANCE_PRESETS,
  applyAppearance,
  type AppearancePresetId,
  type ThemePreference,
} from "@agent-native/core/client/ui";
import { useTheme } from "next-themes";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

function isTheme(value: unknown): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

function savedTheme(value: unknown) {
  return value &&
    typeof value === "object" &&
    "theme" in value &&
    isTheme(value.theme)
    ? value.theme
    : null;
}

function savedAppearance(value: unknown) {
  if (!value || typeof value !== "object" || !("preset" in value)) return null;
  return (
    APPEARANCE_PRESETS.find((preset) => preset.id === value.preset)?.id ?? null
  );
}

type PreferenceWrites = {
  theme: { theme: ThemePreference };
  appearance: { preset: AppearancePresetId };
};

type AppearancePreferencesValue = {
  ready: boolean;
  error: string | null;
  retryAppearance: (() => void) | null;
  retrySession: (() => void) | null;
  setTheme: (theme: ThemePreference) => void;
  setAppearance: (preset: AppearancePresetId) => void;
};

const AppearancePreferences = createContext<AppearancePreferencesValue | null>(
  null,
);

export function AppearancePreferencesProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { setTheme: applyTheme } = useTheme();
  const applyThemeRef = useRef(applyTheme);
  applyThemeRef.current = applyTheme;
  const { ready: stateWriterReady, retrySession, sessionStatus, writeAppState } = useAppStateWriter();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failedWrites, setFailedWrites] = useState<Partial<PreferenceWrites>>({});
  const latestWrites = useRef<Partial<PreferenceWrites>>({});
  const writes = useRef(Promise.resolve());
  const alive = useRef(true);

  useEffect(() => {
    const controller = new AbortController();
    alive.current = true;
    void readClientAppStateMany(["theme", "appearance"], {
      signal: controller.signal,
    })
      .then((state) => {
        if (controller.signal.aborted) return;
        const theme = savedTheme(state.values.theme);
        const appearance = savedAppearance(state.values.appearance);
        if (theme) applyThemeRef.current(theme);
        if (appearance) applyAppearance(appearance);
        setReady(true);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setError(
          "Saved appearance could not be loaded. Changes still apply to this window.",
        );
        setReady(true);
      });
    return () => {
      alive.current = false;
      controller.abort();
    };
  }, []);

  const persist = useCallback(
    <Key extends keyof PreferenceWrites>(
      key: Key,
      value: PreferenceWrites[Key],
    ) => {
      latestWrites.current = { ...latestWrites.current, [key]: value };
      setFailedWrites((current) => {
        if (!(key in current)) return current;
        const next = { ...current };
        delete next[key];
        return next;
      });
      setError(null);
      writes.current = writes.current.then(async () => {
        try {
          await writeAppState(key, value);
          if (!alive.current || latestWrites.current[key] !== value) return;
          setFailedWrites((current) => {
            if (current[key] !== value) return current;
            const next = { ...current };
            delete next[key];
            return next;
          });
        } catch {
          if (!alive.current || latestWrites.current[key] !== value) return;
          setFailedWrites((current) => ({ ...current, [key]: value }));
          setError("Appearance could not be saved. Use Retry to save the visible choice.");
        }
      });
    },
    [writeAppState],
  );
  const setTheme = useCallback(
    (theme: ThemePreference) => {
      if (!ready || !stateWriterReady) {
        if (sessionStatus === "unavailable") retrySession();
        if (ready) setError(
          sessionStatus === "unavailable"
            ? "Your Native session could not be verified. Choose the theme again after retrying."
            : "The theme cannot be saved until your Native session is ready.",
        );
        return;
      }
      applyTheme(theme);
      persist("theme", { theme });
    },
    [applyTheme, persist, ready, retrySession, sessionStatus, stateWriterReady],
  );
  const setAppearance = useCallback(
    (preset: AppearancePresetId) => {
      if (!ready || !stateWriterReady) {
        if (sessionStatus === "unavailable") retrySession();
        if (ready) setError(
          sessionStatus === "unavailable"
            ? "Your Native session could not be verified. Choose the appearance again after retrying."
            : "The appearance cannot be saved until your Native session is ready.",
        );
        return;
      }
      applyAppearance(preset);
      persist("appearance", { preset });
    },
    [persist, ready, retrySession, sessionStatus, stateWriterReady],
  );
  const retryAppearance = useCallback(() => {
    if (failedWrites.theme) persist("theme", failedWrites.theme);
    if (failedWrites.appearance) persist("appearance", failedWrites.appearance);
  }, [failedWrites, persist]);
  const hasFailedWrites = failedWrites.theme !== undefined
    || failedWrites.appearance !== undefined;

  const sessionUnavailable = sessionStatus === "unavailable"
    || (sessionStatus === "authenticated" && !stateWriterReady);
  const effectiveReady = ready && stateWriterReady;
  const effectiveError = hasFailedWrites
    ? "Appearance could not be saved. Use Retry to save the visible choice."
    : error ?? (sessionUnavailable
      ? "Your Native session could not be verified. Retry before saving appearance changes."
      : null);

  return (
    <AppearancePreferences.Provider
      value={{
        ready: effectiveReady,
        error: effectiveError,
        retryAppearance: hasFailedWrites ? retryAppearance : null,
        retrySession: sessionUnavailable ? retrySession : null,
        setTheme,
        setAppearance,
      }}
    >
      {children}
    </AppearancePreferences.Provider>
  );
}

export function useAppearancePreferences() {
  const preferences = useContext(AppearancePreferences);
  if (!preferences)
    throw new Error("AppearancePreferencesProvider is required");
  return preferences;
}
