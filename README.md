# 🎱 Ethiopian Parlor Bingo Game for Ardi Game Zone

A real-time, multiplayer 75-Ball Ethiopian Parlor Bingo game designed for **Ardi Game Zone** (Telegram Mini App), fully integrated with the **Ardi Game Wallet API** (`game-wallet-api.md`) and styled with 100% visual fidelity to the **Ardi Game Zone sample UI**.

---

## ✨ Features

- **Ardi Game Zone Design System**:
  - Deep midnight navy palette (`#070E1B`, `#0E1A32`, `#1B2D50`) with warm gold/amber accents (`#FFA800`), electric cyan highlights (`#00A3FF`), and emerald cash green (`#00C070`).
  - Top header with Ardi logo, live ETB wallet pill, and `+ Cash` action button.
  - "Invite & Extra Bonus" promo banner matching the Telegram Mini App look.
  - Game cards styled after Ardi's parlor cards with live player counts and pots.
  - Room code input (`ENTER ROOM CODE (E.G. 7K2M9X)`) with gold Join button.
  - Floating bottom navigation with glowing center gamepad button.

- **5 Quick-Match Parlor Stakes**:
  - **Bronze Parlor**: 5 ETB (500 santim)
  - **Silver Parlor**: 10 ETB (1,000 santim)
  - **Gold Parlor**: 25 ETB (2,500 santim)
  - **Platinum Parlor**: 50 ETB (5,000 santim)
  - **Diamond Parlor**: 100 ETB (10,000 santim)

- **Win Condition: Any Line ONLY**:
  - Any 5 Horizontal Rows
  - Any 5 Vertical Columns
  - Any 2 Diagonals (Top-Left to Bottom-Right, Top-Right to Bottom-Left)
  - **Prize Payout**: The first player to complete Any Line wins **100% of the net prize pot**! The round concludes immediately upon a validated line claim.

- **Interactive Gameplay**:
  - Standard 5×5 75-Ball Bingo ticket (B: 1–15, I: 16–30, N: 31–45 + FREE center, G: 46–60, O: 61–75).
  - Ticket regeneration ("🎲 Change Ticket") during countdown.
  - Live animated 3D ball caller with recent drawn balls strip.
  - Optional **Auto-Daub** toggle for effortless mobile play + manual tactile daubing.
  - Giant pulsating gold **BINGO!** button when Any Line is ready.
  - Zero-asset Web Audio procedural sound effects (chimes, clicks, brass fanfare).
  - Full-screen confetti celebrations on victory!

- **Ardi Game Wallet API (`game-wallet-api.md`) Compliance**:
  - Server-side custody of secret `ARDI_GAME_KEY` (`agk_...`). Never exposed to the frontend.
  - Whole-santim accounting ($100\text{ santim} = 1\text{ ETB}$).
  - Full support for `session`, `balance`, `debit`, `credit`, and `refund`.
  - Idempotent request handling with unique `ref` strings.
  - Automated refund if a round aborts before kickoff.
  - Iframe parent communication via `postMessage`:
    - `window.parent.postMessage({ type: "ardi:balance" }, "*")`
    - `window.parent.postMessage({ type: "ardi:close" }, "*")`
  - Built-in **Mock Wallet Server** for instant local development without external dependencies.

---

## 🚀 Quick Start

### 1. Prerequisites
- Node.js 18+ (tested on Node.js v24)
- npm 10+

### 2. Start the Production Server
The production server serves both the backend API/WebSockets and the compiled frontend single-page application on port 3001:

```bash
npm start
```

Open your browser to:
```
http://localhost:3001
```

To test as a specific player with a token from the Ardi Telegram bot:
```
http://localhost:3001?token=ags_sample_player_1&chat_id=12345678
```

---

## 🛠️ Development Mode

To run frontend and backend with hot-module reloading:

```bash
# Terminal 1: Backend server
npm run dev:server

# Terminal 2: Vite frontend
npm run dev:client
```
The Vite dev server runs on `http://localhost:5173` and automatically proxies `/api` and `/ws` to `http://localhost:3001`.

---

## 🧪 Running Automated Tests

Run the automated verification suite:

```bash
node server/test/testBingo.js
```

---

## ⚙️ Configuration & Production Deployment

To connect the game with the live Ardi Game Zone desk backend:

1. Create a `.env` file in `server/.env` (or configure server environment variables):
```env
PORT=3001
ARDI_API_URL=https://your-desk-backend.example
ARDI_GAME_KEY=agk_your_assigned_secret_key_from_desk
USE_MOCK_WALLET=false
```

2. Build the frontend:
```bash
npm run build
```

3. Launch the server behind your reverse proxy:
```bash
npm start
```
