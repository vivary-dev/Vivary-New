import { Link } from "react-router";

// Vivary serves no MCP endpoint, so Native's setup guides would end in a 404.
export function McpSettings() {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">MCP</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Vivary serves no MCP endpoint. Agents work through the coding runtimes in Settings.
        </p>
      </div>
      <Link className="vivary-settings-link" to="/settings/runtimes">
        Set up coding runtimes
      </Link>
    </div>
  );
}
