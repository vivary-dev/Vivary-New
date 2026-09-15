export function resolveOriginalRuntime(directory: string | undefined): Promise<Readonly<{
  root: string;
  executable: string;
  version: string;
}>>;
