import express from 'express';
import cors from 'cors';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { config } from './config.js';
import { gameDb } from './db.js';
import { mockWallet } from './mockWalletApi.js';
import { walletClient, WalletApiError } from './walletClient.js';
import { RoomManager } from './roomManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDistPath = path.resolve(__dirname, '../../client/dist');

const app = express();
app.disable('x-powered-by');
app.use(cors({ origin: config.allowedOrigin === '*' ? true : config.allowedOrigin }));
app.use(express.json({ limit: '16kb' }));

// Security headers (allow framing by Ardi Mini App)
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

app.use(express.static(clientDistPath, { maxAge: '1h' }));

let deskGameInfo = {
  slug: 'ardi-bingo',
  title: 'Ethiopian Bingo',
  txName: 'Bingo',
  enabled: true
};

// -------------------------------------------------------------
// 1. Optional Local Sandbox Mock Routes (Disabled in Live Prod)
// -------------------------------------------------------------
if (config.useMockWallet) {
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

  app.post('/api/mock/topup', (req, res) => {
    const { token, amountSantim = 10000 } = req.body || {};
    if (!token) return res.status(400).json({ ok: false, message: 'Token required' });
    const player = mockWallet.players.get(token);
    if (!player) return res.status(404).json({ ok: false, message: 'Player token not found' });
    if (!Number.isInteger(amountSantim) || amountSantim <= 0 || amountSantim > 500000) {
      return res.status(400).json({ ok: false, message: 'Invalid topup amount' });
    }
    player.balance += amountSantim;
    res.json({ ok: true, balance: player.balance, addedSantim: amountSantim });
  });
}

// -------------------------------------------------------------
// 2. Production Game Client API Endpoints
// -------------------------------------------------------------
app.get('/health', (req, res) => {
  res.json({
    ok: true,
    mode: config.useMockWallet ? 'sandbox' : 'production',
    game: deskGameInfo,
    uptimeSec: Math.floor(process.uptime()),
    tiers: roomManager.getTiersSummary()
  });
});

app.post('/api/auth/session', async (req, res) => {
  try {
    const { token } = req.body || {};
    if (!token || typeof token !== 'string') {
      return res.status(400).json({
        ok: false,
        code: 'MISSING_TOKEN',
        message: 'Session token is required. Open this game from Ardi Game Zone.'
      });
    }
    const sessionData = await walletClient.getSession(token);
    res.json({
      ...sessionData,
      mode: config.useMockWallet ? 'sandbox' : 'production',
      game: deskGameInfo
    });
  } catch (err) {
    const status = err instanceof WalletApiError ? err.status : 500;
    res.status(status).json({
      ok: false,
      code: err.code || 'SESSION_FAILED',
      message: err.message
    });
  }
});

app.post('/api/auth/balance', async (req, res) => {
  try {
    const { token } = req.body || {};
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ ok: false, code: 'MISSING_TOKEN', message: 'Session token is required.' });
    }
    const balance = await walletClient.getBalance(token);
    res.json({ ok: true, balance });
  } catch (err) {
    const status = err instanceof WalletApiError ? err.status : 500;
    res.status(status).json({ ok: false, code: err.code || 'BALANCE_FAILED', message: err.message });
  }
});

app.post('/api/history', async (req, res) => {
  try {
    const { token } = req.body || {};
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ ok: false, code: 'MISSING_TOKEN', message: 'Session token is required.' });
    }
    const sessionData = await walletClient.getSession(token);
    const transactions = gameDb.getPlayerTransactions(sessionData.player.ref, 30);
    const recentRounds = gameDb.getRecentRounds(10);
    res.json({
      ok: true,
      transactions,
      recentRounds
    });
  } catch (err) {
    const status = err instanceof WalletApiError ? err.status : 500;
    res.status(status).json({ ok: false, code: err.code || 'HISTORY_FAILED', message: err.message });
  }
});

app.get('/api/rooms', (req, res) => {
  res.json({ ok: true, tiers: roomManager.getTiersSummary() });
});

// -------------------------------------------------------------
// 3. HTTP and WebSocket Server Setup
// -------------------------------------------------------------
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 16 * 1024 });

const activeSockets = new Map();

