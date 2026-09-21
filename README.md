# Duel Arena

Create the initial mobile-first prototype for "DUEL", a competitive 1v1 arcade minigame web app with virtual economy (Duel Coins):

1. Core Concept & Economy:
- Virtual demo currency only ("Duel Coins"), no real money or gambling.
- Default starter balance: 10,000 Duel Coins.
- Entry fee per match: 100 Duel Coins. Total winner return: 190 Duel Coins (net +90); loss: -100 Duel Coins. Commission is 5% of the combined stakes.
- Persistent local/database storage for player profile, rating (Elo/MMR style), match history, and coin balance.

2. Design & UX:
- Mobile-first, portrait orientation, dark mode arcade aesthetic (sleek competitive gaming vibe, neon accents, clean typography, large touch-friendly buttons).
- Fluid animations, quick transitions, visual and optional audio/web audio synthesis feedback (countdown beeps, success chime, false start buzz).

3. Screens & Navigation:
- HOME: DUEL logo, balance indicator, prominent "PLAY" button, player rating, quick stats, recent match history, entry points to Leaderboard and Profile.
- GAME SELECTION: List minigames ("REACTION" playable; "RHYTHM", "DIRECTION", "MEMORY", "PRECISION" marked as coming soon).
- MOCK MATCHMAKING: "Searching for opponent..." screen with radar/pulsing animation, automatically pairing within 2-4 seconds with a simulated bot opponent having believable username, avatar, rating, and realistic target reaction time.
- REACTION GAME (5 rounds):
  * "GET READY" followed by 3-2-1 countdown.
  * Random delay (1.5s - 4.5s) before screen/target turns vibrant green.
  * Measures tap response in milliseconds.
  * Detects false start if tapped early, penalizing round.
  * Displays round indicator (1/5), last round reaction time, running average, and best time.
  * Simulated opponent generates realistic reaction times per round.
- MATCH RESULT:
  * Dramatic comparison: You (e.g. 195 ms avg) vs Opponent (e.g. 215 ms avg).
  * Clear WIN / DEFEAT banner, 190 Duel Coins total return (+90 net) or -100 Duel Coins, rating delta (+/- 15 pts).
  * "REMATCH" (loops directly back into matchmaking) and "BACK TO HOME".
- PROFILE: Username, avatar picker, rating, games played, wins, losses, win rate, best reaction record, coin balance.
- LEADERBOARD: Global leaderboard with at least 20 seeded players, highlighting the current player.

4. Modular Architecture:
- Isolate UI, game logic, player data, matchmaking service, economy, and minigame engine so future real-time multiplayer and server-authoritative validation can be plugged in without refactoring the UI.
- Verify the end-to-end loop: Home -> Play -> Matchmaking -> Reaction (5 rounds) -> Result -> Rematch.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/0df3ddd1-e215-47c7-87b9-f6312f1c0424).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Reliability checks

Run `npm ci`, `npm test`, `npm run build`, then `npm run typecheck` (build generates the route types). The pull-request workflow runs the same checks.

- Duel and demo Friend Challenge winners receive 95% of the two-player pool, including their own entry. A €1 entry returns €1.90, a net gain of €0.90.
- Ladder cash-out is `entry × 2^wins × 0.95`; continuation rounds do not charge another entry.
- IN PERSON results update history/stats without changing demo balance.
- Balance, reservations, Ladder, completed results and friend sessions are saved to the signed-in demo account. Reset clears that account's progress.
- Each friend challenge has its own saved session. Failed score uploads remain on the device; open the challenge and retry the original score.
- Dino Run and Flappy finish when all 240 seeded obstacles are cleared.
- Git-triggered Vercel deployments are enabled.

## Demo accounts

Users register with a case-insensitive username (3–20 ASCII letters, digits or underscores) and a password (at least 8 characters, maximum 72 UTF-8 bytes). Supabase Auth hashes passwords and handles sessions; a server-only registration function maps usernames to internal, non-deliverable email identifiers. No email confirmation or password recovery is offered. New accounts start at €100 demo credit; old guest data is left untouched on the original device and is not automatically imported into a different identity.

Apply `supabase/migrations/20260920200403_demo_accounts.sql` and deploy `supabase/functions/demo-register/index.ts` before publishing the frontend. Registration is public with server-side validation and rate limiting. Only this Edge Function uses the service-role credential. `demo_accounts` has owner-only RLS and revision-checked saves; concurrent writes are rejected rather than silently overwriting another device's progress. The client retains failed saves per user, offers retry, and flushes before logout. Friend tokens and queued scores are included in the owner's private snapshot.

Expired friend sessions are hidden on the homepage at their expiry time; legacy sessions obtain their expiry from the API. Completed match history remains intact.

This is cloud persistence for **play money**, not a server-authoritative wallet or anti-cheat system: game results and balance calculations still originate in the client. Never enable real deposits or withdrawals on this implementation.

`npm test` includes authentication UI, save-queue, account isolation, retry and expiry regressions. `npm run test:browser` uses mocked Auth, account and challenge endpoints. Live integration verification additionally checks registration/login, independent-client restoration, owner-only read/write access, stale-save rejection, incorrect passwords and duplicate usernames.

The friend-challenge Edge Function is hosted separately from this repository. Automated tests mock its network boundary and do not write test games to the production database.

<!-- production redeploy trigger: 2026-09-19 -->
