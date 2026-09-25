import { useEffect, useState } from "react";

/** A root-level overlay survives route changes without delaying navigation. */
export function MenuFeedback() {
  const [press, setPress] = useState<{
    id: number;
    x: number;
    y: number;
    width: number;
    height: number;
    radius: string;
  } | null>(null);
  const pressId = press?.id;
  useEffect(() => {
    if (pressId == null) return;
    const timer = setTimeout(
      () => setPress((current) => (current?.id === pressId ? null : current)),
      350,
    );
    return () => clearTimeout(timer);
  }, [pressId]);
  useEffect(() => {
    let id = 0;
    const flash = (event: Event) => {
      const target =
        event.target instanceof Element
          ? event.target.closest<HTMLElement>(
              'button, a, [role="button"], [role="tab"], [role="radio"]',
            )
          : null;
      if (
        !target ||
        target.closest('[role="application"]') ||
        target.matches(':disabled,[aria-disabled="true"]')
      )
        return;
      const rect = target.getBoundingClientRect();
      setPress({
        id: ++id,
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        radius: getComputedStyle(target).borderRadius,
      });
    };
    const keyboardClick = (event: MouseEvent) => {
      if (event.detail === 0) flash(event);
    };
    document.addEventListener("pointerdown", flash, true);
    document.addEventListener("click", keyboardClick, true);
    return () => {
      document.removeEventListener("pointerdown", flash, true);
      document.removeEventListener("click", keyboardClick, true);
    };
  }, []);
  return press ? (
    <div
      key={press.id}
      aria-hidden="true"
      className="menu-press-flash pointer-events-none fixed z-[100]"
      style={{
        left: press.x,
        top: press.y,
        width: press.width,
        height: press.height,
        borderRadius: press.radius,
      }}
      onAnimationEnd={() =>
        setPress((current) => (current?.id === press.id ? null : current))
      }
    />
  ) : null;
}
