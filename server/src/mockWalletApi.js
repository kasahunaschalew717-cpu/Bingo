// Mock implementation of Ardi Game Zone Wallet API (game-wallet-api.md)
// Allows local standalone execution and testing of all financial flows.

class MockWalletService {
  constructor() {
    this.gameKey = process.env.ARDI_GAME_KEY || "agk_ardi_bingo_secret_test_key";
    this.gameInfo = {
      slug: "ardi-bingo",
      title: "Ethiopian Bingo",
      txName: "Bingo",
      enabled: true
    };

    // In-memory player accounts keyed by token
    this.players = new Map();
    // Recorded moves keyed by ref: { moveId, token, amount, type: 'debit'|'credit'|'refund', roundId, timestamp }
    this.moves = new Map();
    // Bets by player and roundId: key = `${token}:${roundId}` -> list of debitRefs
    this.roundBets = new Map();

    // Seed default test player
    this._ensurePlayer("ags_sample_player_1", "Kas***** A.", 12345678, 50000); // 500 ETB
    this._ensurePlayer("ags_sample_player_2", "Abe***** T.", 87654321, 35000); // 350 ETB
  }

  _ensurePlayer(token, name = null, chatId = null, initialBalance = 50000) {
    if (!this.players.has(token)) {
      const shortToken = token.replace(/^ags_/, '').slice(0, 6);
      this.players.set(token, {
        ref: `pref_${shortToken || 'user'}`,
        name: name || `Play*****_${shortToken}`,
        chatId: chatId || 999888,
        balance: initialBalance, // in santim (100 santim = 1 ETB)
        createdAt: Date.now()
      });
    }
    return this.players.get(token);
  }

  _validateRef(ref) {
    if (!ref || typeof ref !== 'string') return false;
    if (ref.length < 1 || ref.length > 64) return false;
    return /^[A-Za-z0-9_.:-]+$/.test(ref);
  }

  handleWhoami(authHeader) {
    if (!this._checkAuth(authHeader)) {
      return { status: 401, body: { ok: false, code: "UNAUTHORIZED", message: "Invalid or missing Bearer key" } };
    }
    return { status: 200, body: { ok: true, game: this.gameInfo } };
  }

  handleSession(authHeader, body) {
    if (!this._checkAuth(authHeader)) {
      return { status: 401, body: { ok: false, code: "UNAUTHORIZED", message: "Invalid or missing Bearer key" } };
    }
    const { token } = body || {};
    if (!token || typeof token !== 'string') {
      return { status: 400, body: { ok: false, code: "BAD_REQUEST", message: "token is required" } };
    }

    const player = this._ensurePlayer(token);
    return {
      status: 200,
      body: {
        ok: true,
        player: {
          ref: player.ref,
          chatId: player.chatId,
          name: player.name
        },
        balance: player.balance,
        currency: "ETB"
      }
    };
  }

  handleBalance(authHeader, body) {
    if (!this._checkAuth(authHeader)) {
      return { status: 401, body: { ok: false, code: "UNAUTHORIZED", message: "Invalid or missing Bearer key" } };
    }
    const { token } = body || {};
    if (!token || typeof token !== 'string') {
      return { status: 400, body: { ok: false, code: "BAD_REQUEST", message: "token is required" } };
    }

    const player = this._ensurePlayer(token);
    return { status: 200, body: { ok: true, balance: player.balance } };
  }

