import { useState } from "react";
import { IconFileText } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNativeActionCaller } from "@/lib/native-actions";
import type { RegistrationResult } from "@/lib/project-catalog-schema";

type PlannedFile = {
  path: string;
  content: string;
  bytes: number;
  sha256: string;
};
type Preview = {
  code: "preview";
  plan: {
    schema: "vivary.thin-init-plan/v1";
    target: string;
    files: PlannedFile[];
    plan_sha256: string;
  };
};
type Created = {
  code: "created" | "already-created";
  target: string;
  planSha256: string;
  registration: RegistrationResult;
};
type CreateResult = Created | { code: "plan-changed" };

export function CreateProjectForm({
  disabled,
  onClose,
  onCreated,
}: {
  disabled: boolean;
  onClose: () => void;
  onCreated: (projectId: string) => Promise<boolean>;
}) {
  const { call, ready } = useNativeActionCaller();
  const [name, setName] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [working, setWorking] = useState<"preview" | "create" | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function previewProject(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    setWorking("preview");
    try {
      setPreview(await call<Preview>("vivary-preview-new-project", { name }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The project preview failed.");
    } finally {
      setWorking(null);
    }
  }

  async function createProject() {
    if (!preview) return;
    setMessage(null);
    setWorking("create");
    try {
      const result = await call<CreateResult>("vivary-create-new-project", {
        name,
        displayName: name,
        acceptedPlanSha256: preview.plan.plan_sha256,
      });
      if (result.code === "plan-changed") {
        setPreview(null);
        setMessage("The project plan changed. Preview the files again before creating it.");
        return;
      }
      const registration = result.registration;
      if (registration.code !== "registered" && registration.code !== "already-registered") {
        setMessage("The files were created, but the project could not be registered. Retry creation.");
        return;
      }
      if (await onCreated(registration.projectId)) {
        onClose();
      } else {
        setMessage("Project created. Retry selecting it from the Projects list.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The project could not be created. Retry the same plan safely.");
    } finally {
      setWorking(null);
    }
  }

  const unavailable = disabled || !ready || working !== null;
  return <form className="project-registration" onSubmit={previewProject} aria-label="Create project">
    <label htmlFor="new-project-name">Project name</label>
    <Input id="new-project-name" value={name} autoComplete="off" maxLength={128}
      pattern="[A-Za-z0-9][A-Za-z0-9._\-]*" disabled={unavailable}
      onChange={event => {
        setName(event.target.value);
        setPreview(null);
        setMessage(null);
      }} />
    <p>Vivary will create this project in its managed Projects folder.</p>
    {preview && <section aria-label="Project file preview">
      <p><strong>{preview.plan.files.length} guidance files</strong> will be created.</p>
      <p className="break-all">Folder: {preview.plan.target}</p>
      {preview.plan.files.map(file => <details key={file.path}>
        <summary><IconFileText size={14} /> {file.path} <span>{file.bytes} bytes</span></summary>
        <pre className="max-h-48 overflow-auto whitespace-pre-wrap text-xs">{file.content}</pre>
      </details>)}
    </section>}
    {message && <p role="status">{message}</p>}
    <div className="project-form-actions">
      {!preview && <Button size="sm" type="submit" disabled={unavailable || !name}>
        {working === "preview" ? "Preparing preview…" : "Preview files"}
      </Button>}
      {preview && <Button size="sm" type="button" disabled={unavailable}
        onClick={() => void createProject()}>
        {working === "create" ? "Creating…" : "Create project"}
      </Button>}
      <Button size="sm" variant="ghost" type="button" disabled={working !== null} onClick={onClose}>
        Cancel
      </Button>
    </div>
  </form>;
}
