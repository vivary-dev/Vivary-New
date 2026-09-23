// Only these owner actions accept the private proxy session transport.
export const VIVARY_OWNER_ACTIONS = [
  "vivary-code-send", "vivary-code-stop", "vivary-code-approve", "vivary-code-deny",
  "vivary-register-project", "vivary-connect-project-folder",
  "vivary-project-file-save", "vivary-project-file-rename",
  "vivary-preview-new-project", "vivary-create-new-project",
  "vivary-preview-managed-project-reconnection", "vivary-confirm-managed-project-reconnection",
  "vivary-original-command", "vivary-project-adoption", "vivary-project-preview",
] as const;
export type VivaryOwnerAction = typeof VIVARY_OWNER_ACTIONS[number];