  handleDebit(authHeader, body) {
    if (!this._checkAuth(authHeader)) {
      return { status: 401, body: { ok: false, code: "UNAUTHORIZED", message: "Invalid Bearer key" } };
    }
    const { token, amount, ref, roundId } = body || {};
    if (!token || typeof amount !== 'number' || amount <= 0 || !this._validateRef(ref) || !roundId) {
      return { status: 400, body: { ok: false, code: "BAD_REQUEST", message: "Invalid debit payload" } };
    }

    // Check ref idempotency
    if (this.moves.has(ref)) {
      const existing = this.moves.get(ref);
      if (existing.token !== token || existing.amount !== amount || existing.roundId !== roundId || existing.type !== 'debit') {
        return { status: 409, body: { ok: false, code: "REF_CONFLICT", message: "ref reused for different move" } };
      }
      const player = this.players.get(token);
      return { status: 200, body: { ok: true, balance: player.balance, moveId: existing.moveId, replayed: true } };
    }

    const player = this._ensurePlayer(token);
    if (player.balance < amount) {
      return {
        status: 422,
        body: { ok: false, code: "INSUFFICIENT_FUNDS", message: "Balance does not cover bet", balance: player.balance }
      };
    }

    // Deduct
    player.balance -= amount;
    const moveId = `mov_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    this.moves.set(ref, { moveId, token, amount, type: 'debit', roundId, timestamp: Date.now() });

    // Track round bet
    const roundKey = `${token}:${roundId}`;
    if (!this.roundBets.has(roundKey)) {
      this.roundBets.set(roundKey, []);
    }
    this.roundBets.get(roundKey).push({ ref, amount, refunded: false });

    return { status: 200, body: { ok: true, balance: player.balance, moveId, replayed: false } };
  }

  handleCredit(authHeader, body) {
    if (!this._checkAuth(authHeader)) {
      return { status: 401, body: { ok: false, code: "UNAUTHORIZED", message: "Invalid Bearer key" } };
    }
    const { token, amount, ref, roundId } = body || {};
    if (!token || typeof amount !== 'number' || amount <= 0 || !this._validateRef(ref) || !roundId) {
      return { status: 400, body: { ok: false, code: "BAD_REQUEST", message: "Invalid credit payload" } };
    }

    // Check ref idempotency
    if (this.moves.has(ref)) {
      const existing = this.moves.get(ref);
      if (existing.token !== token || existing.amount !== amount || existing.roundId !== roundId || existing.type !== 'credit') {
        return { status: 409, body: { ok: false, code: "REF_CONFLICT", message: "ref reused for different move" } };
      }
      const player = this.players.get(token);
      return { status: 200, body: { ok: true, balance: player.balance, moveId: existing.moveId, replayed: true } };
    }

    // Validate that player has an active (non-refunded) bet in this round
    const roundKey = `${token}:${roundId}`;
    const bets = this.roundBets.get(roundKey) || [];
    const hasActiveBet = bets.some(b => !b.refunded);
    if (!hasActiveBet) {
      return { status: 409, body: { ok: false, code: "NO_BET_IN_ROUND", message: "No active bet found for player in this round" } };
    }

    const player = this._ensurePlayer(token);
    player.balance += amount;

    const moveId = `mov_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    this.moves.set(ref, { moveId, token, amount, type: 'credit', roundId, timestamp: Date.now() });

    return { status: 200, body: { ok: true, balance: player.balance, moveId, replayed: false } };
  }

  handleRefund(authHeader, body) {
    if (!this._checkAuth(authHeader)) {
      return { status: 401, body: { ok: false, code: "UNAUTHORIZED", message: "Invalid Bearer key" } };
    }
    const { token, ref, debitRef } = body || {};
    if (!token || !this._validateRef(ref) || !this._validateRef(debitRef)) {
      return { status: 400, body: { ok: false, code: "BAD_REQUEST", message: "Invalid refund payload" } };
    }

    // Check refund ref idempotency
    if (this.moves.has(ref)) {
      const existing = this.moves.get(ref);
      if (existing.debitRef !== debitRef || existing.token !== token) {
        return { status: 409, body: { ok: false, code: "REF_CONFLICT", message: "ref conflict on refund" } };
      }
      const player = this.players.get(token);
      return { status: 200, body: { ok: true, balance: player.balance, moveId: existing.moveId, replayed: true } };
    }

    const debitMove = this.moves.get(debitRef);
    if (!debitMove || debitMove.token !== token || debitMove.type !== 'debit') {
      return { status: 404, body: { ok: false, code: "BET_UNKNOWN", message: "Debit move not found" } };
    }

    // Check if already refunded
    const roundKey = `${token}:${debitMove.roundId}`;
    const bets = this.roundBets.get(roundKey) || [];
    const betRecord = bets.find(b => b.ref === debitRef);
    if (!betRecord || betRecord.refunded) {
      return { status: 409, body: { ok: false, code: "ALREADY_REFUNDED", message: "Bet already refunded" } };
    }

    betRecord.refunded = true;
    const player = this.players.get(token);
    player.balance += debitMove.amount;

    const moveId = `mov_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    this.moves.set(ref, { moveId, token, amount: debitMove.amount, type: 'refund', debitRef, timestamp: Date.now() });

    return { status: 200, body: { ok: true, balance: player.balance, moveId, replayed: false } };
  }

  _checkAuth(authHeader) {
    if (!authHeader) return false;
    const parts = authHeader.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer") return false;
    // Allow any key starting with agk_ in test mode or matching gameKey
    return parts[1].startsWith("agk_") || parts[1] === this.gameKey;
  }
}

export const mockWallet = new MockWalletService();
