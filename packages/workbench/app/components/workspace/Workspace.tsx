import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router";
import { Button, ResizableHandle, ResizablePanel, ResizablePanelGroup, Skeleton } from "@agent-native/toolkit/ui";
import { IconArrowsMaximize, IconArrowsMinimize, IconFiles, IconInfoCircle, IconSearch, IconWorld, IconX } from "@tabler/icons-react";
import { useProjects } from "../projects/ProjectContext";
import { ProjectFiles } from "../projects/ProjectFiles";
import { ProjectSearch } from "../projects/ProjectSearch";
import FilesView from "../../routes/files";
import CodeConversation from "./CodeConversation";
import NativeConversation from "./NativeConversation";
import { BrowserPreview } from "../workbench/BrowserPreview";
import { readPanelWidth, savePanelWidth, useNarrowLayout, type PanelHandle } from "../layout/use-workspace-layout";
import "../../workspace.css";

type Surface = "files" | "details" | "preview" | "search";
function surface(value: string | null): Surface | null {
  return value === "files" || value === "details" || value === "preview" || value === "search" ? value : null;
}
const WIDTH_KEY = "vivary.surface.width";

export function Workspace() {
  const { activeProject, catalog, checking, workspaceAvailable, error: projectError, refresh } = useProjects();
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const native = params.get("runtime") === "native";
  const unassigned = native && params.get("history") === "unassigned";
  const opened = surface(params.get("panel"));
  const narrow = useNarrowLayout();
  const [maximized, setMaximized] = useState(false);
  const panel = useRef<PanelHandle>(null);
  const conversation = useRef<PanelHandle>(null);
  const split = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const detailsTrigger = useRef<HTMLButtonElement>(null);
  const filesTrigger = useRef<HTMLButtonElement>(null);
  const previewTrigger = useRef<HTMLButtonElement>(null);
  const searchTrigger = useRef<HTMLButtonElement>(null);
  const triggers = { details: detailsTrigger, files: filesTrigger, preview: previewTrigger, search: searchTrigger };
  const [splitWidth, setSplitWidth] = useState(0);
  useEffect(() => {
    const element = split.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setSplitWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const [width, setWidth] = useState(() => readPanelWidth(WIDTH_KEY, 480, 260, 1200));
  const [filesVisited, setFilesVisited] = useState(opened === "files");
  const [previewVisited, setPreviewVisited] = useState(opened === "preview");
  const [searchVisited, setSearchVisited] = useState(opened === "search");
  const [fileTreeOpen, setFileTreeOpen] = useState(true);
  const priorProject = useRef<string | null>(null);
  const changingProject = !checking && priorProject.current !== null
    && priorProject.current !== (activeProject?.projectId ?? "personal");
  const showOnlySurface = Boolean(opened) && (narrow || maximized || (splitWidth > 0 && splitWidth < 620));

  function changeSurface(next: Surface | null, trigger?: HTMLButtonElement) {
    if (trigger) opener.current = trigger;
    setMaximized(false);
    setParams(current => {
      const nextParams = new URLSearchParams(current);
      if (next) nextParams.set("panel", next);
      else nextParams.delete("panel");
      return nextParams;
    });
    if (!next) {
      const target = opener.current?.getAttribute("aria-pressed") === "true"
        ? opener.current : opened ? triggers[opened].current : null;
      requestAnimationFrame(() => target?.focus());
    }
  }

  useEffect(() => {
    if (location.pathname !== "/") return;
    if (opened === "files") setFilesVisited(true);
    if (opened === "preview") setPreviewVisited(true);
    if (opened === "search") setSearchVisited(true);
  }, [opened, location.pathname]);
  useEffect(() => {
    if (checking) return;
    const project = activeProject?.projectId ?? "personal";
    if (priorProject.current === null) { priorProject.current = project; return; }
    if (priorProject.current !== project) {
      priorProject.current = project;
      setMaximized(false);
      setParams(current => {
        const next = new URLSearchParams(current);
        next.delete("panel"); next.delete("path"); next.delete("project"); next.delete("runtime"); next.delete("thread"); next.delete("history");
        next.delete("run"); next.delete("draft"); next.delete("line");
        return next;
      }, { replace: true });
    }
  }, [activeProject?.projectId, checking, setParams]);

  useEffect(() => {
    if (!panel.current || !conversation.current) return;
    if (!opened) { conversation.current.expand(); panel.current.collapse(); return; }
    if (showOnlySurface) { conversation.current.collapse(); panel.current.resize("100%"); }
    else {
      conversation.current.expand();
      const available = split.current?.clientWidth ?? window.innerWidth;
      panel.current.resize(Math.min(width, Math.max(260, available - 360)));
    }
  }, [opened, showOnlySurface, width, splitWidth]);

  return <section className="workspace-page" aria-label="Project workspace">
    <header className="workspace-header">
      <div className="workspace-identity">
        <h1>{checking ? "Opening project" : unassigned ? "Unassigned conversations" : activeProject?.displayName ?? "Personal workspace"}</h1>
        <p>{unassigned ? "No project assigned" : native ? "Native chat" : "Project conversation"} / Connected host</p>
      </div>
      <div className="workspace-tools">
        <Button ref={detailsTrigger} size="sm" variant={opened === "details" ? "secondary" : "ghost"} aria-label="Project details"
          aria-pressed={opened === "details"} onClick={e => changeSurface(opened === "details" ? null : "details", e.currentTarget)}>
          <IconInfoCircle size={17} aria-hidden /><span>Details</span></Button>
        <Button ref={filesTrigger} size="sm" variant={opened === "files" ? "secondary" : "ghost"} aria-label="Open project files"
          aria-pressed={opened === "files"} onClick={e => changeSurface(opened === "files" ? null : "files", e.currentTarget)}>
          <IconFiles size={17} aria-hidden /><span>Files</span></Button>
        <Button ref={previewTrigger} size="sm" variant={opened === "preview" ? "secondary" : "ghost"} aria-label="Open page preview"
          aria-pressed={opened === "preview"} onClick={e => changeSurface(opened === "preview" ? null : "preview", e.currentTarget)}>
          <IconWorld size={17} aria-hidden /><span>Preview</span></Button>
        <Button ref={searchTrigger} size="sm" variant={opened === "search" ? "secondary" : "ghost"} aria-label="Search project files"
          aria-pressed={opened === "search"} onClick={e => changeSurface(opened === "search" ? null : "search", e.currentTarget)}>
          <IconSearch size={17} aria-hidden /><span>Search</span></Button>
      </div>
    </header>
    {!checking && !workspaceAvailable && <div className="workspace-recovery" role="alert">
      <span>{projectError ?? "This project folder is unavailable. Saved conversations remain separate from folder access."}</span>
      <Button size="sm" variant="outline" onClick={() => void refresh()}>Retry project</Button>
    </div>}
    <div ref={split} className="workspace-split">
      <ResizablePanelGroup orientation="horizontal" onLayoutChanged={(_, meta) => {
        if (meta.isUserInteraction && !showOnlySurface && opened && panel.current) {
          const pixels = panel.current.getSize().inPixels;
          if (pixels >= 260) { savePanelWidth(WIDTH_KEY, pixels); setWidth(pixels); }
          if (panel.current.isCollapsed()) changeSurface(null);
        }
      }}>
        <ResizablePanel id="conversation" panelRef={conversation} minSize={showOnlySurface ? 0 : narrow ? 0 : 360}
          collapsible collapsedSize={0}>
          <div className="workspace-conversation" hidden={showOnlySurface}>
            {changingProject ? <div className="local-agent-chat-skeleton" aria-busy="true">
              <Skeleton className="h-8 w-48" /><Skeleton className="h-5 w-3/4" />
              <Skeleton className="mt-auto h-28 w-full" />
            </div> : native ? <NativeConversation /> : <CodeConversation />}
          </div>
        </ResizablePanel>
        <ResizableHandle disabled={!opened || showOnlySurface} hidden={!opened || showOnlySurface}
          className="workspace-resize-handle" aria-label="Resize work panel" />
        <ResizablePanel id="surface" panelRef={panel} defaultSize={opened ? width : 0}
          minSize={showOnlySurface ? 0 : 260} collapsible collapsedSize={0}>
          <aside className="workspace-surface" hidden={!opened} aria-label="Work panel">
            <header className="workspace-surface-toolbar">
              <h2>{opened === "files" ? "Files" : opened === "preview" ? "Page preview" : opened === "search" ? "Search" : "Project details"}</h2>
              {opened === "files" && <Button variant="ghost" size="sm" aria-expanded={fileTreeOpen}
                onClick={() => setFileTreeOpen(value => !value)}>{fileTreeOpen ? "Hide file list" : "Show file list"}</Button>}
              {!narrow && splitWidth >= 620 && <Button size="icon" variant="ghost" aria-label={maximized ? "Restore panel" : "Maximize panel"}
                onClick={() => setMaximized(value => !value)}>{maximized ? <IconArrowsMinimize size={17} /> : <IconArrowsMaximize size={17} />}</Button>}
              <Button size="icon" variant="ghost" aria-label="Close work panel" onClick={() => changeSurface(null)}><IconX size={18} /></Button>
            </header>
            {filesVisited && <div className="workspace-file-surface" hidden={opened !== "files"}>
              <div className="workspace-file-tree" hidden={!fileTreeOpen}><ProjectFiles /></div>
              <div className="workspace-file-document"><FilesView /></div>
            </div>}
            {previewVisited && <div className="workspace-preview" hidden={opened !== "preview"}><BrowserPreview /></div>}
            {searchVisited && <div className="workspace-search" hidden={opened !== "search"}><ProjectSearch /></div>}
            <div className="workspace-details" hidden={opened !== "details"}>
              <h3>{activeProject?.displayName ?? "Personal workspace"}</h3>
              <dl><dt>Execution</dt><dd>The connected Vivary host</dd>
                <dt>Project folder</dt><dd>{activeProject ? workspaceAvailable ? "Connected and available" : "Unavailable" : "Personal host workspace"}</dd>
                <dt>Files and history</dt><dd>Stay on this host. Opening a file does not send it to a model.</dd></dl>
              <p>Open Files to read a document. Choose Edit when you want to change it.</p>
              <Button variant="outline" size="sm" onClick={() => navigate("/settings/runtimes")}>Runtime settings</Button>
              {!catalog && <p>Project details could not be loaded. Use Retry project.</p>}
            </div>
          </aside>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  </section>;
}
