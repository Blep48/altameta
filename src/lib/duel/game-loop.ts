export type FrameCallback = (dt: number, now: number) => void;

/**
 * Lightweight arena loop. Rendering follows the display refresh rate while
 * simulation time is clamped so a background-tab stall cannot create a huge
 * physics jump.
 */
export function startGameLoop(frame: FrameCallback, maxDeltaSeconds = 1 / 30) {
  let raf = 0;
  let running = true;
  let previous = performance.now();

  const tick = (now: number) => {
    if (!running) return;
    const dt = Math.min(maxDeltaSeconds, Math.max(0, (now - previous) / 1000));
    previous = now;
    frame(dt, now);
    if (running) raf = requestAnimationFrame(tick);
  };

  raf = requestAnimationFrame(tick);
  return () => {
    running = false;
    cancelAnimationFrame(raf);
  };
}

/** Monotonic high-resolution clock for competitive input measurements. */
export const inputNow = () => performance.now();
