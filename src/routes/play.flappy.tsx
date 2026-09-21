import { createFileRoute } from "@tanstack/react-router";
import { ServerArena } from "@/components/duel/ServerArena";
export const Route = createFileRoute("/play/flappy")({
  component: () => <ServerArena game="flappy" />,
});
