import {
  AgentConversation,
  normalizeCodeAgentTranscriptForConversation,
} from "@agent-native/core/client/conversation";
import { useActionQuery } from "@agent-native/core/client/hooks";
import { Skeleton } from "@agent-native/toolkit/ui";
import { useProjects } from "@/components/projects/ProjectContext";
import {
  runtimeActivityResultSchema,
  type RuntimeActivityResult,
} from "@/lib/runtime-activity-schema";
import {
  runtimeReadinessResultSchema,
  type RuntimeReadinessBlocker,
  type RuntimeReadinessResult,
} from "@/lib/runtime-readiness-schema";

const blockerCopy: Record<RuntimeReadinessBlocker, string> = {
  "runtime-package-missing": "The selected runtime package is not installed.",
  "runtime-unconfigured": "No trusted runtime configuration is available.",
  "runtime-authentication-unknown": "Runtime sign-in has not been confirmed.",
  "runtime-authentication-unavailable": "Runtime sign-in is unavailable.",
  "runtime-authority-unknown": "Run authority has not been confirmed.",
  "runtime-authority-unavailable": "Run authority is unavailable.",
  "binding-unavailable": "The current project folder binding is unavailable.",
  "runtime-runnability-unknown": "The runtime has not proved that it can start this project.",
  "runtime-unavailable": "The runtime cannot start this project with the current evidence.",
  "verification-unknown": "No current verification evidence is available.",
  "runtime-unverified": "The current runtime verification is unavailable.",
};

function readinessRefusalCopy(result: Exclude<RuntimeReadinessResult, { code: "readiness" }>) {
  switch (result.code) {
    case "denied": return "Project access changed. Choose the project again.";
    case "stale-claim": return "Project settings changed. Refresh the project list before continuing.";
    case "ambiguous-binding":
      return "More than one current folder binding matches this project. Ask the workspace owner to resolve it.";
    case "unavailable": return "Runtime readiness is temporarily unavailable.";
    default: {
      const exhaustive: never = result.code;
      return exhaustive;
    }
  }
}

function activityRefusalCopy(result: Exclude<RuntimeActivityResult, { code: "activity" }>) {
  switch (result.code) {
    case "denied": return "Project access changed. Choose the project again.";
    case "stale-claim": return "Project or run settings changed. Refresh the project list before continuing.";
    case "ambiguous-binding":
      return "More than one current folder binding matches this project. Ask the workspace owner to resolve it.";
    case "activity-too-large": return "This run activity is too large for the bounded preview.";
    case "unavailable": return "No verified run activity is available for this project.";
    default: {
      const exhaustive: never = result.code;
      return exhaustive;
    }
  }
}

function CheckingActivity() {
  return <div className="conversation-checking" role="status">
    <span className="sr-only">Checking project run activity</span>
    <Skeleton className="h-5 w-40" />
    <Skeleton className="mt-auto h-24 w-full" />
  </div>;
}

export function Conversation({ fullPage = false }: { fullPage?: boolean }) {
  const { catalog, activeProject, checking, selecting } = useProjects();
  const hasClaim = catalog !== null && activeProject !== null;
  const claims = {
    projectId: activeProject?.projectId ?? "none",
    expectedBindingRevision: activeProject?.bindingRevision.toString() ?? "0",
    expectedPolicyRevision: catalog?.policyRevision.toString() ?? "0",
    scopeKey: catalog?.scopeKey ?? "none",
  };
  const readinessQuery = useActionQuery<RuntimeReadinessResult>("vivary-project-runtime-readiness", claims, {
    enabled: hasClaim, retry: false, staleTime: 0, refetchOnWindowFocus: "always",
  });
  const parsedReadiness = readinessQuery.isError
    ? runtimeReadinessResultSchema.safeParse(undefined)
    : runtimeReadinessResultSchema.safeParse(readinessQuery.data);
  const readiness = parsedReadiness.success ? parsedReadiness.data : null;
  const matchesReadiness = readiness?.code === "readiness" && activeProject !== null && catalog !== null
    && readiness.projectId === activeProject.projectId && readiness.scopeKey === catalog.scopeKey
    && readiness.bindingRevision === activeProject.bindingRevision
    && readiness.policyRevision === catalog.policyRevision;
  const ready = matchesReadiness && readiness.blockers.length === 0
    && Object.values(readiness.observations).every(item => item.state === "available");
  const activityQuery = useActionQuery<RuntimeActivityResult>("vivary-project-runtime-activity", claims, {
    enabled: ready, retry: false, staleTime: 0, refetchOnWindowFocus: "always",
  });

  if (checking || selecting || (hasClaim && (readinessQuery.isPending || readinessQuery.isFetching))
    || (ready && (activityQuery.isPending || activityQuery.isFetching))) return <CheckingActivity />;
  if (!activeProject || !catalog) {
    return <div className="panel-empty"><h2>Choose a project</h2>
      <p>Select an available project to view its conversation.</p></div>;
  }

  if (!ready) {
    let message = "Runtime readiness could not be verified. Ask the workspace owner to check the runtime connection.";
    let blockers: RuntimeReadinessBlocker[] = [];
    if (readiness && readiness.code !== "readiness") message = readinessRefusalCopy(readiness);
    if (matchesReadiness) {
      blockers = readiness.blockers;
      if (blockers.length > 0) message = `Current blockers for ${activeProject.displayName}:`;
    }
    return <div className="conversation-unavailable-shell" data-project-scope={activeProject.projectId}
      data-conversation-mode={fullPage ? "page" : "panel"}>
      <div className="panel-empty" role="status"><h2>Project runtime unavailable</h2><p>{message}</p>
        {blockers.length > 0
          ? <ul>{blockers.map(blocker => <li key={blocker}>{blockerCopy[blocker]}</li>)}</ul>
          : null}
      </div>
    </div>;
  }

  const parsedActivity = activityQuery.isError
    ? runtimeActivityResultSchema.safeParse(undefined)
    : runtimeActivityResultSchema.safeParse(activityQuery.data);
  const activity = parsedActivity.success ? parsedActivity.data : null;
  const matchesActivity = activity?.code === "activity"
    && activity.projectId === activeProject.projectId && activity.scopeKey === catalog.scopeKey
    && activity.bindingRevision === activeProject.bindingRevision
    && activity.policyRevision === catalog.policyRevision;
  const messages = matchesActivity
    ? normalizeCodeAgentTranscriptForConversation(activity.items)
    : [];
  const rendererKey = matchesActivity
    ? `${activity.nativeScope.type}:${activity.nativeScope.id}:${activity.nativeThreadId}:${activity.referenceRevision}:${activity.nativeRunId}`
    : `unavailable:${activeProject.projectId}:${activeProject.bindingRevision}:${catalog.scopeKey}`;
  const description = activity && activity.code !== "activity"
    ? activityRefusalCopy(activity)
    : "No verified run activity is available for this project.";
  const error = activityQuery.isError || !parsedActivity.success
    || (activity?.code === "activity" && !matchesActivity)
    ? "Run activity could not be verified for the current project."
    : null;

  return <section className="conversation-unavailable-shell" data-project-scope={activeProject.projectId}
    data-conversation-mode={fullPage ? "page" : "panel"} aria-label="Run activity">
    <h2>Run activity</h2>
    <AgentConversation key={rendererKey} messages={messages} loading={false} error={error}
      emptyTitle="Run activity unavailable" emptyDescription={description} />
  </section>;
}
