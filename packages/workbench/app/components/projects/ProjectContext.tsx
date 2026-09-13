import { createContext, useContext, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { readClientAppState, useActionQuery, writeClientAppState } from "@agent-native/core/client/hooks";
import { selectionSchema, type CatalogProject, type CatalogResult, type ProjectCatalog } from "@/lib/project-catalog-schema";

const SELECTION_KEY = "vivary-project-selection-v1";

type ProjectContextValue = {
  catalog: ProjectCatalog | null;
  activeProject: CatalogProject | null;
  checking: boolean;
  workspaceAvailable: boolean;
  selecting: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  selectProject: (projectId: string | null) => Promise<boolean>;
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
  const verified = catalogQuery.isSuccess && catalogQuery.data.code === "catalog"
    ? catalogQuery.data : null;
  const catalog = verified;
  const selectionQuery = useQuery({
    queryKey: [SELECTION_KEY, verified?.scopeKey], enabled: verified !== null,
    retry: false,
    queryFn: async ({ signal }) => {
      const value = await readClientAppState(SELECTION_KEY, { signal });
      const parsed = selectionSchema.safeParse(value);
      if (value == null) return null;
      if (!parsed.success) throw new Error("The saved project selection is invalid. Choose a project again.");
      return parsed.data;
    },
  });
  const checking = catalogQuery.isPending || (verified !== null && selectionQuery.isPending);
  const saved = selectionQuery.data;
  const activeProject = catalog && selectionQuery.isSuccess && saved?.scopeKey === catalog.scopeKey
    ? catalog.projects.find(project => project.projectId === saved.projectId) ?? null
    : null;

  const workspaceAvailable = catalog !== null && selectionQuery.isSuccess
    && (saved === null || (saved?.scopeKey === catalog.scopeKey && activeProject?.status === "available"));

  async function refresh() {
    await catalogQuery.refetch();
    if (selectionQuery.isError) await selectionQuery.refetch();
  }

  async function selectProject(projectId: string | null) {
    const attempt = ++latestSelection.current;
    setSelecting(true);
    setSelectionError(null);
    try {
      const checked = await catalogQuery.refetch();
      if (latestSelection.current !== attempt) return false;
      if (!checked.isSuccess || checked.data?.code !== "catalog"
        || (projectId !== null && !checked.data.projects.some(project => project.projectId === projectId && project.status === "available"))) {
        setSelectionError("This project is no longer available. Refresh the project list.");
        return false;
      }
      const scopeKey = checked.data.scopeKey;
      const next = projectId === null ? null : { scopeKey, projectId };
      await queryClient.cancelQueries({ queryKey: [SELECTION_KEY, scopeKey], exact: true });
      if (latestSelection.current !== attempt) return false;
      const queuedWrite = selectionWrites.current.then(async () => {
        if (latestSelection.current !== attempt) return false;
        await writeClientAppState(SELECTION_KEY, next);
        return latestSelection.current === attempt;
      });
      selectionWrites.current = queuedWrite.then(() => undefined, () => undefined);
      if (!await queuedWrite) return false;
      await queryClient.cancelQueries({ queryKey: [SELECTION_KEY, scopeKey], exact: true });
      if (latestSelection.current !== attempt) return false;
      queryClient.setQueryData([SELECTION_KEY, scopeKey], next);
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
    ? "Project folders could not be loaded. Refresh the list to retry."
    : selectionQuery.isError ? "The saved project selection could not be read. Choose a project again."
      : !checking && !workspaceAvailable ? "The selected project is unavailable. Choose another project or Personal workspace." : null);
  const value = useMemo(() => ({ catalog, activeProject, checking, workspaceAvailable, selecting, error,
    refresh, selectProject }), [catalog, activeProject, checking, workspaceAvailable, selecting, error]);
  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

export function useProjects() {
  const context = useContext(ProjectContext);
  if (!context) throw new Error("ProjectProvider is required");
  return context;
}
