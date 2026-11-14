import { Outlet, createFileRoute } from "@tanstack/react-router";
import { Shell } from "@/components/shell";

export const Route = createFileRoute("/app")({
  component: () => (
    <Shell>
      <Outlet />
    </Shell>
  ),
});
