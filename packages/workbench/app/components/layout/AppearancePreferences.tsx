import {
  readClientAppStateMany,
  writeClientAppState,
} from "@agent-native/core/client/hooks";
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

type AppearancePreferencesValue = {
  ready: boolean;
  error: string | null;
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
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
        if (theme) applyTheme(theme);
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
  }, [applyTheme]);

  const persist = useCallback(
    (
      key: string,
      value: { theme: ThemePreference } | { preset: AppearancePresetId },
    ) => {
      setError(null);
      writes.current = writes.current.then(async () => {
        try {
          await writeClientAppState(key, value);
        } catch {
          if (alive.current)
            setError(
              "Appearance could not be saved. Choose it again to retry.",
            );
        }
      });
    },
    [],
  );

  const setTheme = useCallback(
    (theme: ThemePreference) => {
      if (!ready) return;
      applyTheme(theme);
      persist("theme", { theme });
    },
    [applyTheme, persist, ready],
  );

  const setAppearance = useCallback(
    (preset: AppearancePresetId) => {
      if (!ready) return;
      applyAppearance(preset);
      persist("appearance", { preset });
    },
    [persist, ready],
  );

  return (
    <AppearancePreferences.Provider
      value={{ ready, error, setTheme, setAppearance }}
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
