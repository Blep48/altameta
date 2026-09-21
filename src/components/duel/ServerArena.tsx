import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  arenaCall,
  publishArenaView,
  type ArenaView,
} from "@/lib/duel/arena-client";
import { supabase, SUPABASE_URL } from "@/lib/account/client";
import { useDuel } from "@/lib/duel/provider";
import { MINIGAMES } from "@/lib/duel/games";
import { MatchBalance } from "./MatchBalance";
import { sfx, startMusic } from "@/lib/duel/audio";
import { setupCanvasArena } from "@/lib/duel/canvas";
import {
  advance,
  arrows,
  board,
  memoryHideAt,
  obstacles,
  rhythmChart,
  target,
  type Engine,
  type Game,
  type Input,
} from "../../../supabase/functions/_shared/arena-engine";

const symbols: Record<string, string> = {
  up: "↑",
  down: "↓",
  left: "←",
  right: "→",
};
/** Rendering predicts movement only. Scores, result screens and balances use server replies. */
function draw(
  ctx: CanvasRenderingContext2D,
  s: Engine,
  w: number,
  h: number,
  now: number,
) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#8b5cf6";
  ctx.strokeStyle = "#eee";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const elapsed = s.time - s.start;
  if (now < s.start) {
    ctx.fillStyle = "#eee";
    ctx.font = "bold 48px sans-serif";
    ctx.fillText(
      String(Math.max(1, Math.ceil((s.start - now) / 1000))),
      w / 2,
      h / 2,
    );
    return;
  }
  if (s.game === "reaction") {
    const green = s.next > 0 && now >= s.next;
    ctx.fillStyle = green ? "#22c55e" : "#392342";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 38px sans-serif";
    ctx.fillText(green ? "TAP!" : "WAIT…", w / 2, h / 2);
    ctx.font = "16px sans-serif";
    ctx.fillText(`ROUND ${Math.min(5, s.index + 1)} / 5`, w / 2, h / 2 + 55);
  } else if (s.game === "flappy") {
    for (const o of obstacles(s.seed)) {
      const x = ((o.x - s.scroll) * w) / 100;
      if (x < -w * 0.15 || x > w * 1.2) continue;
      const gap = Math.max(18, o.gap - Math.min(s.score, 30) * 0.55),
        width = (Math.max(2.5, o.size * 0.68) * w) / 100;
      ctx.fillRect(x, 0, width, ((o.y - gap / 2) * h) / 100);
      ctx.fillRect(x, ((o.y + gap / 2) * h) / 100, width, h);
    }
    ctx.fillStyle = "#f5c542";
    ctx.beginPath();
    ctx.ellipse(
      w * 0.24,
      (s.y * h) / 100,
      w * 0.03,
      h * 0.024,
      0,
      0,
      2 * Math.PI,
    );
    ctx.fill();
    ctx.fillStyle = "#111";
    ctx.beginPath();
    ctx.arc(w * 0.25, (s.y * h) / 100 - 3, 2, 0, 2 * Math.PI);
    ctx.fill();
    ctx.fillStyle = "#f08a24";
    ctx.beginPath();
    ctx.moveTo(w * 0.265, (s.y * h) / 100);
    ctx.lineTo(w * 0.29, (s.y * h) / 100 + 4);
    ctx.lineTo(w * 0.265, (s.y * h) / 100 + 8);
    ctx.fill();
  } else if (s.game === "stack") {
    const bh = Math.max(13, Math.min(19, h * 0.032));
    s.blocks.forEach((b, i) => {
      ctx.globalAlpha = 0.55 + (i / s.blocks.length) * 0.35;
      ctx.fillRect(
        (b.x * w) / 100,
        h - 34 - (i + 1) * (bh + 2),
        (b.width * w) / 100,
        bh,
      );
    });
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#a78bfa";
    ctx.fillRect(
      (s.x * w) / 100,
      h - 34 - (s.blocks.length + 1) * (bh + 2),
      (s.width * w) / 100,
      bh,
    );
  } else if (s.game === "knife") {
    const cx = w / 2,
      cy = Math.max(125, h * 0.36),
      r = Math.min(82, w * 0.22);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = "#25232d";
    ctx.strokeStyle = "#8b5cf6";
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.rotate((s.angle * Math.PI) / 180);
    ctx.strokeStyle = "#eee";
    ctx.lineWidth = 4;
    for (const a of s.knives) {
      ctx.save();
      ctx.rotate((a * Math.PI) / 180);
      ctx.beginPath();
      ctx.moveTo(0, -r + 4);
      ctx.lineTo(0, -r - 62);
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
    if (s.projectile >= 0) {
      const yy = h - 38 + (cy + r + 58 - (h - 38)) * s.projectile;
      ctx.strokeStyle = "#eee";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(cx, yy);
      ctx.lineTo(cx, yy + 58);
      ctx.stroke();
    }
  } else if (s.game === "precision") {
    const t = target(s.seed, s.index),
      left = w * 0.08,
      width = w * 0.84;
    ctx.fillStyle = "#30273c";
    ctx.fillRect(left, h * 0.45, width, 55);
    ctx.fillStyle = "#8b5cf6";
    ctx.fillRect(
      left + (t.center - t.half) * width,
      h * 0.45,
      t.half * 2 * width,
      55,
    );
    ctx.fillStyle = "#f5c542";
    ctx.fillRect(
      left + (t.center - t.half * 0.34) * width,
      h * 0.45,
      t.half * 0.68 * width,
      55,
    );
    ctx.fillStyle = "#fff";
    ctx.fillRect(left + s.x * width - 2, h * 0.45 - 15, 4, 85);
  } else if (s.game === "rhythm") {
    ctx.fillStyle = "#444";
    ctx.fillRect(w / 2, 0, 1, h);
    ctx.fillStyle = "#f5c542";
    ctx.fillRect(0, h * 0.8, w, 3);
    for (const n of rhythmChart(s.seed).slice(s.index, s.index + 10)) {
      const y = h * 0.8 * (1 - (n.time - elapsed) / n.approach);
      if (y < -20 || y > h) continue;
      ctx.fillStyle = "#a78bfa";
      ctx.fillRect(n.lane === "left" ? w * 0.08 : w * 0.58, y, w * 0.34, 18);
    }
  } else if (s.game === "direction") {
    ctx.fillStyle = "#ef4444";
    ctx.fillRect(0, h * 0.88, w, 3);
    ctx.font = "bold 62px sans-serif";
    for (const a of arrows(s.seed).slice(s.index, s.index + 7)) {
      const y = ((elapsed - a.spawn) / a.travel) * h * 0.88;
      if (y < 0 || y > h) continue;
      ctx.fillStyle = "#a78bfa";
      ctx.fillText(symbols[a.direction]!, w / 2, y);
    }
  } else if (s.game === "memory") {
    const cells = board(s.seed, s.score),
      visible = s.time < memoryHideAt(s),
      phase = s.time - s.start - s.phase;
    cells.forEach((cell, i) => {
      if (s.selected.includes(cell)) return;
      const x = ((cell % 4) * w) / 4 + w * 0.025,
        y = Math.floor(cell / 4) * h * 0.2 + h * 0.08;
      ctx.fillStyle = "#6d43ae";
      ctx.fillRect(x, y, w * 0.2, h * 0.15);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 28px sans-serif";
      if (visible && (phase < 1000 || Math.floor((phase - 1000) / 140) === i))
        ctx.fillText(String(i + 1), x + w * 0.1, y + h * 0.075);
    });
  }
}

