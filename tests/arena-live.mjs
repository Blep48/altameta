// Explicit opt-in: creates two disposable demo accounts on the configured backend.
// No passwords or tokens are printed. All stakes are play money.
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
if (process.env.RUN_ARENA_LIVE !== "1")
  throw new Error(
    "Set RUN_ARENA_LIVE=1 to run the live demo integration checks.",
  );
const base = "https://uhazmkzewagtalbyzgcj.supabase.co",
  key = "sb_publishable_Onsx-GUCZWzWmb93TsMbwQ_5hfJJCw3";
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function user(label) {
  const username = `qa_${label}_${Date.now().toString(36)}`,
    password = randomBytes(24).toString("hex");
  const reg = await fetch(base + "/functions/v1/demo-register", {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  assert.equal(reg.status, 201, "registration");
  const db = createClient(base, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await db.auth.signInWithPassword({
    email: username + "@users.altameta.invalid",
    password,
  });
  assert.ifError(error);
  return { db, token: data.session.access_token, id: data.user.id };
}
async function raw(u, body) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const r = await fetch(base + "/functions/v1/arena", {
      method: "POST",
      headers: {
        apikey: key,
        ...(u ? { Authorization: "Bearer " + u.token } : {}),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if ([502, 503, 504].includes(r.status) && attempt < 2) {
      await r.text();
      console.log(
        `Retry temporary HTTP ${r.status} for ${body.action} with the same request ID`,
      );
      await pause(250 * (attempt + 1));
      continue;
    }
    const text = await r.text();
    try {
      return { status: r.status, data: JSON.parse(text) };
    } catch {
      throw new Error(
        `Arena ${body.action} returned non-JSON HTTP ${r.status}`,
      );
    }
  }
  throw new Error("Arena retry limit reached");
}
async function call(u, action, fields = {}, id = randomUUID()) {
  const r = await raw(u, { id, action, ...fields });
  assert.equal(r.status, 200, `${action}: ${r.data.error ?? ""}`);
  return r.data;
}
async function play(u, matchId, kind = "green") {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(
      base.replace("https:", "wss:") + "/functions/v1/arena",
    );
    let seq = 0,
      round = -1,
      settled = false;
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error("Arena timeout"));
    }, 50000);
    ws.onopen = () => ws.send(JSON.stringify({ token: u.token, matchId }));
    ws.onerror = () => {
      clearTimeout(timeout);
      reject(new Error("WebSocket failure"));
    };
    ws.onmessage = (e) => {
      const v = JSON.parse(e.data);
      if (v.error) {
        clearTimeout(timeout);
        ws.close();
        reject(new Error(v.error));
        return;
      }
      if (v.committed) {
        settled = true;
        clearTimeout(timeout);
        resolve(v);
        return;
      }
      const s = v.engine;
      if (!s) return;
      if (kind === "invalid") {
        ws.send(JSON.stringify({ seq: 1, input: "tap", score: 999999 }));
        return;
      }
      if (
        s.game === "reaction" &&
        s.index !== round &&
        v.serverTime >= s.start &&
        (kind === "early"
          ? !s.phase || s.time >= s.phase
          : s.next > 0 && s.time >= s.next)
      ) {
        round = s.index;
        ws.send(JSON.stringify({ seq: ++seq, input: "tap" }));
      }
    };
    ws.onclose = () => {
      clearTimeout(timeout);
      if (!settled) reject(new Error("Arena closed before committed result"));
    };
  });
}
const a = await user("arena_a"),
  b = await user("arena_b");
await call(a, "account");
await call(b, "account");
console.log("PASS registration and authenticated account initialization");
assert.equal(
  (await raw(null, { id: randomUUID(), action: "account" })).status,
  401,
);
for (const table of ["arena_accounts", "arena_challenges", "arena_events"]) {
  const r = await a.db.from(table).select("*");
  assert.ok(r.error, `${table} must deny direct reads`);
}
const direct = await a.db.rpc("commit_arena", {
  owner_id: a.id,
  expected_revision: 0,
  next_account: {},
  challenge_code: null,
  expected_challenge_revision: -1,
  next_challenge: null,
  request_id: randomUUID(),
  event_details: {},
});
assert.ok(direct.error);
for (const action of ["input", "begin", "tick", "submit", "reset"])
  assert.notEqual(
    (await raw(a, { id: randomUUID(), action, score: 999999 })).status,
    200,
  );
