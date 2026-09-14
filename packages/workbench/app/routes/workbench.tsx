import { redirect } from "react-router";

export function loader({ request }: { request: Request }) {
  const params = new URL(request.url).searchParams;
  return redirect("/" + (params.size ? "?" + params.toString() : ""));
}
export default function LegacyWorkspaceRoute() { return null; }
