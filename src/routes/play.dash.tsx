import { submitIfFriend } from "@/lib/duel/friend-match";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { OpponentOutBanner } from "@/components/duel/OpponentOutBanner";
import { useDuel } from "@/lib/duel/provider";
import { MatchBalance } from "@/components/duel/MatchBalance";
import { sfx, startMusic } from "@/lib/duel/audio";
import {
  createObstacleFeed,
  simulateSurvivalOpponent,
} from "@/lib/duel/engine/survival";
import { ladderPrizeUnits } from "@/lib/duel/ladder";
import { setupCanvasArena } from "@/lib/duel/canvas";
export const Route = createFileRoute("/play/dash")({ component: DinoRun });
function DinoRun() {
  const nav = useNavigate(),
    { activeMatch, finishSurvivalMatch, ready, profile, wagerEur, ladder } =
      useDuel();
  const [score, setScore] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null),
    arenaRef = useRef<HTMLElement | null>(null);
  const h = useRef(0),
    vel = useRef(0),
    scr = useRef(0),
    sc = useRef(0),
    done = useRef(false),
    raf = useRef<number | null>(null),
    last = useRef(0);
  const seed = activeMatch?.seed ?? 1,
    feed = useMemo(() => createObstacleFeed(seed), [seed]),
    bot = useMemo(
      () =>
        activeMatch
          ? simulateSurvivalOpponent(seed, activeMatch.opponent, "dash")
          : 0,
      [seed, activeMatch],
    );
  useEffect(() => startMusic("dash"), []);
  useEffect(() => {
    if (ready && !activeMatch && !done.current) nav({ to: "/" });
  }, [ready, activeMatch, nav]);
  const end = () => {
    if (done.current) return;
    done.current = true;
    if (raf.current) cancelAnimationFrame(raf.current);
    sfx.miss();
    const friend = activeMatch?.friend;
    if (friend) {
      void submitIfFriend(activeMatch!, sc.current).then(() =>
        nav({ to: "/challenge/$code", params: { code: friend.code } }),
      );
      return;
    }
    const o = finishSurvivalMatch({
      playerScore: sc.current,
      opponentScore: bot,
    });
    setTimeout(() => {
      if (o) {
        o.won ? sfx.win() : sfx.lose();
        nav({ to: "/result" });
      } else nav({ to: "/" });
    }, 700);
  };
  useEffect(() => {
    if (!activeMatch) return;
    const canvas = canvasRef.current,
      arena = arenaRef.current;
    if (!canvas || !arena) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { size, disconnect } = setupCanvasArena(canvas, arena, ctx);
    last.current = performance.now();
    const tick = (now: number) => {
      if (done.current) return;
      const dt = Math.min(1 / 30, (now - last.current) / 1000);
      last.current = now;
      vel.current -= 164 * dt;
      h.current = Math.max(0, h.current + vel.current * dt);
      if (h.current === 0) vel.current = 0;
      scr.current += (78 + Math.min(44, sc.current * 0.48)) * dt;
      let passed = 0;
      for (const o of feed) {
        const x = o.x - scr.current;
        const obstacleW = Math.max(5, o.size * 0.45),
          halfPlayer = (14 / size.width) * 100;
        if (x + obstacleW < 22 - halfPlayer) passed++;
        const obstacleH = Math.min(26, 22 + o.size * 0.18);
        if (
          x < 22 + halfPlayer &&
          x + obstacleW > 22 - halfPlayer &&
          h.current < obstacleH
        ) {
          end();
          return;
        }
      }
      if (passed !== sc.current) {
        sc.current = passed;
        setScore(passed);
      }
      if (passed === feed.length) {
        end();
        return;
      }
      const w = size.width,
        hh = size.height,
        ground = hh * 0.82;
      ctx.clearRect(0, 0, w, hh);
      ctx.fillStyle = "#888";
      ctx.fillRect(0, ground, w, 3);
      ctx.fillStyle = "#eee";
      ctx.fillRect(w * 0.22 - 14, ground - h.current - 28, 28, 28);
      ctx.fillStyle = "#777";
      for (const o of feed) {
        const xp = o.x - scr.current;
        if (xp < -15 || xp > 120) continue;
        const ow = (w * Math.max(5, o.size * 0.45)) / 100,
          oh = Math.min(26, 22 + o.size * 0.18);
        ctx.fillRect((w * xp) / 100, ground - oh, ow, oh);
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      disconnect();
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [activeMatch, feed]);
  if (!activeMatch) return null;
  const leap = () => {
    if (!done.current && h.current <= 1) {
      vel.current = 104;
      sfx.tap();
    }
  };
  const fall = () => {
    if (!done.current && h.current > 1) {
      vel.current = Math.min(vel.current, -176);
      sfx.tap();
    }
  };
  return (
    <main className="mx-auto flex h-[100dvh] w-full max-w-md touch-none select-none flex-col overflow-hidden bg-background">
      <MatchBalance coins={profile.coins} wagerEur={wagerEur} />
      <div className="flex justify-between px-5 py-2 text-xs">
        <b>DINO RUN · {score}</b>
        <span className="text-muted-foreground">
          vs {activeMatch.opponent.username}
        </span>
      </div>
      <section
        ref={arenaRef}
        className="relative min-h-0 flex-1 overflow-hidden bg-card"
      >
        <OpponentOutBanner
          opponentName={activeMatch.opponent.username}
          opponentScore={bot}
          playerScore={score}
          wagerEur={wagerEur}
          securedEur={
            ladder?.active && ladder.gameId === "dash"
              ? ladderPrizeUnits(ladder) / 100
              : undefined
          }
          outAfterMs={Math.max(900, bot * 720)}
          label="obstacles"
        />
        <canvas
          ref={canvasRef}
          className="pointer-events-none absolute inset-0"
        />
        <p className="pointer-events-none absolute left-4 top-4 text-[10px] text-muted-foreground">
          SPEED + WITH SCORE
        </p>
      </section>
      <div className="grid grid-cols-2 gap-3 p-3 pb-[max(12px,env(safe-area-inset-bottom))]">
        <button
          type="button"
          onPointerDown={leap}
          className="min-h-20 rounded-2xl bg-primary font-display text-lg font-bold text-primary-foreground"
        >
          ↑ JUMP
        </button>
        <button
          type="button"
          onPointerDown={fall}
          className="min-h-20 rounded-2xl border border-border bg-card font-display text-lg font-bold"
        >
          ↓ FAST FALL
        </button>
      </div>
    </main>
  );
}
