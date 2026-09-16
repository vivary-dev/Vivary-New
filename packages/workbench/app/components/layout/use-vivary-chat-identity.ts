import { callAction, useSession } from "@agent-native/core/client/hooks";
import { useOrg } from "@agent-native/core/client/org";
import { useQuery } from "@tanstack/react-query";
import { useProjects } from "../projects/ProjectContext";
import type { VivaryChatIdentity } from "@/lib/chat-scope";

export function useVivaryChatIdentity(kind: "project" | "unassigned" = "project") {
  const { session, status } = useSession();
  const org = useOrg();
  const { activeProject, historyAvailable, checking } = useProjects();
  const projectId = activeProject?.projectId ?? null;
  const owner = session?.email.trim().toLowerCase();
  const authenticated = status === "authenticated" && Boolean(owner)
    && org.isSuccess && owner === org.data?.email.trim().toLowerCase();
  const enabled = authenticated && (kind === "unassigned" || (historyAvailable && !checking));
  const input = kind === "unassigned" ? { kind } : { kind, projectId: projectId ?? undefined };
  // Scope the cache by the authenticated actor too; the server derives the actual identity.
  const query = useQuery({
    queryKey: ["action", "vivary-chat-identity", owner, org.data?.orgId, input],
    queryFn: ({ signal }) => callAction<VivaryChatIdentity>("vivary-chat-identity", input, { method: "GET", signal }),
    enabled, retry: false,
  });
  const identity = enabled && query.data?.kind === kind
    && (kind === "unassigned" || query.data.projectId === projectId) ? query.data : null;
  return { ...query, identity, waiting: status === "loading" || org.isPending || (enabled && query.isPending) };
}
