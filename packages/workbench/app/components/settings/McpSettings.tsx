import type { ReactNode } from "react";
import { useSession } from "@agent-native/core/client/hooks";
import { Link } from "react-router";

import { VIVARY_LOCAL_OWNER_EMAIL } from "../../../shared/owner-session";

// Local owner launches serve no MCP endpoint, so Native's setup guides would end in a 404.
export function McpSettings({ nativeContent }: { nativeContent: ReactNode }) {
  const { session, isLoading } = useSession();
  if (isLoading) return null;
  if (session?.email.trim().toLowerCase() !== VIVARY_LOCAL_OWNER_EMAIL) return nativeContent;
  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">MCP</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          This Vivary computer serves no MCP endpoint. Agents on this computer use the coding runtimes in Settings
          instead.
        </p>
      </div>
      <Link className="vivary-settings-link" to="/settings/runtimes">
        Set up coding runtimes
      </Link>
    </div>
  );
}