export function ServerArena({ game }: { game: Game }) {
  const { activeMatch, profile, wagerEur, ready } = useDuel(),
    nav = useNavigate();
  const canvas = useRef<HTMLCanvasElement>(null),
    arena = useRef<HTMLElement>(null);
  const snapshot = useRef<{
      view: Pick<ArenaView, "engine" | "serverTime" | "seq">;
      received: number;
    } | null>(null),
    socketRef = useRef<WebSocket | null>(null),
    nextSeq = useRef(0),
    closed = useRef(false),
    pointer = useRef<{ x: number; y: number } | null>(null);
  const [score, setScore] = useState(0),
    [error, setError] = useState(""),
    [connected, setConnected] = useState(false);
  const clock = useRef<{ offset: number; rtt: number } | null>(null);
  const matchId = activeMatch?.id,
    friendCode = activeMatch?.friend?.code;
  useEffect(() => startMusic(game === "memory" ? "monkey" : game), [game]);
  useEffect(() => {
    if (ready && !activeMatch && !closed.current) void nav({ to: "/" });
  }, [ready, activeMatch, nav]);
  useEffect(() => {
    if (!matchId) return;
    let live = true,
      ws: WebSocket | null = null,
      settled = false,
      pings: ReturnType<typeof setInterval> | undefined;
    const pendingPings = new Map<number, number>();
    let pingId = 0;
    closed.current = false;
    clock.current = null;
    setConnected(false);
    snapshot.current = null;
    nextSeq.current = 0;
    const connect = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("Login required");
      if (!live) return;
      ws = new WebSocket(
        SUPABASE_URL.replace("https:", "wss:") + "/functions/v1/arena",
      );
      socketRef.current = ws;
      ws.onopen = () =>
        ws?.send(JSON.stringify({ token: session.access_token, matchId }));
      ws.onmessage = (event) => {
        if (!live) return;
        const v = JSON.parse(event.data);
        if (typeof v.pong === "number") {
          const sent = pendingPings.get(v.pong);
          pendingPings.delete(v.pong);
          if (sent != null) {
            const rtt = performance.now() - sent;
            if (!clock.current || rtt < clock.current.rtt * 1.2)
              clock.current = {
                offset: v.serverTime + rtt / 2 - performance.now(),
                rtt,
              };
          }
          return;
        }
        if (v.error) {
          setError(v.error);
          return;
        }
        if (v.committed) {
          settled = true;
          closed.current = true;
          publishArenaView(v);
          if (friendCode)
            void nav({ to: "/challenge/$code", params: { code: friendCode } });
          else {
            if (v.lastOutcome?.won) sfx.win();
            else sfx.lose();
            void nav({ to: "/result" });
          }
          return;
        }
        if (v.matchId !== matchId) return;
        if (!pings) {
          const ping = () => {
            const id = ++pingId;
            pendingPings.set(id, performance.now());
            if (ws?.readyState === WebSocket.OPEN)
              ws.send(JSON.stringify({ ping: id }));
          };
          ping();
          pings = setInterval(ping, 2000);
        }
        snapshot.current = { view: v, received: performance.now() };
        setConnected(true);
        setError("");
        if (v.engine) setScore(v.engine.score);
      };
      ws.onerror = () => {
        if (live)
          setError("Connection lost. The server is checking the result.");
      };
      ws.onclose = () => {
        if (!live || settled) return;
        setConnected(false);
        setError("Connection closed. Return home to check your result.");
        void arenaCall("account").catch(() => {});
      };
    };
    void connect().catch((e) => {
      if (live) setError(e.message);
    });
    return () => {
      live = false;
      clearInterval(pings);
      socketRef.current = null;
      ws?.close();
    };
  }, [matchId, friendCode, nav]);
  useEffect(() => {
    const c = canvas.current,
      element = arena.current;
    if (!c || !element) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const { size, disconnect } = setupCanvasArena(c, element, ctx);
    let frame = 0;
    const render = () => {
      const sample = snapshot.current;
      if (sample?.view.engine) {
        const s = structuredClone(sample.view.engine),
          now = clock.current
            ? performance.now() + clock.current.offset
            : sample.view.serverTime +
              Math.min(300, performance.now() - sample.received);
        if (s.game !== "reaction") advance(s, now);
        draw(ctx, s, size.width, size.height, now);
      }
      frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(frame);
      disconnect();
    };
  }, [matchId]);
  const send = (command: Input) => {
    const socket = socketRef.current;
    if (
      !connected ||
      error ||
      closed.current ||
      socket?.readyState !== WebSocket.OPEN
    )
      return;
    socket.send(JSON.stringify({ seq: ++nextSeq.current, input: command }));
    sfx.tap();
  };
  const tap = (x: number, y: number) => {
    const bounds = arena.current?.getBoundingClientRect();
    if (!bounds) return;
    if (game === "rhythm")
      send(x - bounds.left < bounds.width / 2 ? "left" : "right");
    else if (game === "memory") {
      const rx = (x - bounds.left) / bounds.width,
        ry = (y - bounds.top) / bounds.height;
      const col = Math.floor(rx * 4),
        row = Math.floor((ry - 0.08) / 0.2);
      if (
        col >= 0 &&
        col < 4 &&
        row >= 0 &&
        row < 4 &&
        rx - col * 0.25 >= 0.025 &&
        rx - col * 0.25 <= 0.225 &&
        ry - 0.08 - row * 0.2 <= 0.15
      )
        send(`cell:${row * 4 + col}`);
    } else if (game !== "direction") send("tap");
  };
  if (!activeMatch) return null;
  return (
    <main className="mx-auto flex h-[100dvh] w-full max-w-md touch-none select-none flex-col overflow-hidden bg-background">
      <MatchBalance coins={profile.coins} wagerEur={wagerEur} />
      <div className="flex justify-between px-5 py-2 text-xs">
        <b>
          {MINIGAMES.find((g) => g.id === game)?.name} · {score}
        </b>
        <span>vs {activeMatch.opponent.username}</span>
      </div>
      <section
        ref={arena}
        role="application"
        aria-label={`${game} game arena`}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.repeat) return;
          const key = e.key.replace("Arrow", "").toLowerCase();
          if (
            (game === "direction" &&
              ["up", "down", "left", "right"].includes(key)) ||
            (game === "rhythm" && ["left", "right"].includes(key))
          ) {
            e.preventDefault();
            send(key as Input);
          } else if (
            e.key === " " &&
            !["direction", "memory", "rhythm"].includes(game)
          ) {
            e.preventDefault();
            send("tap");
          }
        }}
        onPointerDown={(e) => {
          pointer.current = { x: e.clientX, y: e.clientY };
          e.currentTarget.setPointerCapture(e.pointerId);
          tap(e.clientX, e.clientY);
        }}
        onPointerUp={(e) => {
          const p = pointer.current;
          pointer.current = null;
          if (game !== "direction" || !p) return;
          const dx = e.clientX - p.x,
            dy = e.clientY - p.y;
          if (Math.max(Math.abs(dx), Math.abs(dy)) < 15) return;
          send(
            Math.abs(dx) > Math.abs(dy)
              ? dx > 0
                ? "right"
                : "left"
              : dy > 0
                ? "down"
                : "up",
          );
        }}
        className="relative min-h-0 flex-1 overflow-hidden border-y border-border bg-card"
      >
        <canvas ref={canvas} className="pointer-events-none absolute inset-0" />
        {!connected && (
          <p role="status" className="absolute inset-0 grid place-items-center">
            Connecting to arena…
          </p>
        )}
        {error && (
          <div
            role="alert"
            className="absolute inset-0 grid place-content-center bg-background/90 p-6 text-center"
          >
            <p>{error}</p>
            <p className="mt-3 text-sm">The server keeps the result.</p>
            <button
              className="mt-4 rounded-xl border p-3"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => void nav({ to: "/" })}
            >
              Back to home
            </button>
          </div>
        )}
        <p className="pointer-events-none absolute bottom-3 inset-x-0 text-center text-[10px] text-muted-foreground">
          {game === "direction"
            ? "SWIPE THE ARROWS"
            : game === "memory"
              ? "TAP THE SQUARES IN ORDER"
              : game === "rhythm"
                ? "TAP LEFT OR RIGHT ON THE LINE"
                : "TAP TO PLAY"}
        </p>
      </section>
    </main>
  );
}
