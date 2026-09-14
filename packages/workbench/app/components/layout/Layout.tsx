import {
  AgentSidebar,
  focusAgentChat,
  navigateWithAgentChatViewTransition,
  useAgentChatHomeHandoff,
  useAgentChatHomeHandoffLinks,
} from "@agent-native/core/client/agent-chat";
import { HeaderActionsProvider } from "@agent-native/toolkit/app-shell";
import { IconMenu2 } from "@tabler/icons-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  fullChatHref,
  isConversationRoute,
  navigationTitle,
} from "@/lib/navigation";
import { Header } from "./Header";
import { CodeRunControl } from "./CodeRunControl";
import { Sidebar } from "./Sidebar";
import { useVivaryChatIdentity } from "./use-vivary-chat-identity";

const SIDEBAR_COLLAPSE_KEY = "vivary.sidebar.collapsed";

function readCollapsedPreference() {
  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
}

export function Layout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const identity = useVivaryChatIdentity();
  const [mobileOpen, setMobileOpen] = useState(false);
  const mobileNavigationTrigger = useRef<HTMLElement | null>(null);
  const [collapsed, setCollapsed] = useState(readCollapsedPreference);
  const ownsConversation = isConversationRoute(location.pathname);
  const receivesHandoff = useAgentChatHomeHandoff({
    storageKey: identity?.storageKey,
    activePath: location.pathname,
    enabled: !ownsConversation && Boolean(identity),
  });
  useAgentChatHomeHandoffLinks({
    storageKey: identity?.storageKey,
    chatPath: "/chat",
    enabled: Boolean(identity),
    requireActiveHandoff: true,
  });

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname, location.search]);
  useEffect(() => {
    const close = () => setMobileOpen(false);
    window.addEventListener("agent-chat:open-thread", close);
    return () => window.removeEventListener("agent-chat:open-thread", close);
  }, []);

  function openMobileNavigation() {
    const active = document.activeElement;
    mobileNavigationTrigger.current = active instanceof HTMLElement ? active : null;
    setMobileOpen(true);
  }

  function changeCollapsed(next: boolean) {
    setCollapsed(next);
    try {
      window.localStorage.setItem(SIDEBAR_COLLAPSE_KEY, next ? "1" : "0");
    } catch {
      /* Navigation still works when storage is unavailable. */
    }
  }

  const content = (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      {ownsConversation ? (
        <header className="vivary-mobile-header md:hidden">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={openMobileNavigation}
            aria-label="Open navigation"
          >
            <IconMenu2 className="size-4" aria-hidden />
          </Button>
          <span className="truncate text-sm font-semibold">
            {navigationTitle(location.pathname)}
          </span>
        </header>
      ) : (
        <Header
          onOpenMobileSidebar={openMobileNavigation}
          showAgentToggle={Boolean(identity)}
        />
      )}
      <CodeRunControl />
      <main
        id="workbench-content"
        className="agent-native-app-main workbench-content min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain"
        tabIndex={-1}
      >
        {children}
      </main>
    </div>
  );

  return (
    <HeaderActionsProvider>
      <div className="agent-layout-shell vivary-shell flex w-full overflow-hidden bg-background text-foreground">
        <a className="skip-link" href="#workbench-content">
          Skip to content
        </a>
        <div
          className="agent-layout-left-drawer hidden shrink-0 md:block"
          data-collapsed={collapsed}
        >
          <Sidebar collapsed={collapsed} onCollapsedChange={changeCollapsed} />
        </div>
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent
            side="left"
            className="w-[280px] max-w-[85vw] p-0"
            onCloseAutoFocus={(event) => {
              const trigger = mobileNavigationTrigger.current;
              if (!trigger?.isConnected) return;
              event.preventDefault();
              trigger.focus();
            }}
          >
            <SheetTitle className="sr-only">Vivary navigation</SheetTitle>
            <SheetDescription className="sr-only">
              Open your agent, projects, conversations, and settings.
            </SheetDescription>
            <Sidebar collapsed={false} collapsible={false} />
          </SheetContent>
        </Sheet>
        {ownsConversation ? (
          <div className="agent-layout-main-surface flex min-h-0 min-w-0 flex-1 overflow-hidden">
            {content}
          </div>
        ) : (
          <AgentSidebar
            enabled={Boolean(identity)}
            position="right"
            storageKey={identity?.storageKey}
            scope={identity?.scope}
            isolateHistoryByScope
            agentChatSurface="app"
            chatOnly
            defaultOpen={false}
            openOnChatRunning={receivesHandoff}
            chatViewTransition
            restoreActiveThread
            threadUrlSync={false}
            agentPageHref="/chat"
            emptyStateText="Ask about this page or use an action."
            onFullscreenRequest={() => {
              focusAgentChat();
              navigateWithAgentChatViewTransition(
                navigate,
                fullChatHref(identity),
              );
            }}
          >
            {content}
          </AgentSidebar>
        )}
      </div>
    </HeaderActionsProvider>
  );
}
