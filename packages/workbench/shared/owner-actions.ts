// Only these owner actions accept the private proxy session transport.
export const VIVARY_OWNER_ACTIONS = [
  "vivary-code-send", "vivary-code-stop", "vivary-code-approve", "vivary-code-deny",
  "vivary-register-project", "vivary-connect-project-folder",
  "vivary-preview-new-project", "vivary-create-new-project",
] as const;
export type VivaryOwnerAction = typeof VIVARY_OWNER_ACTIONS[number];
