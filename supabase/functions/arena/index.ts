import { createClient } from "npm:@supabase/supabase-js@2.116.0";
import {
  command,
  initialAccount,
  settleChallenge,
  view,
  type Account,
  type Challenge,
  type Command,
  isRankedAccount,
} from "../_shared/arena-domain.ts";
import { arenaSocket } from "./socket.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...cors,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
const allowed = new Set([
  "id",
  "action",
  "gameId",
  "wagerEur",
  "mode",
  "code",
  "paymentMode",
  "matchId",
  "seq",
  "input",
  "avatar",
  "amountUnits",
]);
Deno.serve(async (req: Request) => {
  if (req.headers.get("upgrade")?.toLowerCase() === "websocket")
    return arenaSocket(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  try {
    const header = req.headers.get("Authorization");
    if (!header?.startsWith("Bearer "))
      return json({ error: "Login required" }, 401);
    const {
      data: { user },
      error: authError,
    } = await db.auth.getUser(header.slice(7));
    if (authError || !user) return json({ error: "Login required" }, 401);
    const raw = await req.text();
    if (raw.length > 1024) return json({ error: "Request too large" }, 413);
    let b: Command;
    try {
      b = JSON.parse(raw);
    } catch {
      return json({ error: "Invalid JSON" }, 400);
    }
    if (
      !b ||
      typeof b !== "object" ||
      Array.isArray(b) ||
      Object.keys(b).some((k) => !allowed.has(k)) ||
      typeof b.action !== "string" ||
      typeof b.id !== "string"
    )
      return json(
        {
          error:
            "Only game commands are accepted; scores and client times are forbidden",
        },
        400,
      );
    if (["input", "tick", "begin"].includes(b.action))
      return json(
        { error: "Gameplay requires an authenticated arena connection" },
        409,
      );
    const received = Date.now();
    const { data: identity, error: identityError } = await db
      .from("demo_accounts")
      .select("username")
      .eq("user_id", user.id)
      .single();
    if (identityError || !identity)
      return json({ error: "Account unavailable" }, 403);
    if (b.action === "leaderboard") {
      const { data, error } = await db
        .from("arena_accounts")
        .select("state->profile")
        .order("state->profile->rating", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return json({
        entries: (data ?? [])
          .map((row) => row.profile as Account["profile"])
          .filter(isRankedAccount)
          .slice(0, 100)
          .map((p) => ({
            id: p.id,
            username: p.username,
            avatar: p.avatar,
            rating: p.rating,
            wins: p.wins,
            isPlayer: p.id === user.id,
          })),
      });
    }
    // UUID-based request keys make creation retryable across network failures.
    const digest = new Uint8Array(
      await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(user.id + ":" + b.id),
      ),
    );
    const code = Array.from(
      digest.slice(0, 10),
      (n) => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[n % 32],
    ).join("");
    const entropy = {
      id: crypto.randomUUID(),
      seed: crypto.getRandomValues(new Uint32Array(1))[0]!,
      privateSeed: crypto.getRandomValues(new Uint32Array(1))[0]!,
      code,
    };
    for (let attempt = 0; attempt < 4; attempt++) {
      const loaded = await db
        .from("arena_accounts")
        .select("state,revision")
        .eq("user_id", user.id)
        .maybeSingle();
      const { error } = loaded;
      let row = loaded.data;
      if (error) throw error;
      if (!row) {
        const inserted = await db
          .from("arena_accounts")
          .insert({
            user_id: user.id,
            state: initialAccount(user.id, identity.username),
          })
          .select("state,revision")
          .maybeSingle();
        if (inserted.error && inserted.error.code !== "23505")
          throw inserted.error;
        if (!inserted.data) continue;
        row = inserted.data;
      }
      const a = row.state as Account;
      // Usernames are derived from the server-owned identity, never from commands.
      a.profile.id = user.id;
      a.profile.username = identity.username;
      const requestedCode =
        b.action === "create"
          ? code
          : typeof b.code === "string"
            ? b.code.toUpperCase()
            : a.active?.match.friend?.code;
      let c: Challenge | null = null,
        cRevision = -1;
      if (requestedCode) {
        if (!/^[A-Z2-9]{6,12}$/.test(requestedCode))
          return json({ error: "Invalid challenge code" }, 400);
        const result = await db
          .from("arena_challenges")
          .select("state,revision")
          .eq("code", requestedCode)
          .maybeSingle();
        if (result.error) throw result.error;
        if (result.data) {
          c = result.data.state as Challenge;
          cRevision = result.data.revision;
        } else if (b.action !== "create")
          return json({ error: "Challenge not found" }, 404);
      }
      if (a.requests.includes(b.id))
        return json({ ...view(a, c, Date.now()), revision: row.revision });
      const previous = structuredClone(a),
        oldChallenge = c ? JSON.stringify(c) : null;
      const dependencies: { code: string; revision: number }[] = c
        ? [{ code: c.code, revision: cRevision }]
        : [];
      const sessions: {
        code: string;
        token: string;
        role: string;
        seed: number;
        expiresAt: string;
      }[] = [];
      // Account refresh settles completed and expired reservations on the server.
      if (b.action === "account") {
        const result = await db
          .from("arena_challenges")
          .select("state,revision")
          .in("code", Object.keys(a.reserved));
        if (result.error) throw result.error;
        for (const item of result.data ?? []) {
          const challenge = item.state as Challenge;
          settleChallenge(a, challenge, Date.now());
          if (!dependencies.some((d) => d.code === challenge.code))
            dependencies.push({
              code: challenge.code,
              revision: item.revision,
            });
          if (
            !challenge.winner &&
            Date.parse(challenge.expires_at) > Date.now()
          )
            sessions.push({
              code: challenge.code,
              token: "account",
              role: challenge.creator_id === user.id ? "creator" : "guest",
              seed: challenge.seed,
              expiresAt: challenge.expires_at,
            });
        }
      }
      const now = Date.now();
      try {
        c = command(
          a,
          c,
          b,
          Math.max(now, a.active?.engine?.time ?? now),
          entropy,
        );
      } catch (e) {
        return json(
          { error: e instanceof Error ? e.message : "Invalid command" },
          409,
        );
      }
      const change = c && JSON.stringify(c) !== oldChallenge ? c : null;
      const { data: committed, error: commitError } = await db.rpc(
        "commit_arena",
        {
          owner_id: user.id,
          expected_revision: row.revision,
          next_account: a,
          challenge_code: change?.code ?? null,
          expected_challenge_revision: cRevision,
          next_challenge: change,
          request_id: b.id,
          read_challenges: dependencies,
          event_details: {
            command: b,
            receivedAt: received,
            appliedAt: now,
            previousCoins: previous.profile.coins,
            nextCoins: a.profile.coins,
            ...(b.action === "begin" ? { run: a.active } : {}),
            ...(previous.active && !a.active
              ? { completedRun: previous.active, outcome: a.lastOutcome }
              : {}),
          },
        },
      );
      if (commitError) throw commitError;
      if (committed)
        return json({
          ...view(a, c, Date.now()),
          revision: row.revision + 1,
          ...(b.action === "account" ? { sessions } : {}),
        });
    }
    return json({ error: "Concurrent update. Retry the same command." }, 409);
  } catch (e) {
    console.error(
      "Arena operation failed",
      e instanceof Error ? e.message : "database",
    );
    return json({ error: "Service temporarily unavailable" }, 503);
  }
});
