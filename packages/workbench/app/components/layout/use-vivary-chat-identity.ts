import { useSession } from "@agent-native/core/client/hooks";
import { useOrg } from "@agent-native/core/client/org";
import { useMemo } from "react";
import { vivaryChatScope } from "@/lib/chat-scope";

export function useVivaryChatIdentity() {
  const { session, status } = useSession();
  const orgQuery = useOrg();
  return useMemo(() => {
    if (
      status !== "authenticated" ||
      !session ||
      !orgQuery.isSuccess ||
      !orgQuery.data
    )
      return null;
    const email = session.email.trim().toLowerCase();
    const orgEmail = orgQuery.data.email.trim().toLowerCase();
    const orgId = orgQuery.data.orgId?.trim() ?? "";
    const scope = vivaryChatScope(orgId);
    if (!email || email !== orgEmail || !scope) return null;
    const namespace = encodeURIComponent(JSON.stringify([email, orgId]));
    return { scope, storageKey: `vivary-workbench-chat-v1:${namespace}` };
  }, [status, session, orgQuery.isSuccess, orgQuery.data]);
}
