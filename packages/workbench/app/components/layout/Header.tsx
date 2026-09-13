import { AgentToggleButton } from "@agent-native/core/client/agent-chat";
import {
  useHeaderActions,
  useHeaderTitle,
} from "@agent-native/toolkit/app-shell";
import { IconMenu2 } from "@tabler/icons-react";
import { useLocation } from "react-router";
import { Button } from "@/components/ui/button";
import { navigationTitle } from "@/lib/navigation";

export function Header({
  onOpenMobileSidebar,
  showAgentToggle = false,
}: {
  onOpenMobileSidebar: () => void;
  showAgentToggle?: boolean;
}) {
  const location = useLocation();
  const title = useHeaderTitle();
  const actions = useHeaderActions();
  return (
    <header className="vivary-app-header">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={onOpenMobileSidebar}
        aria-label="Open navigation"
      >
        <IconMenu2 className="size-4" aria-hidden />
      </Button>
      <div className="min-w-0 flex-1">
        {title ?? (
          <h1 className="truncate text-base font-semibold tracking-tight">
            {navigationTitle(location.pathname)}
          </h1>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {actions}
        {showAgentToggle && <AgentToggleButton />}
      </div>
    </header>
  );
}
