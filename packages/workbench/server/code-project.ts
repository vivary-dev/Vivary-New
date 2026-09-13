import { fail, type ActionRunContext } from "@agent-native/core/action";
import { resolveLocalProjectWorkspace } from "./project-services.mjs";
import type { VivaryCodeWorkspace } from "./local-code-agent";

/** Resolve browser project IDs through the current Native grant before file or run access. */
export async function resolveVivaryCodeProject(
  context: ActionRunContext | undefined,
  projectId: string | undefined,
): Promise<VivaryCodeWorkspace | undefined> {
  if (!projectId) return undefined;
  try {
    return await resolveLocalProjectWorkspace(context, projectId);
  } catch {
    fail("This project folder is unavailable. Reconnect it from Projects.", {
      errorCode: "vivary_code_project_unavailable",
      statusCode: 409,
    });
  }
}
