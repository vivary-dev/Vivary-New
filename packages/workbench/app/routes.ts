import { index, route, type RouteConfig } from "@react-router/dev/routes";

export default [
  index("routes/agent.tsx"),
  route("agent", "routes/agent.tsx", { id: "local-agent" }),
  route("workbench", "routes/workbench.tsx", { id: "workbench" }),
  route("chat", "routes/chat.tsx"),
  route("settings", "routes/settings.tsx"),
  route("settings/*", "routes/settings.$.tsx"),
] satisfies RouteConfig;
