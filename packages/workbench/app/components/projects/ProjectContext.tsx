import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { readClientAppState, useActionQuery, writeClientAppState } from "@agent-native/core/client/hooks";
import { selectionSchema, type CatalogProject, type CatalogResult, type ProjectCatalog } from "@/lib/project-catalog-schema";

const SELECTION_KEY = "vivary-project-selection-v1";

type ProjectContextValue = {
  catalog: ProjectCatalog | null;
  activeProject: CatalogProject | null;
  checking: boolean;
  selecting: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  selectProject: (projectId: string) => Promise<boolean>;
};

const ProjectContext = createContext<ProjectContextValue | null>(null);

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const catalogQuery = useActionQuery<CatalogResult>("vivary-project-catalog", {}, {
    retry: false, refetchOnWindowFocus: "always", refetchInterval: 30000,
  });
  const [selecting, setSelecting] = useState(false);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const latestSelection = useRef(0);
  const selectionWrites = useRef<Promise<void>>(Promise.resolve());
  const lastScope = useRef<string | null>(null);
  const verified = catalogQuery.isSuccess && catalogQuery.data.code === "catalog"
    ? catalogQuery.data : null;
  const checking = catalogQuery.isPending || catalogQuery.isFetching;
  const catalog = checking ? null : verified;
  const selectionQuery = useQuery({
    queryKey: [SELECTION_KEY, verified?.scopeKey], enabled: verified !== null,
    retry: false,
    queryFn: async ({ signal }) => {
      const value = await readClientAppState(SELECTION_KEY, { signal });
      const parsed = selectionSchema.safeParse(value);
      return parsed.success ? parsed.data : null;
    },
  });
  const saved = selectionQuery.data;
  const activeProject = catalog && selectionQuery.isSuccess && !selectionQuery.isFetching && saved?.scopeKey === catalog.scopeKey
    ? catalog.projects.find(project => project.projectId === saved.projectId && project.status === "available") ?? null
    : null;

  useEffect(() => {
    if (checking) return;
    const previousScope = lastScope.current;
    lastScope.current = catalog?.scopeKey ?? null;
    const invalidSelection = saved && (!catalog || saved.scopeKey !== catalog.scopeKey
      || !catalog.projects.some(project => project.projectId === saved.projectId && project.status === "available"));
    if (!invalidSelection && !(previousScope && !catalog)) return;
    latestSelection.current += 1;
    setSelecting(false);
    if (previousScope) queryClient.setQueryData([SELECTION_KEY, previousScope], null);
    if (catalog) queryClient.setQueryData([SELECTION_KEY, catalog.scopeKey], null);
  }, [catalog, checking, queryClient, saved]);

  async function refresh() { await catalogQuery.refetch(); }

  async function selectProject(projectId: string) {
    const attempt = ++latestSelection.current;
    setSelecting(true);
    setSelectionError(null);
    try {
      const checked = await catalogQuery.refetch();
      if (latestSelection.current !== attempt) return false;
      if (!checked.isSuccess || checked.data?.code !== "catalog"
        || !checked.data.projects.some(project => project.projectId === projectId && project.status === "available")) {
        setSelectionError("This project is no longer available. Refresh the project list.");
        return false;
      }
      const next = { scopeKey: checked.data.scopeKey, projectId };
      await queryClient.cancelQueries({ queryKey: [SELECTION_KEY, next.scopeKey], exact: true });
      if (latestSelection.current !== attempt) return false;
      const queuedWrite = selectionWrites.current.then(async () => {
        if (latestSelection.current !== attempt) return false;
        await writeClientAppState(SELECTION_KEY, next);
        return latestSelection.current === attempt;
      });
      selectionWrites.current = queuedWrite.then(() => undefined, () => undefined);
      if (!await queuedWrite) return false;
      await queryClient.cancelQueries({ queryKey: [SELECTION_KEY, next.scopeKey], exact: true });
      if (latestSelection.current !== attempt) return false;
      queryClient.setQueryData([SELECTION_KEY, next.scopeKey], next);
      return true;
    } catch {
      if (latestSelection.current === attempt) {
        setSelectionError("Project selection could not be saved. Try again.");
      }
      return false;
    } finally {
      if (latestSelection.current === attempt) setSelecting(false);
    }
  }

  const error = selectionError ?? (catalogQuery.isError || (!checking && !catalog)
    ? "Project access is unavailable. Ask the workspace owner to check your folder access."
    : selectionQuery.isError ? "The saved project selection could not be read." : null);
  const value = useMemo(() => ({ catalog, activeProject, checking, selecting, error,
    refresh, selectProject }), [catalog, activeProject, checking, selecting, error]);
  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

export function useProjects() {
  const context = useContext(ProjectContext);
  if (!context) throw new Error("ProjectProvider is required");
  return context;
}
