import {
  AgentChatSurface,
  type ChatThreadScope,
} from "@agent-native/core/client/chat";
import { useSession } from "@agent-native/core/client/hooks";
import { useOrg } from "@agent-native/core/client/org";
import { Skeleton } from "@agent-native/toolkit/ui";

const VIVARY_CHAT_SCOPE = {
  type: "workspace-app",
  id: "vivary-workbench-chat-v1",
  label: "Vivary",
} satisfies ChatThreadScope;
const VIVARY_CHAT_STORAGE_KEY = "vivary-workbench-chat-v1";

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function ChatAccessSkeleton() {
  return (
    <div className="flex h-full min-h-0 flex-col gap-4 p-4" role="status">
      <span className="sr-only">Checking Full chat access</span>
      <Skeleton className="h-9 w-48" />
      <Skeleton className="min-h-0 flex-1" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}

function ChatUnavailable({ message }: { message: string }) {
  return (
    <div className="panel-empty h-full" role="alert">
      <h1>Full chat unavailable</h1>
      <p>{message}</p>
    </div>
  );
}

export function meta() {
  return [{ title: "Conversation | Vivary" }];
}

export default function ChatRoute() {
  const { session, status } = useSession();
  const orgQuery = useOrg();

  let content: React.ReactNode;
  if (
    status === "loading" ||
    status === "signing-out" ||
    (status === "authenticated" && orgQuery.isFetching)
  ) {
    content = <ChatAccessSkeleton />;
  } else if (status !== "authenticated" || !session) {
    content = (
      <ChatUnavailable
        message={
          status === "unauthenticated"
            ? "Sign in to open Full chat."
            : "Vivary could not confirm your signed-in account. Refresh the page and try again."
        }
      />
    );
  } else if (orgQuery.isError || !orgQuery.isSuccess || !orgQuery.data) {
    content = (
      <ChatUnavailable message="Vivary could not confirm your active organization. Refresh the page and try again." />
    );
  } else {
    const sessionEmail = normalizeEmail(session.email);
    const orgEmail = normalizeEmail(orgQuery.data.email);
    const orgId = orgQuery.data.orgId?.trim() ?? "";

    if (!sessionEmail) {
      content = (
        <ChatUnavailable message="Full chat requires a valid account email. Ask the workspace owner to update authentication." />
      );
    } else if (!orgEmail || orgEmail !== sessionEmail) {
      content = (
        <ChatUnavailable message="Your account and active organization could not be matched. Refresh the page and try again." />
      );
    } else if (!orgId) {
      content = (
        <ChatUnavailable message="Full chat requires a stable organization ID. Ask the workspace owner to update organization settings." />
      );
    } else {
      const identityNamespace = encodeURIComponent(
        JSON.stringify([sessionEmail, orgId]),
      );
      const storageKey = `${VIVARY_CHAT_STORAGE_KEY}:${identityNamespace}`;

      content = (
        <AgentChatSurface
          key={storageKey}
          mode="page"
          className="h-full min-h-0"
          storageKey={storageKey}
          scope={VIVARY_CHAT_SCOPE}
          isolateHistoryByScope
          restoreActiveThread={false}
          agentChatSurface="app"
          chatOnly
          codeAccess={{ enabled: false }}
          showHeader
          showTabBar
          threadUrlSync={false}
        />
      );
    }
  }

  return (
    <section aria-label="Full agent conversation" className="h-full">
      {content}
    </section>
  );
}