assert.notEqual(
  (
    await raw(a, {
      id: randomUUID(),
      action: "start",
      gameId: "dash",
      wagerEur: 1,
      mode: "duel",
    })
  ).status,
  200,
);
console.log(
  "PASS anonymous denial, private tables, privileged RPC denial, forged-score rejection and Dino removal",
);
const starts = await Promise.all([
  call(a, "start", { gameId: "reaction", wagerEur: 1, mode: "duel" }),
  call(a, "start", { gameId: "reaction", wagerEur: 1, mode: "duel" }),
]);
assert.equal(starts[0].activeMatch.id, starts[1].activeMatch.id);
assert.equal((await call(a, "account")).account.profile.coins, 9900);
const duel = await play(a, starts[0].activeMatch.id);
assert.equal(duel.lastOutcome.won, true);
assert.equal(duel.account.profile.coins, 10090);
assert.equal(duel.account.profile.wins, 1);
assert.equal((await call(a, "account")).account.profile.coins, 10090);
console.log(
  "PASS concurrent start charges once; live Reaction inputs produce one server-settled win and €1.90 payout",
);
const createId = randomUUID();
const made = await call(
  a,
  "create",
  { gameId: "reaction", wagerEur: 1, paymentMode: "demo" },
  createId,
);
const again = await call(
  a,
  "create",
  { gameId: "reaction", wagerEur: 1, paymentMode: "demo" },
  createId,
);
assert.equal(made.challenge.code, again.challenge.code);
assert.equal(made.account.profile.coins, again.account.profile.coins);
const code = made.challenge.code;
assert.notEqual(
  (await raw(a, { id: randomUUID(), action: "join", code })).status,
  200,
);
await call(b, "join", { code });
const [ma, mb] = await Promise.all([
  call(a, "start", { mode: "friend", gameId: "reaction", wagerEur: 1, code }),
  call(b, "start", { mode: "friend", gameId: "reaction", wagerEur: 1, code }),
]);
await Promise.all([
  play(a, ma.activeMatch.id, "green"),
  play(b, mb.activeMatch.id, "early"),
]);
const result = await call(a, "get", { code });
assert.equal(result.challenge.winner, "creator");
assert.equal(result.account.profile.coins, 10180);
const loser = await call(b, "get", { code });
assert.equal(loser.account.profile.coins, 9900);
const duplicate = await call(a, "get", { code });
assert.equal(duplicate.account.profile.coins, 10180);
console.log(
  "PASS authenticated friend runs, server winner, creator/joiner debits, atomic settlement and replay protection",
);
const leaders = await call(a, "leaderboard");
assert.ok(leaders.entries.some((e) => e.id === a.id && e.wins === 2));
const attackMatch = await call(a, "start", {
  gameId: "stack",
  wagerEur: 1,
  mode: "duel",
});
await new Promise((resolve, reject) => {
  const ws = new WebSocket(
    base.replace("https:", "wss:") + "/functions/v1/arena",
  );
  let duplicateSocket,
    challenged = false,
    denied = false,
    rejectedScore = false;
  const timeout = setTimeout(() => {
    ws.close();
    duplicateSocket?.close();
    reject(new Error("Adversarial WebSocket timeout"));
  }, 40000);
  ws.onopen = () =>
    ws.send(
      JSON.stringify({ token: a.token, matchId: attackMatch.activeMatch.id }),
    );
  ws.onerror = () => reject(new Error("WebSocket failure"));
  ws.onmessage = (e) => {
    const v = JSON.parse(e.data);
    if (v.error) {
      rejectedScore = /Only ordered inputs/.test(v.error);
      return;
    }
    if (v.committed) {
      clearTimeout(timeout);
      try {
        assert.ok(denied && rejectedScore);
        assert.equal(v.lastOutcome.won, false);
        assert.equal(v.account.profile.coins, 10080);
        assert.equal(v.account.profile.losses, 1);
        resolve();
      } catch (error) {
        reject(error);
      }
      return;
    }
    if (!v.engine || challenged) return;
    challenged = true;
    duplicateSocket = new WebSocket(
      base.replace("https:", "wss:") + "/functions/v1/arena",
    );
    duplicateSocket.onopen = () =>
      duplicateSocket.send(
        JSON.stringify({ token: a.token, matchId: attackMatch.activeMatch.id }),
      );
    duplicateSocket.onmessage = (event) => {
      const result = JSON.parse(event.data);
      if (!result.error) return;
      denied = /already started/.test(result.error);
      duplicateSocket.close();
      ws.send(
        JSON.stringify({ seq: 1, input: "tap", score: 999999, won: true }),
      );
    };
  };
});
assert.equal((await call(a, "account")).account.profile.coins, 10080);
console.log(
  "PASS exclusive WebSocket lease, forged result rejection, forfeiture and no duplicate credit",
);
await a.db.auth.signOut();
await b.db.auth.signOut();
console.log("PASS server-only leaderboard; all live checks complete");
