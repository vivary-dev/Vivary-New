import { IconFiles, IconWorld, IconMessageCircle, IconArrowUpRight, IconLayoutSidebarRightCollapse, IconLayoutSidebarRightExpand } from "@tabler/icons-react";
import { useState } from "react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { BrowserPreview } from "@/components/workbench/BrowserPreview";
import { Conversation } from "@/components/workbench/Conversation";
import { cn } from "@/lib/utils";
import { Skeleton } from "@agent-native/toolkit/ui";
import { useProjects } from "@/components/projects/ProjectContext";

export function meta() { return [{ title: "Workbench | Vivary" }]; }

const panels = ["files", "web", "plan", "evidence"] as const;
type Panel = typeof panels[number];

function PendingPanel({ panel }: { panel: Exclude<Panel, "web"> }) {
  const content = {
    files: ["No project files connected", "File browsing and editing are not connected yet. Your folder remains unchanged."],
    plan: ["No project plan connected", "A project plan will connect tasks, dependencies, and acceptance checks to the selected project."],
    evidence: ["No project evidence connected", "Completed work will show what changed, the checks that ran, and any decision still needed."],
  }[panel];
  if (panel === "files") return <div className="panel-empty"><h2>Project files</h2><p>Read, edit, and rename files in the full-page file view.</p><Link to="/files">Open files</Link></div>;
  return <div className="panel-empty"><h2>{content[0]}</h2><p>{content[1]}</p></div>;
}

export default function WorkbenchRoute() {
  const { activeProject, checking } = useProjects();
  const [output, setOutput] = useState<Panel>("files");
  const [mobilePane, setMobilePane] = useState<"chat" | "output">("chat");
  const [expanded, setExpanded] = useState(true);
  return <div className="workbench flex h-full min-h-0 flex-col overflow-hidden">
    <header className="workbench-toolbar">
      <div><h1>Workbench</h1>{checking ? <Skeleton className="mt-2 h-3 w-32" aria-label="Checking project access" /> : <p>{activeProject?.displayName ?? "Choose a project"}</p>}</div>
      <Link to="/chat" className="full-chat-link">Full chat <IconArrowUpRight aria-hidden size={15} /></Link>
    </header>
    <div className="mobile-pane-switch" aria-label="Workbench pane">
      <Button size="sm" variant={mobilePane === "chat" ? "secondary" : "ghost"} aria-pressed={mobilePane === "chat"} onClick={() => setMobilePane("chat")}><IconMessageCircle aria-hidden size={16} />Conversation</Button>
      <Button size="sm" variant={mobilePane === "output" ? "secondary" : "ghost"} aria-pressed={mobilePane === "output"} onClick={() => { setMobilePane("output"); setExpanded(true); }}><IconFiles aria-hidden size={16} />Work panels</Button>
    </div>
    <div className={cn("workbench-panes", !expanded && "panels-collapsed")}>
      <section aria-label="Agent conversation" className={cn("conversation-pane", mobilePane !== "chat" && "mobile-hidden")}><Conversation /></section>
      <section aria-label="Work output" className={cn("output-pane", mobilePane !== "output" && "mobile-hidden")}>
        <div className="output-toolbar">
          {expanded && <div className="panel-selectors" aria-label="Work panel">
            {panels.map(panel => <Button key={panel} size="sm" variant={output === panel ? "secondary" : "ghost"} aria-pressed={output === panel} aria-controls="active-work-panel" onClick={() => setOutput(panel)}>
              {panel === "files" && <IconFiles aria-hidden size={16} />}{panel === "web" && <IconWorld aria-hidden size={16} />}{panel[0].toUpperCase() + panel.slice(1)}
            </Button>)}
          </div>}
          <Button className="panel-expander" variant="ghost" size="icon" aria-label={expanded ? "Collapse work panels" : "Expand work panels"} aria-expanded={expanded} aria-controls="active-work-panel" onClick={() => setExpanded(value => !value)}>
            {expanded ? <IconLayoutSidebarRightCollapse aria-hidden size={18} /> : <IconLayoutSidebarRightExpand aria-hidden size={18} />}
          </Button>
        </div>
        <div id="active-work-panel" className="active-work-panel" hidden={!expanded}>
          <div className="h-full" hidden={output !== "web"}><BrowserPreview /></div>
          {output !== "web" && <PendingPanel panel={output} />}
        </div>
      </section>
    </div>
  </div>;
}
