import { submitIfFriend } from "@/lib/duel/friend-match";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useDuel } from "@/lib/duel/provider";
import { MatchBalance } from "@/components/duel/MatchBalance";
import { OpponentOutBanner } from "@/components/duel/OpponentOutBanner";
import { sfx, startMusic } from "@/lib/duel/audio";
import { createObstacleFeed, simulateSurvivalOpponent } from "@/lib/duel/engine/survival";

export const Route = createFileRoute("/play/flappy")({ component: Flappy });

function Flappy() {
  const nav = useNavigate();
  const { activeMatch, finishSurvivalMatch, ready, profile, wagerEur } = useDuel();
  const [score, setScore] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const arenaRef = useRef<HTMLElement | null>(null);
  const y = useRef(50), velocity = useRef(0), scroll = useRef(0), scoreRef = useRef(0);
  const done = useRef(false), raf = useRef<number | null>(null), last = useRef(0);
  const seed = activeMatch?.seed ?? 1;
  const feed = useMemo(() => createObstacleFeed(seed), [seed]);
  const bot = useMemo(() => activeMatch ? simulateSurvivalOpponent(seed, activeMatch.opponent, "flappy") : 0, [seed, activeMatch]);

  useEffect(() => startMusic("flappy"), []);
  useEffect(() => { if (ready && !activeMatch && !done.current) nav({ to: "/" }); }, [ready, activeMatch, nav]);

  const end = () => {
    if (done.current || !activeMatch) return;
    done.current = true;
    if (raf.current) cancelAnimationFrame(raf.current);
    sfx.miss();
    if (activeMatch.friend) {
      void submitIfFriend(activeMatch, scoreRef.current).then(() => nav({ to: "/challenge/$code", params: { code: activeMatch.friend!.code } }));
      return;
    }
    const outcome = finishSurvivalMatch({ playerScore: scoreRef.current, opponentScore: bot });
    setTimeout(() => {
      if (outcome) {
        outcome.won ? sfx.win() : sfx.lose();
        nav({ to: "/result" });
      } else nav({ to: "/" });
    }, 850);
  };

  useEffect(() => {
    if (!activeMatch) return;
    const canvas = canvasRef.current;
    const arena = arenaRef.current;
    if (!canvas || !arena) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const resize = () => {
      const rect = arena.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      canvas.style.width = rect.width + "px";
      canvas.style.height = rect.height + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(arena);

    last.current = performance.now();
    const tick = (now: number) => {
      if (done.current) return;
      const dt = Math.min(1 / 30, Math.max(0, (now - last.current) / 1000));
      last.current = now;
      velocity.current += 66 * dt;
      y.current += velocity.current * dt;
      const difficulty = Math.min(scoreRef.current, 30);
      scroll.current += (34 + difficulty * 1.15) * dt;

      let passed = 0;
      for (const obstacle of feed) {
        const x = obstacle.x - scroll.current;
        if (x < 24) passed++;
        const gap = Math.max(18, obstacle.gap - Math.min(passed, 30) * 0.55);
        if (x > 20 && x < 28 && (y.current < obstacle.gapY - gap / 2 || y.current > obstacle.gapY + gap / 2)) {
          end();
          return;
        }
      }
      if (passed !== scoreRef.current) {
        scoreRef.current = passed;
        setScore(passed);
      }
      if (y.current < 2 || y.current > 96) { end(); return; }

      const w = arena.clientWidth, h = arena.clientHeight;
      ctx.clearRect(0, 0, w, h);
      const birdX = w * 0.24, birdY = h * y.current / 100;
      ctx.save();
      ctx.translate(birdX, birdY);
      ctx.fillStyle = "#f5c542";
      ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#111"; ctx.beginPath(); ctx.arc(5, -3, 2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#f08a24"; ctx.beginPath(); ctx.moveTo(11, 0); ctx.lineTo(20, 4); ctx.lineTo(11, 7); ctx.fill();
      ctx.restore();

      ctx.fillStyle = getComputedStyle(arena).getPropertyValue("--primary").trim() || "#7c3aed";
      for (const obstacle of feed) {
        const xp = obstacle.x - scroll.current;
        if (xp < -15 || xp > 120) continue;
        const gap = Math.max(18, obstacle.gap - Math.min(scoreRef.current, 30) * 0.55);
        const x = w * xp / 100;
        const pipeW = w * Math.max(2.5, obstacle.size * 0.68) / 100;
        const topH = h * (obstacle.gapY - gap / 2) / 100;
        const bottomY = h * (obstacle.gapY + gap / 2) / 100;
        ctx.fillRect(x, 0, pipeW, topH);
        ctx.fillRect(x, bottomY, pipeW, h - bottomY);
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => { observer.disconnect(); if (raf.current) cancelAnimationFrame(raf.current); };
  }, [activeMatch, feed]);

  if (!activeMatch) return null;
  const flap = () => { if (!done.current) { velocity.current = -31; sfx.tap(); } };

  return <main onPointerDown={flap} className="mx-auto flex h-[100dvh] w-full max-w-md touch-none select-none flex-col overflow-hidden bg-background">
    <MatchBalance coins={profile.coins} wagerEur={wagerEur} />
    <div className="flex justify-between px-5 py-2 text-xs"><b>FLAPPY · {score}</b><span className="text-muted-foreground">vs {activeMatch.opponent.username}</span></div>
    <section ref={arenaRef} className="relative min-h-0 flex-1 overflow-hidden border-y border-border bg-card">
      <OpponentOutBanner opponentName={activeMatch.opponent.username} opponentScore={bot} playerScore={score} wagerEur={wagerEur} outAfterMs={Math.max(1500, bot * 1450)} label="pipes" />
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0" />
      <p className="pointer-events-none absolute bottom-4 inset-x-0 text-center text-xs text-muted-foreground">TAP TO FLAP</p>
    </section>
  </main>;
}
