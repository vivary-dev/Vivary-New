import { index, route, type RouteConfig } from "@react-router/dev/routes";
export default [index("routes/workbench.tsx"), route("workbench", "routes/workbench.tsx", { id: "workbench" }), route("chat", "routes/chat.tsx")] satisfies RouteConfig;
