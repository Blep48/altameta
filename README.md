# Duel Arena

Create the initial mobile-first prototype for "DUEL", a competitive 1v1 arcade minigame web app with virtual economy (Duel Coins):

1. Core Concept & Economy:
- Virtual demo currency only ("Duel Coins"), no real money or gambling.
- Default starter balance: 10,000 Duel Coins.
- Entry fee per match: 100 Duel Coins. Win reward: +190 Duel Coins; loss: -100 Duel Coins.
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
  * Clear WIN / DEFEAT banner, +190 or -100 Duel Coins, rating delta (+/- 15 pts).
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
