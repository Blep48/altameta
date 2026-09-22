import { createClient } from "npm:@supabase/supabase-js@2.116.0";
import {
  command,
  view,
  opponentView,
  type Account,
  type Challenge,
  type Run,
} from "../_shared/arena-domain.ts";
import {
  advance,
  input,
  createEngine,
  publicEngine,
  MAX_RUN_MS,
  type Input,
} from "../_shared/arena-engine.ts";

/** One authenticated, leased connection owns a run. No browser clocks or scores.
 * A disconnect forfeits; a crashed worker's lease expires and can never be replayed.
 * In-memory progress is shown immediately; only a committed result changes the wallet.
 */
export function arenaSocket(req: Request) {
  const { socket, response } = Deno.upgradeWebSocket(req);
  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  let account: Account | null = null,
    challenge: Challenge | null = null,
    run: Run | null = null,
    userId = "",
    revision = 0;
  let initializing = false,
    finishing = false,
    finished = false,
    timer: ReturnType<typeof setInterval> | undefined;
  let release!: () => void;
  const lifetime = new Promise<void>((resolve) => {
    release = resolve;
  });
  EdgeRuntime.waitUntil(lifetime);
  const transcript: { seq: number; input: Input; receivedAt: number }[] = [];
  const connection = crypto.randomUUID();
  let burstStart = 0,
    burst = 0,
    lastSent = 0;
  let nextChallengeRead = 0,
    readingChallenge = false;
  const send = (body: unknown) => {
    if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(body));
  };
  const authTimeout = setTimeout(() => {
    if (!account) {
      send({ error: "Authentication timeout" });
      socket.close(1008);
    }
  }, 15000);
  const readChallenge = async (code?: string) => {
    if (!code) return null;
    const { data, error } = await db
      .from("arena_challenges")
      .select("state,revision")
      .eq("code", code)
      .single();
    if (error) throw error;
    return data as { state: Challenge; revision: number };
  };
  const persist = async (forfeit: boolean) => {
    if (finishing || finished || !run || !account) return;
    finishing = true;
    if (timer) clearInterval(timer);
    run.forfeited ||= forfeit;
    run.engine!.done = true;
    try {
      for (let attempt = 0; attempt < 5; attempt++) {
        const { data: row, error } = await db
          .from("arena_accounts")
          .select("state,revision")
          .eq("user_id", userId)
          .single();
        if (error) throw error;
        const fresh = row.state as Account;
        const previousCoins = fresh.profile.coins;
        if (
          fresh.active?.match.id !== run.match.id ||
          fresh.active?.connection !== connection
        ) {
          send({
            ...view(fresh, null, Date.now()),
            revision: row.revision,
            committed: true,
          });
          finished = true;
          return;
        }
        const cr = await readChallenge(run.match.friend?.code),
          now = Date.now();
        const completed = structuredClone(run);
        fresh.active = completed;
        const c = command(
          fresh,
          cr?.state ?? null,
          { id: `finish-${connection}`, action: "tick", matchId: run.match.id },
          now,
          { id: connection, seed: 0, code: "" },
        );
        const { data: ok, error: commitError } = await db.rpc("commit_arena", {
          owner_id: userId,
          expected_revision: row.revision,
          next_account: fresh,
          challenge_code: c?.code ?? null,
          expected_challenge_revision: cr?.revision ?? -1,
          next_challenge: c,
          request_id: `finish-${connection}`,
          read_challenges: cr
            ? [{ code: cr.state.code, revision: cr.revision }]
            : [],
          event_details: {
            kind: "completed-run",
            run: completed,
            inputs: transcript,
            outcome: fresh.lastOutcome,
            previousCoins,
            nextCoins: fresh.profile.coins,
          },
        });
        if (commitError) throw commitError;
        if (ok) {
          finished = true;
          send({
            ...view(fresh, c, now),
            revision: row.revision + 1,
            committed: true,
          });
          return;
        }
      }
      throw new Error("Concurrent result update");
    } catch (e) {
      console.error(
        "Arena finalization failed",
        e instanceof Error ? e.message : "database",
      );
      send({
        error: "Unable to confirm result. Reconnect to check your account.",
      });
    } finally {
      finished = true;
      finishing = false;
      if (socket.readyState === WebSocket.OPEN) socket.close(1000);
      release();
    }
  };
  const snapshot = () => {
    if (!account || !run) return;
    send({
      serverTime: Date.now(),
      engine: run.engine
        ? {
            ...publicEngine(run.engine),
            seed: run.match.gameId === "reaction" ? 0 : run.engine.seed,
          }
        : null,
      seq: run.seq,
      matchId: run.match.id,
      opponent: opponentView(run, challenge, account, Date.now()),
    });
    lastSent = Date.now();
  };
  socket.onmessage = async (event) => {
    try {
      if (typeof event.data !== "string" || event.data.length > 2048)
        throw new Error("Invalid message");
      const b = JSON.parse(event.data);
      if (!b || typeof b !== "object" || Array.isArray(b))
        throw new Error("Invalid message");
      if (!account) {
        if (initializing) throw new Error("Authentication in progress");
        initializing = true;
        if (
          Object.keys(b).some((k) => !["token", "matchId"].includes(k)) ||
          typeof b.token !== "string" ||
          typeof b.matchId !== "string"
        )
          throw new Error("Login required");
        const {
          data: { user },
          error,
        } = await db.auth.getUser(b.token);
        if (error || !user) throw new Error("Login required");
        userId = user.id;
        for (let attempt = 0; attempt < 4; attempt++) {
          const { data: row, error } = await db
            .from("arena_accounts")
            .select("state,revision")
            .eq("user_id", userId)
            .single();
          if (error) throw error;
          const a = row.state as Account;
          if (!a.active || a.active.match.id !== b.matchId)
            throw new Error("Match not active");
          if (a.active.connection || a.active.engine)
            throw new Error(
              "Run already started. Return home to check the result.",
            );
          const cr = await readChallenge(a.active.match.friend?.code),
            now = Date.now();
          const c = command(
            a,
            cr?.state ?? null,
            { id: `begin-${connection}`, action: "begin", matchId: b.matchId },
            now,
            {
              id: connection,
              seed: crypto.getRandomValues(new Uint32Array(1))[0]!,
              code: "",
            },
          );
          if (!a.active?.engine) throw new Error("Challenge expired");
          a.active.connection = connection;
          a.active.deadline = now + MAX_RUN_MS + 30000;
          const { data: ok, error: commitError } = await db.rpc(
            "commit_arena",
            {
              owner_id: userId,
              expected_revision: row.revision,
              next_account: a,
              challenge_code: c?.code ?? null,
              expected_challenge_revision: cr?.revision ?? -1,
              next_challenge: c,
              request_id: `begin-${connection}`,
              read_challenges: cr
                ? [{ code: cr.state.code, revision: cr.revision }]
                : [],
              event_details: { kind: "begin-run", run: a.active },
            },
          );
          if (commitError) throw commitError;
          if (ok) {
            account = a;
            run = a.active;
            challenge = c;
            revision = row.revision + 1;
            break;
          }
        }
        if (!account || !run) throw new Error("Could not acquire match");
        clearTimeout(authTimeout);
        if (socket.readyState !== WebSocket.OPEN) {
          await persist(true);
          return;
        }
        // Only the live worker uses this clock. Persisted leases cannot be resumed or replayed.
        run.engine = createEngine(
          run.match.gameId,
          run.engine!.seed,
          Date.now() + 1500,
        );
        snapshot();
        timer = setInterval(() => {
          if (!run?.engine || finishing || finished) return;
          if (
            run.match.friend &&
            !readingChallenge &&
            Date.now() >= nextChallengeRead
          ) {
            readingChallenge = true;
            nextChallengeRead = Date.now() + 1500;
            void readChallenge(run.match.friend.code)
              .then((row) => {
                if (row) challenge = row.state;
              })
              .catch(() => {
                /* Retry the read next interval; gameplay stays responsive. */
              })
              .finally(() => {
                readingChallenge = false;
              });
          }
          const beforeGreen =
            run.engine.next > 0 && run.engine.time >= run.engine.next;
          advance(run.engine, Date.now());
          if (run.engine.done) {
            snapshot();
            void persist(false);
            return;
          }
          const green =
            run.engine.next > 0 && run.engine.time >= run.engine.next;
          if (Date.now() - lastSent >= 50 || green !== beforeGreen) snapshot();
        }, 10);
        return;
      }
      if (finishing || finished) return;
      const now = Date.now();
      if (now - burstStart >= 1000) {
        burstStart = now;
        burst = 0;
      }
      if (++burst > 40) throw new Error("Too many messages");
      if (Object.keys(b).length === 1 && Number.isSafeInteger(b.ping)) {
        send({ pong: b.ping, serverTime: Date.now() });
        return;
      }
      if (
        Object.keys(b).some((k) => !["seq", "input"].includes(k)) ||
        !Number.isSafeInteger(b.seq) ||
        typeof b.input !== "string"
      )
        throw new Error("Only ordered inputs are accepted");
      if (!run?.engine) throw new Error("Match not ready");
      if (b.seq === run.seq && b.input === run.lastInput) {
        snapshot();
        return;
      }
      if (b.seq !== run.seq + 1) throw new Error("Input out of order");
      if (transcript.length >= 8000) throw new Error("Too many inputs");
      input(run.engine, b.input as Input, now);
      run.seq = b.seq;
      run.lastInput = b.input;
      transcript.push({ seq: b.seq, input: b.input as Input, receivedAt: now });
      snapshot();
      if (run.engine.done) await persist(false);
    } catch (e) {
      send({ error: e instanceof Error ? e.message : "Invalid command" });
      if (run) await persist(true);
      socket.close(1008);
      release();
    }
  };
  socket.onclose = () => {
    clearTimeout(authTimeout);
    if (timer) clearInterval(timer);
    if (run && !finished) void persist(true);
    else release();
  };
  socket.onerror = () => {
    if (run) void persist(true);
  };
  return response;
}
