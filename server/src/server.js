import express from 'express';
import cors from 'cors';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import dotenv from 'dotenv';
import { mockWallet } from './mockWalletApi.js';
import { walletClient } from './walletClient.js';
import { RoomManager } from './roomManager.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDistPath = path.resolve(__dirname, '../../client/dist');

const PORT = process.env.PORT || 3001;
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(clientDistPath));

// -------------------------------------------------------------
// 1. Ardi Game Wallet API Mock Routes (Matches game-wallet-api.md)
// -------------------------------------------------------------
app.post('/api/games/v1/whoami', (req, res) => {
  const result = mockWallet.handleWhoami(req.headers.authorization);
  res.status(result.status).json(result.body);
});

app.post('/api/games/v1/session', (req, res) => {
  const result = mockWallet.handleSession(req.headers.authorization, req.body);
  res.status(result.status).json(result.body);
});

app.post('/api/games/v1/balance', (req, res) => {
  const result = mockWallet.handleBalance(req.headers.authorization, req.body);
  res.status(result.status).json(result.body);
});

app.post('/api/games/v1/debit', (req, res) => {
  const result = mockWallet.handleDebit(req.headers.authorization, req.body);
  res.status(result.status).json(result.body);
});

app.post('/api/games/v1/credit', (req, res) => {
  const result = mockWallet.handleCredit(req.headers.authorization, req.body);
  res.status(result.status).json(result.body);
});

app.post('/api/games/v1/refund', (req, res) => {
  const result = mockWallet.handleRefund(req.headers.authorization, req.body);
  res.status(result.status).json(result.body);
});

// -------------------------------------------------------------
// 2. Game Client API Endpoints
// -------------------------------------------------------------

// Player session authentication from URL token ?token=ags_...
app.post('/api/auth/session', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ ok: false, message: 'Session token is required.' });
    }
    const sessionData = await walletClient.getSession(token);
    res.json(sessionData);
  } catch (err) {
    res.status(400).json({ ok: false, message: err.message });
  }
});

// Read player balance
app.post('/api/auth/balance', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ ok: false, message: 'Session token is required.' });
    }
    const balance = await walletClient.getBalance(token);
    res.json({ ok: true, balance });
  } catch (err) {
    res.status(400).json({ ok: false, message: err.message });
  }
});

// Quick-Match tiers listing
app.get('/api/rooms', (req, res) => {
  res.json({ ok: true, tiers: roomManager.getTiersSummary() });
});

// Top-up testing balance in mock mode
app.post('/api/mock/topup', (req, res) => {
  const { token, amountSantim = 10000 } = req.body;
  if (!token) return res.status(400).json({ ok: false, message: 'Token required' });
  const player = mockWallet.players.get(token);
  if (!player) return res.status(404).json({ ok: false, message: 'Player token not found' });
  player.balance += amountSantim;
  res.json({ ok: true, balance: player.balance, addedSantim: amountSantim });
});

// -------------------------------------------------------------
// 3. HTTP and WebSocket Server Setup
// -------------------------------------------------------------
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

// Sockets map: socketId -> { ws, roomTierId }
const activeSockets = new Map();

function broadcastToTier(tierId, payload) {
  const messageStr = JSON.stringify(payload);
  for (const [id, conn] of activeSockets.entries()) {
    if (conn.roomTierId === tierId && conn.ws.readyState === WebSocket.OPEN) {
      conn.ws.send(messageStr);
    }
  }
}

const roomManager = new RoomManager(broadcastToTier);

let socketIdCounter = 1;

wss.on('connection', (ws) => {
  const socketId = `sock_${socketIdCounter++}_${Date.now().toString(36)}`;
  activeSockets.set(socketId, { ws, roomTierId: null, token: null });

  ws.id = socketId;

  ws.on('message', async (messageRaw) => {
    try {
      const data = JSON.parse(messageRaw.toString());
      const conn = activeSockets.get(socketId);

      switch (data.type) {
        case 'JOIN_ROOM': {
          const { tierId, token } = data;
          const room = roomManager.getRoom(tierId);
          if (!room) {
            return ws.send(JSON.stringify({ type: 'ERROR', message: 'Room tier not found' }));
          }

          // Validate session with wallet
          try {
            const session = await walletClient.getSession(token);
            conn.roomTierId = tierId;
            conn.token = token;

            const player = room.addPlayer(ws, { token, ...session });

            // Send initial confirmation to joining player
            ws.send(JSON.stringify({
              type: 'ROOM_JOINED',
              tierId,
              card: player.card,
              state: room.getPublicState()
            }));
          } catch (err) {
            ws.send(JSON.stringify({ type: 'ERROR', message: `Auth error: ${err.message}` }));
          }
          break;
        }

        case 'REGENERATE_CARD': {
          if (conn.roomTierId) {
            const room = roomManager.getRoom(conn.roomTierId);
            if (room) {
              room.regenerateCard(socketId);
            }
          }
          break;
        }

        case 'CLAIM_BINGO': {
          if (conn.roomTierId) {
            const room = roomManager.getRoom(conn.roomTierId);
            if (room) {
              const claimResult = await room.claimBingo(socketId, data.claimType);
              ws.send(JSON.stringify({
                type: 'CLAIM_RESULT',
                ...claimResult
              }));
            }
          }
          break;
        }

        case 'LEAVE_ROOM': {
          if (conn.roomTierId) {
            const room = roomManager.getRoom(conn.roomTierId);
            if (room) {
              room.removePlayer(socketId);
            }
            conn.roomTierId = null;
            ws.send(JSON.stringify({ type: 'ROOM_LEFT' }));
          }
          break;
        }

        case 'PING': {
          ws.send(JSON.stringify({ type: 'PONG' }));
          break;
        }

        default:
          break;
      }
    } catch (err) {
      console.error('WebSocket message handling error:', err);
    }
  });

  ws.on('close', () => {
    const conn = activeSockets.get(socketId);
    if (conn && conn.roomTierId) {
      const room = roomManager.getRoom(conn.roomTierId);
      if (room) {
        room.removePlayer(socketId);
      }
    }
    activeSockets.delete(socketId);
  });
});

// Fallback to client SPA index.html
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/ws')) {
    return next();
  }
  res.sendFile(path.join(clientDistPath, 'index.html'), (err) => {
    if (err) next();
  });
});

server.listen(PORT, () => {
  console.log(`🎱 Ardi Bingo Server running on http://localhost:${PORT}`);
  console.log(`🔒 Game Wallet API Mock available at http://localhost:${PORT}/api/games/v1`);
  console.log(`🔌 WebSocket Server active at ws://localhost:${PORT}/ws`);
});
