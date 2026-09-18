import { Link } from "@tanstack/react-router";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Screen({
  children,
  className,
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <main className="relative mx-auto flex min-h-screen w-full max-w-md flex-col overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_50%_0%,color-mix(in_oklab,var(--primary)_22%,transparent),transparent_70%)]" />
      <div className={cn("relative flex flex-1 flex-col", padded && "px-5 pb-10 pt-6", className)}>
        {children}
      </div>
    </main>
  );
}

type LinkTo = ComponentProps<typeof Link>["to"];

export function TopBar({ title, back }: { title: string; back?: LinkTo }) {
  return (
    <header className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 pb-6">
      {back ? (
        <Link
          to={back}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border bg-card text-lg text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Go back"
        >
          ←
        </Link>
      ) : (
        <span className="h-10 w-10" />
      )}
      <h1 className="truncate text-center font-display text-lg font-bold tracking-[0.3em] text-foreground">
        {title}
      </h1>
      <span className="h-10 w-10" />
    </header>
  );
}

export function StatTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: ReactNode;
  accent?: "primary" | "accent" | "destructive";
}) {
  return (
    <div className="rounded-2xl border border-border bg-card px-3 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 font-display text-xl font-bold tabular-nums",
          accent === "primary" && "text-primary",
          accent === "accent" && "text-accent",
          accent === "destructive" && "text-destructive",
        )}
      >
        {value}
      </p>
    </div>
  );
}
