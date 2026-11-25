import fs from 'fs';
import path from 'path';
import { DatabaseSync } from 'node:sqlite';
import { config } from './config.js';

class GameDatabase {
  constructor(dbPath) {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new DatabaseSync(dbPath);
    this.db.exec('PRAGMA journal_mode = WAL;');
    this.db.exec('PRAGMA foreign_keys = ON;');
    this._initSchema();
  }

  _initSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS rounds (
        round_id TEXT PRIMARY KEY,
        tier_id TEXT NOT NULL,
        stake_santim INTEGER NOT NULL,
        status TEXT NOT NULL,
        total_bet_santim INTEGER DEFAULT 0,
        net_pot_santim INTEGER DEFAULT 0,
        rake_santim INTEGER DEFAULT 0,
        drawn_balls TEXT DEFAULT '[]',
        winner_ref TEXT,
        winner_name TEXT,
        winner_pattern TEXT,
        created_at INTEGER NOT NULL,
        finished_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS transactions (
        ref TEXT PRIMARY KEY,
        round_id TEXT NOT NULL,
        player_ref TEXT NOT NULL,
        player_name TEXT,
        token TEXT NOT NULL,
        type TEXT NOT NULL,
        amount_santim INTEGER NOT NULL,
        debit_ref TEXT,
        move_id TEXT,
        status TEXT NOT NULL,
        error_code TEXT,
        error_message TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_tx_player_ref ON transactions(player_ref, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_tx_round_id ON transactions(round_id);
      CREATE INDEX IF NOT EXISTS idx_rounds_status ON rounds(status);
    `);
  }

  createRound({ roundId, tierId, stakeSantim }) {
    const stmt = this.db.prepare(`
      INSERT INTO rounds (round_id, tier_id, stake_santim, status, created_at)
      VALUES (?, ?, ?, 'LOCKING', ?)
    `);
    stmt.run(roundId, tierId, stakeSantim, Date.now());
  }

  updateRoundStart({ roundId, totalBetSantim, netPotSantim, rakeSantim }) {
    const stmt = this.db.prepare(`
      UPDATE rounds
      SET status = 'PLAYING',
          total_bet_santim = ?,
          net_pot_santim = ?,
          rake_santim = ?
      WHERE round_id = ?
    `);
    stmt.run(totalBetSantim, netPotSantim, rakeSantim, roundId);
  }

  updateRoundBalls(roundId, drawnBalls) {
    const stmt = this.db.prepare(`
      UPDATE rounds SET drawn_balls = ? WHERE round_id = ?
    `);
    stmt.run(JSON.stringify(drawnBalls), roundId);
  }

  finishRound({ roundId, status, winnerRef = null, winnerName = null, winnerPattern = null, drawnBalls = [] }) {
    const stmt = this.db.prepare(`
      UPDATE rounds
      SET status = ?,
          winner_ref = ?,
          winner_name = ?,
          winner_pattern = ?,
          drawn_balls = ?,
          finished_at = ?
      WHERE round_id = ?
    `);
    stmt.run(status, winnerRef, winnerName, winnerPattern, JSON.stringify(drawnBalls), Date.now(), roundId);
  }

  recordTransactionPending({ ref, roundId, playerRef, playerName, token, type, amountSantim, debitRef = null }) {
    const now = Date.now();
    const stmt = this.db.prepare(`
      INSERT INTO transactions (
        ref, round_id, player_ref, player_name, token, type,
        amount_santim, debit_ref, status, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?)
      ON CONFLICT(ref) DO UPDATE SET updated_at = excluded.updated_at
    `);
    stmt.run(ref, roundId, playerRef, playerName, token, type, amountSantim, debitRef, now, now);
  }

  markTransactionSuccess({ ref, moveId, replayed = false }) {
    const stmt = this.db.prepare(`
      UPDATE transactions
      SET status = ?, move_id = ?, updated_at = ?
      WHERE ref = ?
    `);
    stmt.run(replayed ? 'REPLAYED' : 'SUCCESS', moveId || null, Date.now(), ref);
  }

  markTransactionFailed({ ref, errorCode, errorMessage }) {
    const stmt = this.db.prepare(`
      UPDATE transactions
      SET status = 'FAILED', error_code = ?, error_message = ?, updated_at = ?
      WHERE ref = ?
    `);
    stmt.run(errorCode || 'UNKNOWN', errorMessage || 'Transaction failed', Date.now(), ref);
  }

  /**
   * Returns any successful debit transactions from rounds that never finished or aborted cleanly
   * (e.g. if the server crashed/restarted mid-round).
   */
  getUnsettledDebits() {
    const stmt = this.db.prepare(`
      SELECT t.*
      FROM transactions t
      JOIN rounds r ON t.round_id = r.round_id
      WHERE r.status IN ('LOCKING', 'PLAYING')
        AND t.type = 'debit'
        AND t.status IN ('SUCCESS', 'REPLAYED')
        AND NOT EXISTS (
          SELECT 1 FROM transactions rf
          WHERE rf.debit_ref = t.ref
            AND rf.type = 'refund'
            AND rf.status IN ('SUCCESS', 'REPLAYED')
        )
    `);
    return stmt.all();
  }

  getPlayerTransactions(playerRef, limit = 25) {
    const stmt = this.db.prepare(`
      SELECT ref, round_id, type, amount_santim, move_id, status, error_code, created_at
      FROM transactions
      WHERE player_ref = ?
      ORDER BY created_at DESC
      LIMIT ?
    `);
    return stmt.all(playerRef, limit);
  }

  getRecentRounds(limit = 15) {
    const stmt = this.db.prepare(`
      SELECT round_id, tier_id, stake_santim, status, total_bet_santim, net_pot_santim,
             winner_name, winner_pattern, created_at, finished_at
      FROM rounds
      ORDER BY created_at DESC
      LIMIT ?
    `);
    return stmt.all(limit);
  }

  close() {
    this.db.close();
  }
}

export const gameDb = new GameDatabase(config.dbPath);
