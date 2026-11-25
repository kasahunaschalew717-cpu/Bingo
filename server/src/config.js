import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const nodeEnv = process.env.NODE_ENV || 'development';
const apiUrl = (process.env.ARDI_API_URL || '').replace(/\/+$/, '');
const gameKey = process.env.ARDI_GAME_KEY || '';

// In production, live ARDI_API_URL and ARDI_GAME_KEY are required unless explicitly overridden
const explicitMock = process.env.USE_MOCK_WALLET === 'true';
const useMockWallet = explicitMock || (!apiUrl && nodeEnv !== 'production');

if (nodeEnv === 'production' && !useMockWallet && (!apiUrl || !gameKey)) {
  throw new Error(
    'FATAL: ARDI_API_URL and ARDI_GAME_KEY must be set in production mode.'
  );
}

const parsedRake = Number.parseFloat(process.env.RAKE_PERCENT ?? '0.10');
const rakePercent = Number.isFinite(parsedRake) && parsedRake >= 0 && parsedRake <= 0.3
  ? parsedRake
  : 0.10;

const parsedMinPlayers = Number.parseInt(process.env.MIN_PLAYERS_TO_START ?? '2', 10);
const minPlayersToStart = Number.isFinite(parsedMinPlayers) && parsedMinPlayers >= 1
  ? parsedMinPlayers
  : 2;

export const config = {
  port: Number.parseInt(process.env.PORT || '3001', 10),
  nodeEnv,
  isProduction: nodeEnv === 'production',
  apiUrl,
  gameKey: gameKey || (useMockWallet ? 'agk_local_sandbox_dev_key' : ''),
  useMockWallet,
  rakePercent,
  minPlayersToStart,
  countdownSeconds: Number.parseInt(process.env.COUNTDOWN_SECONDS || '15', 10),
  ballIntervalMs: Number.parseInt(process.env.BALL_INTERVAL_MS || '3000', 10),
  intermissionMs: Number.parseInt(process.env.INTERMISSION_MS || '8000', 10),
  dbPath: process.env.DB_PATH || path.resolve(__dirname, '../data/bingo.db'),
  allowedOrigin: process.env.ALLOWED_ORIGIN || '*'
};
