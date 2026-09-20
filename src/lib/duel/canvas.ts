export interface CanvasArenaSize {
  width: number;
  height: number;
  dpr: number;
}

export function setupCanvasArena(
  canvas: HTMLCanvasElement,
  arena: HTMLElement,
  ctx: CanvasRenderingContext2D,
) {
  const size: CanvasArenaSize = { width: 1, height: 1, dpr: 1 };

  const resize = () => {
    const rect = arena.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    size.width = Math.max(1, rect.width);
    size.height = Math.max(1, rect.height);
    size.dpr = dpr;
    canvas.width = Math.max(1, Math.round(size.width * dpr));
    canvas.height = Math.max(1, Math.round(size.height * dpr));
    canvas.style.width = size.width + "px";
    canvas.style.height = size.height + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  resize();
  const observer = new ResizeObserver(resize);
  observer.observe(arena);

  return { size, disconnect: () => observer.disconnect() };
}
