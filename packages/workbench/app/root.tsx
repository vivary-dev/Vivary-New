import { AppProviders, createAgentNativeQueryClient } from "@agent-native/core/client/hooks";
import { getThemeInitScript } from "@agent-native/core/client/ui";
import { ToolkitProvider } from "@agent-native/toolkit";
import { useState } from "react";
import { Links, Meta, NavLink, Outlet, Scripts, ScrollRestoration, useLocation } from "react-router";
import { designSystem } from "./design-system";
import stylesheet from "./global.css?url";
import { Button } from "./components/ui/button";
import { ProjectProvider } from "./components/projects/ProjectContext";
import { ProjectNavigation } from "./components/projects/ProjectNavigation";

export const links = () => [{ rel: "stylesheet", href: stylesheet }];
export function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="en" suppressHydrationWarning><head>
    <meta charSet="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
    <script suppressHydrationWarning dangerouslySetInnerHTML={{ __html: getThemeInitScript() }} />
    <Meta /><Links />
  </head><body>{children}<ScrollRestoration /><Scripts /></body></html>;
}

function WorkbenchFrame() {
  const [navigationExpanded, setNavigationExpanded] = useState(false);
  const isLocalAgent = ["/", "/agent"].includes(useLocation().pathname);
  return <div className="vivary-shell">
    <a className="skip-link" href="#workbench-content">Skip to workbench</a>
    <aside className="project-navigation" aria-label="Project navigation">
      <NavLink className="brand" to="/agent">Vivary</NavLink>
      <nav aria-label="Workspace views">
        <NavLink to="/agent">Agent</NavLink>
        {!isLocalAgent && <>
          <NavLink to="/workbench">Workbench</NavLink>
          <NavLink to="/chat">Full chat</NavLink>
        </>}
      </nav>
      {!isLocalAgent && <Button className="mobile-navigation-toggle" variant="ghost" size="sm" aria-expanded={navigationExpanded} aria-controls="project-details" onClick={() => setNavigationExpanded(!navigationExpanded)}>Projects</Button>}
      <div id="project-details" className={`project-details ${navigationExpanded ? "is-expanded" : ""}`}>
      {isLocalAgent ? <p className="build-state">Private preview<br />Files and conversation</p> : <>
      <ProjectNavigation />
      <details className="activity-region"><summary>Tasks</summary><p>No project tasks are connected.</p></details>
      <details className="activity-region"><summary>Sessions</summary><p>Native conversations appear in the chat history. Project runtime sessions are not connected.</p></details>
      </>}
      <p className="build-state">Vivary</p>
      </div>
    </aside>
    <main id="workbench-content" className="workbench-content" tabIndex={-1}><Outlet /></main>
  </div>;
}

export default function Root() {
  const [queryClient] = useState(() => createAgentNativeQueryClient());
  const isLocalAgent = ["/", "/agent"].includes(useLocation().pathname);
  return <ToolkitProvider designSystem={designSystem}>
    <AppProviders queryClient={queryClient} defaultTheme="dark" documentTitleFallback="Vivary"
      clientOnlyFallback={<div className="shell-skeleton" role="status"><span className="sr-only">Opening Vivary</span><div /><div /></div>}>
      {isLocalAgent ? <WorkbenchFrame /> : <ProjectProvider><WorkbenchFrame /></ProjectProvider>}
    </AppProviders>
  </ToolkitProvider>;
}

export { ErrorBoundary } from "@agent-native/core/client/ui";
