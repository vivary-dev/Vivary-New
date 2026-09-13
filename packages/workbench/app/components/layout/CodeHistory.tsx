import { isCodeAgentRunActive } from "@agent-native/core/client/agent-chat";
import { useActionQuery } from "@agent-native/core/client/hooks";
import {
  ChatHistoryList,
  useChatHistoryRailController,
} from "@agent-native/toolkit/chat-history";
import { ActionButton, IconButton } from "@agent-native/toolkit/design-system";
import { IconDots, IconPlus } from "@tabler/icons-react";
import { useLocation, useNavigate } from "react-router";
import type { VivaryCodeState } from "../../../server/local-code-agent";
import { useProjects } from "@/components/projects/ProjectContext";
import { Button } from "@/components/ui/button";

export function CodeHistory() {
  const { activeProject, checking, workspaceAvailable } = useProjects();
  const location = useLocation();
  const navigate = useNavigate();
  const projectId = activeProject?.projectId ?? null;
  const routeRun = new URLSearchParams(location.search).get("run");
  const requestedRun = routeRun && routeRun !== "new" ? routeRun : undefined;
  const state = useActionQuery<VivaryCodeState>(
    "vivary-code-state",
    { projectId: projectId ?? undefined },
    {
      enabled: workspaceAvailable,
      refetchInterval: 1000,
      placeholderData: previous =>
        previous?.projectId === projectId ? previous : undefined,
    },
  );
  const codeState = workspaceAvailable && state.data?.projectId === projectId ? state.data : undefined;
  const selectedRun = routeRun === "new" ? null : requestedRun
    ?? codeState?.runs.find(isCodeAgentRunActive)?.id
    ?? codeState?.run?.id;
  const activeId = codeState?.runs.some(run => run.id === selectedRun)
    ? selectedRun
    : null;
  const history = useChatHistoryRailController({
    items: (codeState?.runs ?? []).map(run => ({
      id: run.id,
      title: run.title || "Untitled conversation",
      timestamp: isCodeAgentRunActive(run) ? "Working" : undefined,
    })),
    onNewChat: () =>
      navigate("/agent?run=new&draft=" + crypto.randomUUID()),
    labels: {
      newChat: "New conversation",
      showMore: "More conversations",
      showLess: "Fewer conversations",
    },
  });
  const failed = workspaceAvailable && (state.error || codeState?.error || (state.data && !codeState));

  return (
    <section className="vivary-chat-history" aria-label="Code conversations">
      <ChatHistoryList
        items={history.visibleItems}
        activeId={activeId}
        onSelect={id => navigate("/agent?run=" + encodeURIComponent(id))}
        variant="rail"
        className="an-chat-history-rail"
        loading={checking || (workspaceAvailable && state.isLoading)}
        loadingLabel={
          <div className="vivary-history-skeleton" role="status">
            <span className="sr-only">Opening conversations</span>
            <span /><span /><span />
          </div>
        }
        error={failed ? (
          <div>
            <p>Conversations could not be loaded.</p>
            <Button variant="ghost" size="sm" onClick={() => void state.refetch()}>
              Try again
            </Button>
          </div>
        ) : undefined}
        emptyLabel={workspaceAvailable ? "No conversations yet." : "Choose an available project to open conversations."}
        footer={
          <div className="an-chat-history-rail__footer">
            <ActionButton
              type="button"
              className="an-chat-history-rail__new-chat"
              emphasis="ghost"
              size="compact"
              leadingIcon={<IconPlus size={13} strokeWidth={1.8} aria-hidden />}
              onPress={history.onNewChat}
              disabled={!workspaceAvailable}
            >
              <span>{history.newChatLabel}</span>
            </ActionButton>
            {history.canExpand && (
              <IconButton
                type="button"
                className="an-chat-history-rail__disclosure"
                size="compact"
                icon={<IconDots size={14} strokeWidth={1.8} aria-hidden />}
                onPress={history.toggleExpanded}
                aria-expanded={history.expanded}
                label={history.disclosureLabel}
                title={history.disclosureLabel}
              />
            )}
          </div>
        }
      />
    </section>
  );
}
