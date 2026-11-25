# 🎱 Ethiopian Parlor Bingo — Ardi Game Zone

Production-ready, real-time multiplayer **75-Ball Ethiopian Parlor Bingo** integrated with the **Ardi Game Wallet API** (`game-wallet-api.md`) and styled after the **Ardi Game Zone** UI (`/Sample`).

---

## ✨ Production Architecture

- **Zero Bots / Real-Money Integrity**: Rounds require real authenticated players (`MIN_PLAYERS_TO_START`, default `2`). Prize pots equal strictly collected real bets minus configurable parlor rake (`RAKE_PERCENT`, default `10%`), guaranteeing compliance with Ardi's daily payout limit.
- **Persistent SQLite Audit Ledger (`node:sqlite`)**: Every round, debit, credit, and refund is persisted in SQLite (`server/data/bingo.db`). On startup or graceful shutdown (`SIGINT`/`SIGTERM`), any unsettled debits from interrupted rounds are automatically refunded via `/refund`.
- **Resilient Ardi Wallet Client**:
  - Reads `ARDI_API_URL` and `ARDI_GAME_KEY` from environment variables (never exposed to the browser).
  - Verifies desk configuration at boot via `/api/games/v1/whoami`.
  - Retries `5xx` / `SERVER_ERROR` / network timeouts automatically with the exact same `ref` for idempotency.
  - Handles all Ardi refusal codes (`INSUFFICIENT_FUNDS`, `SESSION_EXPIRED`, `GAME_OFF`, `PARLOR_PAUSED`, `BET_LIMIT`, `PAYOUT_LIMIT`, `PLAYER_CLOSED`).
- **CSPRNG Ball & Ticket Generation**: Uses Node's `crypto.randomInt` for ticket generation and 75-ball shuffling.
- **Reconnect & Spectator Support**: Mobile Telegram WebView disconnects reconnect seamlessly to their active ticket and drawn balls; mid-round joiners enter as spectators queued for the next round.
- **Win Condition — Any Line Only**: First player to complete any horizontal row, vertical column, or diagonal wins **100% of the net prize pot**.
- **5 Quick-Match Parlors**: `5 ETB`, `10 ETB`, `25 ETB`, `50 ETB`, and `100 ETB`.

---

## 🚀 Production Deployment

### 1. Configure Environment
Copy `.env.example` to `.env` and fill in your live Ardi Desk credentials:

```env
PORT=3001
NODE_ENV=production
ARDI_API_URL=https://your-ardi-backend.example
ARDI_GAME_KEY=agk_your_real_game_key_from_desk
USE_MOCK_WALLET=false
RAKE_PERCENT=0.10
MIN_PLAYERS_TO_START=2
COUNTDOWN_SECONDS=15
BALL_INTERVAL_MS=3000
DB_PATH=./server/data/bingo.db
```

### 2. Build Frontend & Start Server
```bash
npm run build
npm start
```

- Health check endpoint: `GET /health`
- Ardi Desk URL pattern: `https://your-bingo-domain.example/?token={token}&chat_id={chatId}`

---

## 🛠️ Local Sandbox Testing (Development Only)

When running locally without `ARDI_API_URL` (`NODE_ENV=development` or `USE_MOCK_WALLET=true`), the server activates a local mock wallet so you can test multiplayer across two browser tabs:
- Tab 1: `http://localhost:3001?token=ags_sample_player_1`
- Tab 2: `http://localhost:3001?token=ags_sample_player_2`

Mock routes are automatically disabled in production (`NODE_ENV=production`, `USE_MOCK_WALLET=false`).

---

## 🧪 Automated Test Suite

Run the full production verification suite (Bingo engine, CSPRNG, Wallet API protocol, SQLite crash-recovery refunds, and real 2-player round accounting):

```bash
node server/test/testBingo.js
```