function broadcastToTier(tierId, payload) {
  const messageStr = JSON.stringify(payload);
  for (const conn of activeSockets.values()) {
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
  ws.isAlive = true;

  ws.on('pong', () => {
    ws.isAlive = true;
  });

  ws.on('message', async (messageRaw) => {
    try {
      const data = JSON.parse(messageRaw.toString());
      const conn = activeSockets.get(socketId);
      if (!conn) return;

      switch (data.type) {
        case 'JOIN_ROOM': {
          const { tierId, token } = data;
          const room = roomManager.getRoom(tierId);
          if (!room) {
            return ws.send(JSON.stringify({ type: 'ERROR', message: 'Room tier not found' }));
          }
          if (!token || typeof token !== 'string') {
            return ws.send(JSON.stringify({ type: 'ERROR', message: 'Missing session token' }));
          }

          try {
            const session = await walletClient.getSession(token);
            if (conn.roomTierId && conn.roomTierId !== tierId) {
              const prevRoom = roomManager.getRoom(conn.roomTierId);
              if (prevRoom) prevRoom.removePlayerBySocket(socketId);
            }

            conn.roomTierId = tierId;
            conn.token = token;

            const player = room.addOrReconnectPlayer(ws, { token, ...session });

            ws.send(JSON.stringify({
              type: 'ROOM_JOINED',
              tierId,
              ticketNumber: player.ticketNumber,
              card: player.card,
              spectating: player.spectating,
              debited: player.debited,
              balance: player.balance,
              state: room.getPublicState()
            }));
          } catch (err) {
            ws.send(JSON.stringify({
              type: 'ERROR',
              code: err.code || 'AUTH_ERROR',
              message: err.message
            }));
          }
          break;
        }

        case 'PREVIEW_TICKET': {
          if (conn.roomTierId) {
            const room = roomManager.getRoom(conn.roomTierId);
            if (room) room.previewTicket(socketId, data.ticketNumber);
          }
          break;
        }

        case 'SELECT_TICKET': {
          if (conn.roomTierId) {
            const room = roomManager.getRoom(conn.roomTierId);
            if (room) {
              const res = room.selectTicket(socketId, data.ticketNumber);
              if (!res.ok) {
                ws.send(JSON.stringify({
                  type: 'TICKET_SELECT_ERROR',
                  message: res.message
                }));
              }
            }
          }
          break;
        }

        case 'REGENERATE_CARD': {
          if (conn.roomTierId) {
            const room = roomManager.getRoom(conn.roomTierId);
            if (room) room.regenerateCard(socketId);
          }
          break;
        }

        case 'CLAIM_BINGO': {
          if (conn.roomTierId) {
            const room = roomManager.getRoom(conn.roomTierId);
            if (room) {
              const claimResult = await room.claimBingo(socketId);
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
            if (room) room.removePlayerBySocket(socketId);
            conn.roomTierId = null;
            ws.send(JSON.stringify({ type: 'ROOM_LEFT' }));
          }
          break;
        }

        case 'PING': {
          ws.isAlive = true;
          ws.send(JSON.stringify({ type: 'PONG' }));
          break;
        }

        default:
          break;
      }
    } catch (err) {
      console.error('WebSocket message error:', err.message);
    }
  });

  ws.on('close', () => {
    const conn = activeSockets.get(socketId);
    if (conn && conn.roomTierId) {
      const room = roomManager.getRoom(conn.roomTierId);
      if (room) room.removePlayerBySocket(socketId);
    }
    activeSockets.delete(socketId);
  });
});

// WebSocket Heartbeat to prune dead mobile connections
const heartbeatInterval = setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.isAlive === false) {
      ws.terminate();
      continue;
    }
    ws.isAlive = false;
    ws.ping();
  }
}, 25000);

wss.on('close', () => {
  clearInterval(heartbeatInterval);
});

// Fallback to client SPA index.html
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/ws') || req.path === '/health') {
    return next();
  }
  res.sendFile(path.join(clientDistPath, 'index.html'), (err) => {
    if (err) next();
  });
});

async function bootstrap() {
  try {
    if (!config.useMockWallet) {
      const whoamiRes = await walletClient.whoami();
      if (whoamiRes && whoamiRes.game) {
        deskGameInfo = whoamiRes.game;
      }
      console.log(`✅ Connected to Ardi Desk API (${config.apiUrl}) as "${deskGameInfo.title}" [enabled=${deskGameInfo.enabled}]`);
    } else {
      console.warn('⚠️  Running in LOCAL SANDBOX mode (USE_MOCK_WALLET=true). Do NOT use mock mode in production!');
    }

    const recovered = await roomManager.recoverUnsettledDebits();
    if (recovered > 0) {
      console.log(`↩️  Recovered and refunded ${recovered} unsettled bet(s) from previous session.`);
    }
  } catch (err) {
    console.error('❌ Startup check warning:', err.message);
  }

  server.listen(config.port, () => {
    console.log(`🎱 Ardi Bingo Server listening on http://localhost:${config.port} (${config.nodeEnv})`);
    console.log(`🔌 WebSocket Server active at ws://localhost:${config.port}/ws`);
  });
}

// Graceful shutdown: refund active rounds cleanly
let shuttingDown = false;
async function gracefulShutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n🛑 Received ${signal}. Gracefully shutting down & refunding active rounds...`);
  try {
    await roomManager.shutdownAllRooms();
    clearInterval(heartbeatInterval);
    wss.close();
    server.close();
    gameDb.close();
    console.log('✅ Shutdown complete.');
    process.exit(0);
  } catch (err) {
    console.error('Shutdown error:', err);
    process.exit(1);
  }
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

bootstrap();
