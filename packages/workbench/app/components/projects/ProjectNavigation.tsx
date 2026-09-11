import { useRef, useState } from "react";
import { useActionMutation } from "@agent-native/core/client/hooks";
import { Skeleton } from "@agent-native/toolkit/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useProjects } from "./ProjectContext";
import type { ProjectCatalog, RegistrationAttempt, RegistrationResult } from "@/lib/project-catalog-schema";

function registrationMessage(code: RegistrationResult["code"]) {
  if (code === "denied") return "Your folder access changed. Refresh the project list.";
  if (["root-unavailable", "not-directory", "identity-unverified", "binding-unavailable"].includes(code)) {
    return "This folder is unavailable. Ask the workspace owner to reconnect it.";
  }
  if (["stale-policy", "retry-state"].includes(code)) return "The project list changed. Review the refreshed list and try again.";
  return "This folder could not be registered. Review the project name and folder, then try again.";
}

function RegistrationForm({ catalog, disabled, onClose }: { catalog: ProjectCatalog; disabled: boolean; onClose: () => void }) {
  const { selectProject, refresh } = useProjects();
  const [displayName, setDisplayName] = useState("");
  const [locationRef, setLocationRef] = useState(catalog.locations.find(location => location.status === "available")?.locationRef ?? "");
  const [attempt, setAttempt] = useState<RegistrationAttempt | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const mutation = useActionMutation<RegistrationResult, RegistrationAttempt>("vivary-register-project", {
    retry: false, skipActionQueryInvalidation: true,
  });
  const available = catalog.locations.some(location => location.locationRef === locationRef && location.status === "available");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!displayName.trim() || Array.from(displayName).length > 200) {
      setMessage("Enter a project name of up to 200 characters.");
      return;
    }
    const request = attempt ?? { operationId: crypto.randomUUID().replaceAll("-", ""),
      expectedPolicyRevision: catalog.policyRevision, expectedRegistryRevision: catalog.registryRevision,
      locationRef, displayName, contentIdentity: null, attachProjectId: null };
    setAttempt(request);
    setMessage(null);
    try {
      const result = await mutation.mutateAsync(request);
      setAttempt(null);
      if (result.code === "registered" || result.code === "already-registered") {
        if (await selectProject(result.projectId)) onClose();
        else setMessage("Project registered. Refresh the list to select it.");
      } else {
        setMessage(registrationMessage(result.code));
        await refresh();
      }
    } catch {
      setMessage("The result is uncertain. Retry this same registration to check it safely.");
    }
  }

  return <form className="project-registration" onSubmit={submit} aria-label="Register project">
    <label htmlFor="project-name">Project name</label>
    <Input id="project-name" value={displayName} maxLength={400} disabled={disabled || mutation.isPending}
      onChange={event => { setDisplayName(event.target.value); setAttempt(null); setMessage(null); }} autoComplete="off" />
    <label htmlFor="project-folder">Connected folder</label>
    <select id="project-folder" value={locationRef} disabled={disabled || mutation.isPending}
      onChange={event => { setLocationRef(event.target.value); setAttempt(null); setMessage(null); }}>
      {catalog.locations.map(location => <option key={location.locationRef} value={location.locationRef}
        disabled={location.status !== "available"}>{location.displayName}{location.status !== "available" ? " — unavailable" : ""}</option>)}
    </select>
    <p>Registration keeps the folder's files as they are.</p>
    {message && <p role="status">{message}</p>}
    <div className="project-form-actions">
      <Button size="sm" type="submit" disabled={disabled || mutation.isPending || !available}>
        {mutation.isPending ? "Registering…" : attempt ? "Retry registration" : "Register"}
      </Button>
      <Button size="sm" variant="ghost" type="button" disabled={mutation.isPending} onClick={onClose}>Cancel</Button>
    </div>
  </form>;
}

export function ProjectNavigation() {
  const { catalog, activeProject, checking, selecting, error, refresh, selectProject } = useProjects();
  const [registering, setRegistering] = useState(false);
  const lastCatalog = useRef<ProjectCatalog | null>(null);
  if (catalog) lastCatalog.current = catalog;
  return <section className="project-list" aria-labelledby="projects-heading">
    <div className="project-list-heading"><h2 id="projects-heading">Projects</h2>
      <Button size="sm" variant="ghost" onClick={() => void refresh()} disabled={checking} aria-label="Refresh projects">Refresh</Button>
    </div>
    {checking ? <div className="project-list-skeleton" role="status"><span className="sr-only">Checking project access</span>
      <Skeleton className="h-9 w-full" /><Skeleton className="h-9 w-full" /></div> : null}
    {!checking && catalog && <>
      {catalog.projects.length === 0 ? <p>No projects yet. Register a connected folder to begin.</p>
        : <ul className="registered-projects">{catalog.projects.map(project => <li key={project.projectId}>
          <Button variant="ghost" className="project-choice" disabled={project.status !== "available" || selecting}
            aria-pressed={activeProject?.projectId === project.projectId} onClick={() => void selectProject(project.projectId)}>
            <span>{project.displayName}</span>{project.status !== "available" && <span className="project-unavailable-label">Unavailable</span>}
          </Button>
        </li>)}</ul>}
      {!registering && <Button size="sm" className="register-project-button" onClick={() => setRegistering(true)}
        disabled={!catalog.locations.some(location => location.status === "available")}>Register project</Button>}
      {!catalog.locations.some(location => location.status === "available") && <p>No connected folder is available. Ask the workspace owner to reconnect one.</p>}
    </>}
    {registering && lastCatalog.current && <div hidden={!catalog}>
      <RegistrationForm key={lastCatalog.current.scopeKey}
        catalog={lastCatalog.current} disabled={checking || !catalog} onClose={() => setRegistering(false)} />
    </div>}
    {error && <p role="status">{error}</p>}
  </section>;
}
