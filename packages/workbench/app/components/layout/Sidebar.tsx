import { openCommandMenu } from "@agent-native/core/client/navigation";
import { SidebarFooterActions } from "@agent-native/toolkit/app-shell";
import {
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarLeftExpand,
  IconSearch,
  IconSettings,
} from "@tabler/icons-react";
import { Link, useLocation, useNavigate } from "react-router";
import { ProjectNavigation } from "@/components/projects/ProjectNavigation";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { fullChatHref, navigationItems } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { ChatHistory } from "./ChatHistory";
import { CodeHistory } from "./CodeHistory";
import { useVivaryChatIdentity } from "./use-vivary-chat-identity";

type SidebarProps = {
  collapsed?: boolean;
  collapsible?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
};

export function Sidebar({
  collapsed = false,
  collapsible = true,
  onCollapsedChange,
}: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const identity = useVivaryChatIdentity();
  const codingRoute = location.pathname === "/agent" || location.pathname === "/";
  const ToggleIcon = collapsed
    ? IconLayoutSidebarLeftExpand
    : IconLayoutSidebarLeftCollapse;
  const toggleLabel = collapsed ? "Expand navigation" : "Collapse navigation";
  const navItems = [
    ...navigationItems,
    { href: "/settings", label: "Settings", icon: IconSettings },
  ];
  const navigationLink = (item: (typeof navItems)[number]) => {
    const Icon = item.icon;
    const active =
      (item.href === "/agent" && location.pathname === "/") ||
      location.pathname === item.href ||
      location.pathname.startsWith(`${item.href}/`);
    const link = (
      <Link
        to={
          item.href === "/chat" ? fullChatHref(identity) : item.href
        }
        onClick={(event) => {
          if (
            item.href !== "/chat" ||
            event.button !== 0 ||
            event.metaKey ||
            event.ctrlKey ||
            event.shiftKey ||
            event.altKey
          )
            return;
          event.preventDefault();
          navigate(fullChatHref(identity));
        }}
        className={cn(
          "vivary-nav-link",
          active && "is-active",
          collapsed && "is-collapsed",
        )}
        aria-current={active ? "page" : undefined}
        aria-label={collapsed ? item.label : undefined}
      >
        <Icon className="size-4 shrink-0" aria-hidden />
        <span className={collapsed ? "sr-only" : "truncate"}>{item.label}</span>
      </Link>
    );
    return collapsed ? (
      <Tooltip key={item.href}>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right">{item.label}</TooltipContent>
      </Tooltip>
    ) : (
      <div key={item.href}>{link}</div>
    );
  };

  const collapseButton = collapsible ? (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="vivary-sidebar-utility"
          onClick={() => onCollapsedChange?.(!collapsed)}
          aria-label={toggleLabel}
        >
          <ToggleIcon className="size-4" aria-hidden />
        </button>
      </TooltipTrigger>
      <TooltipContent side="right">{toggleLabel}</TooltipContent>
    </Tooltip>
  ) : undefined;
  const searchButton = (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="vivary-sidebar-utility"
          onClick={openCommandMenu}
          aria-label="Search Vivary"
        >
          <IconSearch className="size-4" aria-hidden />
        </button>
      </TooltipTrigger>
      <TooltipContent side="right">Search Vivary</TooltipContent>
    </Tooltip>
  );

  return (
    <aside
      className={cn(
        "vivary-sidebar flex h-full min-w-0 shrink-0 flex-col overflow-hidden",
        collapsed && "is-collapsed",
      )}
      aria-label="Vivary navigation"
    >
      <div className="vivary-sidebar-brand">
        <Link
          to="/agent"
          className="flex min-w-0 items-center gap-3 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Vivary home"
        >
          <span className="vivary-mark" aria-hidden>
            V
          </span>
          <span
            className={collapsed ? "sr-only" : "truncate text-sm font-semibold"}
          >
            Vivary
          </span>
        </Link>
      </div>
      <nav className="vivary-primary-navigation" aria-label="Workspace views">
        {navItems
          .filter((item) => item.href !== "/settings")
          .map(navigationLink)}
      </nav>
      <div className={cn("vivary-sidebar-content", collapsed && "hidden")}>
        {codingRoute ? (
          <CodeHistory />
        ) : identity && (
          <ChatHistory key={identity.storageKey} identity={identity} />
        )}
        <div className="vivary-project-navigation">
          <ProjectNavigation />
        </div>
      </div>
      <div className="mt-auto shrink-0">
        <nav
          className="vivary-settings-navigation"
          aria-label="Application settings"
        >
          {navigationLink(navItems[navItems.length - 1])}
        </nav>
        <SidebarFooterActions
          collapsed={collapsed}
          search={searchButton}
          collapse={collapseButton}
        />
      </div>
    </aside>
  );
}
