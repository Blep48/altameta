import { createFileRoute, redirect } from "@tanstack/react-router";
export const Route = createFileRoute("/play/dash")({
  beforeLoad: () => {
    throw redirect({ to: "/games", replace: true });
  },
});
