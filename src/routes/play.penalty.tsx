import { createFileRoute, redirect } from "@tanstack/react-router";
export const Route = createFileRoute("/play/penalty")({
  beforeLoad: () => {
    throw redirect({ to: "/games", replace: true });
  },
});
