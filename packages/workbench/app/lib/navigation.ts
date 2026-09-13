import {
  IconFolder,
  IconLayoutColumns,
  IconMessageCircle,
  IconSettings,
  IconTerminal2,
} from "@tabler/icons-react";

export const navigationItems = [
  {
    href: "/agent",
    label: "Agent",
    icon: IconTerminal2,
    keywords: ["code", "files", "local"],
  },
  {
    href: "/workbench",
    label: "Workbench",
    icon: IconLayoutColumns,
    keywords: ["project", "plan", "output"],
  },
  {
    href: "/chat",
    label: "Full chat",
    icon: IconMessageCircle,
    keywords: ["conversation", "assistant"],
  },
] as const;

export const settingsItems = [
  {
    href: "/settings",
    label: "Settings",
    icon: IconSettings,
    keywords: ["theme", "appearance", "preferences"],
  },
  {
    href: "/settings/runtimes",
    label: "Coding runtimes",
    icon: IconTerminal2,
    keywords: ["local", "cli", "claude code", "codex", "sign in"],
  },
  {
    href: "/settings/agent#llm",
    label: "Model providers",
    icon: IconSettings,
    keywords: ["api key", "openai", "anthropic", "gemini", "models"],
  },
  {
    href: "/settings/integrations",
    label: "Integrations",
    icon: IconSettings,
    keywords: ["connections", "secrets"],
  },
  {
    href: "/settings/agent/resources",
    label: "Agent resources",
    icon: IconFolder,
    keywords: ["instructions", "skills", "memory"],
  },
] as const;

export function isConversationRoute(pathname: string) {
  return (
    pathname === "/" ||
    pathname === "/agent" ||
    pathname === "/chat" ||
    pathname === "/workbench"
  );
}

export function navigationTitle(pathname: string) {
  if (pathname.startsWith("/settings")) return "Settings";
  return (
    navigationItems.find((item) => item.href === pathname)?.label ?? "Vivary"
  );
}

export function fullChatHref(identity?: { storageKey: string; scope: { type: string; id: string } } | null) {
  if (!identity) return "/chat";
  try {
    const threadId = window.localStorage.getItem(
      `agent-chat-active-thread:${identity.storageKey}:scope:${identity.scope.type}:${identity.scope.id}`,
    );
    return threadId ? `/chat?thread=${encodeURIComponent(threadId)}` : "/chat";
  } catch {
    return "/chat";
  }
}
