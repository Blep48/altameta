# Altameta Duels

Arcade demo with username/password accounts, eight games, friend challenges and an Infinite Ladder. All balances are play money. Dino Run is retired.

## Authority and persistence

The browser sends ordered controls over an authenticated WebSocket. It does not submit scores, timestamps, wins or wallet changes. The `arena` Edge Function runs the game clock, physics, collision rules and scoring; it determines winners and settles balances. Browser simulation is only for drawing.

Each run has one server-owned connection and an exclusive persisted lease. Disconnecting after play starts forfeits the run; an expired worker lease also forfeits instead of accepting a replay. Runs last at most 110 seconds. Results are shown only after the database confirms settlement.

`arena_accounts`, `arena_challenges` and `arena_events` are private service-only tables. `commit_arena` atomically checks account/challenge revisions, saves the result and records the request ID. Duplicate requests cannot credit twice. The server records received inputs for completed runs. The leaderboard reads verified server profiles.

The verified demo season starts with €100 and clean statistics. Previous client-authored snapshots remain in `demo_accounts` as legacy data; they are never promoted into verified balances or results. Local storage holds preferences and navigation metadata only. The retired `friend-challenge` endpoint returns 410; queued browser score uploads are no longer supported.

## Economy

- Duel and demo friend-challenge winners receive 95% of the combined stakes: €1 + €1 returns €1.90, net gain €0.90.
- Ties return the stake. A Ladder tie preserves the streak.
- Ladder cash-out is entry × 2^wins × 0.95; continuation rounds do not charge another entry.
- IN PERSON friend results affect verified statistics, not demo balance.
- An unfinished friend challenge expires after 24 hours; reserved demo stakes are returned on the next account refresh.
- Single-player duels and Ladder opponents are explicitly demo bots. Friend outcomes come from both authenticated runs.

## Accounts

Usernames are case-insensitive, 3–20 ASCII letters/digits/underscores. Passwords are at least 8 characters and at most 72 UTF-8 bytes. Supabase Auth stores password hashes and sessions; `demo-register` maps usernames to internal email identifiers. There is no email confirmation or password recovery in this demo. The service-role credential is server-only.

## Development and verification

```sh
npm ci
npm run dev
npm test
npm run build
npm run typecheck
npm run lint
```

Unit/component tests cover the eight engines, settlement, friend ownership/expiry, replay protection, account isolation and the input-only UI protocol. The former mocked browser-score smoke test has been retired because it exercised the removed trust model.

Explicitly opt in to live integration tests (creates two disposable accounts and uses demo stakes):

```sh
RUN_ARENA_LIVE=1 node tests/arena-live.mjs
```

The live test checks authentication, private-table/RPC access, forged-score rejection, concurrent starts, complete Reaction runs, €1.90 payout, friend settlement and the server leaderboard. These are API/WebSocket integration tests, not a browser usability or network-fairness certification.

## Deployment

Apply migrations in order, including `20260921155442_server_arena.sql`. Deploy `demo-register`, `arena` (including both shared modules and `socket.ts`) and the retirement stub `friend-challenge`. The arena function uses custom `auth.getUser` authentication for REST requests and the first WebSocket frame; tokens never appear in URLs. Its gateway JWT check must remain disabled for the WebSocket handshake. Anonymous gameplay remains forbidden by the function.

Git-triggered Vercel deployments are enabled. Preserve published history and merge PRs with a merge commit.

## Current limits

Server authority prevents fabricated browser scores; it does not prove a human is playing. Automated valid controls remain possible, and network latency affects timing games because only server receipt time is trusted. This demo still needs dedicated load testing, latency/fairness work, anti-automation controls, operational monitoring and the separate financial/legal requirements before any real-money launch. No deposits or withdrawals are implemented.
