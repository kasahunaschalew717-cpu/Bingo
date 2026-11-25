// Production Room Manager for Ardi Ethiopian Parlor Quick-Match Bingo
// Real-money multiplayer only (zero bots), persistent SQLite audit ledger,
// automatic crash/abort refunds, and Win Condition: Any Line ONLY.
import { randomBytes } from 'crypto';
import { generateBingoCard, checkBingoWin, createBallDeck } from './bingoEngine.js';
import { walletClient } from './walletClient.js';
import { gameDb } from './db.js';
import { config } from './config.js';

export const QUICK_MATCH_TIERS = [
  { id: 'tier_5', name: 'Bronze Parlor', stakeETB: 5, stakeSantim: 500 },
  { id: 'tier_10', name: 'Silver Parlor', stakeETB: 10, stakeSantim: 1000 },
  { id: 'tier_25', name: 'Gold Parlor', stakeETB: 25, stakeSantim: 2500 },
  { id: 'tier_50', name: 'Platinum Parlor', stakeETB: 50, stakeSantim: 5000 },
  { id: 'tier_100', name: 'Diamond Parlor', stakeETB: 100, stakeSantim: 10000 }
];

function sanitizeRefPart(str) {
  return String(str || '').replace(/[^A-Za-z0-9_.:-]/g, '_');
}

function buildRef(prefix, roundId, playerRef) {
  const cleanPrefix = sanitizeRefPart(prefix);
  const cleanRound = sanitizeRefPart(roundId);
  const cleanPlayer = sanitizeRefPart(playerRef);
  const raw = `${cleanPrefix}_${cleanRound}_${cleanPlayer}`;
  return raw.slice(0, 64);
}

function formatArdiErrorMessage(err) {
  switch (err.code) {
    case 'INSUFFICIENT_FUNDS':
      return 'Insufficient ETB balance for this parlor stake.';
    case 'SESSION_EXPIRED':
      return 'Your 12-hour game session expired. Please reopen from Ardi app.';
    case 'SESSION_UNKNOWN':
      return 'Invalid game session. Please reopen from Ardi app.';
    case 'GAME_OFF':
      return 'This game is currently switched off by the Ardi desk.';
    case 'PARLOR_PAUSED':
      return 'The parlor is temporarily paused.';
    case 'PLAYER_CLOSED':
      return 'Your player account is closed.';
    case 'BET_LIMIT':
      return 'This stake is outside the allowed bet limits configured by the desk.';
    case 'PAYOUT_LIMIT':
      return 'Daily payout limit reached. The Ardi desk has been alerted.';
    default:
      return err.message || 'Wallet transaction refused.';
  }
}

class BingoRoom {
  constructor(tier, broadcastFn) {
    this.tier = tier;
    this.broadcast = broadcastFn;
    this.status = 'WAITING'; // WAITING | COUNTDOWN | LOCKING | PLAYING | FINISHED
    this.roundId = null;
    this.countdown = config.countdownSeconds;
    this.countdownTimer = null;
    this.drawTimer = null;
    this.intermissionTimer = null;
    this.claimingLock = false;

    // Players keyed by playerRef (supports seamless mobile reconnects!)
    // value: { socketId, socket, token, playerRef, name, card, spectating, debited, debitRef, balance }
    this.players = new Map();

    // Drawn numbers
    this.deck = [];
    this.drawnBalls = [];
    this.drawnSet = new Set();

    // Round outcome
    this.winner = null;
    this.totalPot = 0; // net pot in santim
    this.rakePercent = config.rakePercent;
  }

  _getSeatedPlayers() {
    return Array.from(this.players.values()).filter((p) => !p.spectating);
  }

  getPublicState() {
    const seated = this._getSeatedPlayers();
    const activeCount = this.status === 'PLAYING' || this.status === 'FINISHED'
      ? Array.from(this.players.values()).filter((p) => p.debited).length
      : seated.length;

    const estimatedPot = this.totalPot > 0
      ? this.totalPot
      : Math.floor(seated.length * this.tier.stakeSantim * (1 - this.rakePercent));

    return {
      tierId: this.tier.id,
      name: this.tier.name,
      stakeETB: this.tier.stakeETB,
      stakeSantim: this.tier.stakeSantim,
      winCondition: 'Any Line',
      minPlayers: config.minPlayersToStart,
      status: this.status,
      roundId: this.roundId,
      countdown: this.countdown,
      playerCount: activeCount,
      totalConnected: this.players.size,
      players: Array.from(this.players.values()).map((p) => ({
        playerRef: p.playerRef,
        name: p.name,
        spectating: p.spectating,
        debited: p.debited
      })),
      currentBall: this.drawnBalls.length > 0 ? this.drawnBalls[this.drawnBalls.length - 1] : null,
      recentBalls: this.drawnBalls.slice(-6).reverse(),
      drawnBalls: this.drawnBalls,
      drawnCount: this.drawnBalls.length,
      totalPot: estimatedPot,
      winner: this.winner
    };
  }

  addOrReconnectPlayer(socket, session) {
    const playerRef = session.player.ref;
    const existing = this.players.get(playerRef);

    // Reconnecting player (e.g. mobile Telegram WebView woke back up)
    if (existing) {
      existing.socketId = socket.id;
      existing.socket = socket;
      existing.token = session.token;
      existing.name = session.player.name;
      existing.balance = session.balance;
      this._notifyState();
      return existing;
    }

    const roundInFlight = this.status === 'LOCKING' || this.status === 'PLAYING' || this.status === 'FINISHED';
    const player = {
      socketId: socket.id,
      socket,
      token: session.token,
      playerRef,
      name: session.player.name,
      card: generateBingoCard(),
      spectating: roundInFlight,
      debited: false,
      debitRef: null,
      balance: session.balance
    };

    this.players.set(playerRef, player);

    // Start countdown once enough seated players join
    if (this.status === 'WAITING' && this._getSeatedPlayers().length >= config.minPlayersToStart) {
      this._startCountdown();
    }

    this._notifyState();
    return player;
  }

  removePlayerBySocket(socketId) {
    for (const [playerRef, p] of this.players.entries()) {
      if (p.socketId !== socketId) continue;

      // If debited in an active round, keep player state so they can reconnect or still claim/receive updates
      if ((this.status === 'PLAYING' || this.status === 'LOCKING') && p.debited) {
        p.socket = null;
        p.socketId = null;
      } else {
        this.players.delete(playerRef);
        // Stop countdown if seated count drops below minimum before lock
        if (this.status === 'COUNTDOWN' && this._getSeatedPlayers().length < config.minPlayersToStart) {
          this._cancelCountdownToWaiting();
        }
      }

      this._notifyState();
      return;
    }
  }

  regenerateCard(socketId) {
    const player = this._findBySocket(socketId);
    if (player && !player.spectating && (this.status === 'WAITING' || this.status === 'COUNTDOWN')) {
      player.card = generateBingoCard();
      if (player.socket && player.socket.readyState === 1) {
        player.socket.send(JSON.stringify({
          type: 'CARD_UPDATED',
          card: player.card
        }));
      }
    }
  }

  _findBySocket(socketId) {
    for (const p of this.players.values()) {
      if (p.socketId === socketId) return p;
    }
    return null;
  }

  _cancelCountdownToWaiting() {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
    this.status = 'WAITING';
    this.countdown = config.countdownSeconds;
    this._notifyState();
  }

  _startCountdown() {
    this.status = 'COUNTDOWN';
    this.countdown = config.countdownSeconds;
    if (this.countdownTimer) clearInterval(this.countdownTimer);

    this.countdownTimer = setInterval(async () => {
      this.countdown--;
      this._notifyState();

      if (this.countdown <= 0) {
        clearInterval(this.countdownTimer);
        this.countdownTimer = null;
        await this._startRound();
      }
    }, 1000);
  }

  async _startRound() {
    const seated = this._getSeatedPlayers();
    if (seated.length < config.minPlayersToStart) {
      this._cancelCountdownToWaiting();
      return;
    }

    this.roundId = `r_${Date.now().toString(36)}_${this.tier.stakeETB}_${randomBytes(2).toString('hex')}`;
    this.status = 'LOCKING';
    this._notifyState();

    gameDb.createRound({
      roundId: this.roundId,
      tierId: this.tier.id,
      stakeSantim: this.tier.stakeSantim
    });

    // Debit all seated players in parallel
    const fundedPlayers = [];
    const failedRefs = [];

    await Promise.all(
      seated.map(async (p) => {
        const debitRef = buildRef('deb', this.roundId, p.playerRef);
        gameDb.recordTransactionPending({
          ref: debitRef,
          roundId: this.roundId,
          playerRef: p.playerRef,
          playerName: p.name,
          token: p.token,
          type: 'debit',
          amountSantim: this.tier.stakeSantim
        });

        try {
          const debitRes = await walletClient.debitBet({
            token: p.token,
            amount: this.tier.stakeSantim,
            ref: debitRef,
            roundId: this.roundId
          });

          gameDb.markTransactionSuccess({
            ref: debitRef,
            moveId: debitRes.moveId,
            replayed: debitRes.replayed
          });

          p.debited = true;
          p.debitRef = debitRef;
          p.balance = debitRes.balance;
          fundedPlayers.push(p);

          if (p.socket && p.socket.readyState === 1) {
            p.socket.send(JSON.stringify({
              type: 'BET_DEBITED',
              balance: debitRes.balance,
              moveId: debitRes.moveId,
              stakeSantim: this.tier.stakeSantim,
              stakeETB: this.tier.stakeETB
            }));
          }
        } catch (err) {
          gameDb.markTransactionFailed({
            ref: debitRef,
            errorCode: err.code,
            errorMessage: err.message
          });
          failedRefs.push(p.playerRef);

          if (p.socket && p.socket.readyState === 1) {
            p.socket.send(JSON.stringify({
              type: 'BET_FAILED',
              code: err.code || 'DEBIT_FAILED',
              balance: err.balance,
              message: formatArdiErrorMessage(err)
            }));
          }
        }
      })
    );

    // Remove players whose debits failed (or mark spectating if balance insufficient)
    for (const ref of failedRefs) {
      this.players.delete(ref);
    }

    // Abort & refund if not enough funded players remain
    if (fundedPlayers.length < config.minPlayersToStart) {
      await this.abortRound('Not enough funded players to start round. Bets have been refunded.');
      return;
    }

    // Compute real pot strictly from collected real bets
    const totalBetSantim = fundedPlayers.length * this.tier.stakeSantim;
    const rakeSantim = Math.floor(totalBetSantim * this.rakePercent);
    const netPotSantim = totalBetSantim - rakeSantim;
    this.totalPot = netPotSantim;

    gameDb.updateRoundStart({
      roundId: this.roundId,
      totalBetSantim,
      netPotSantim,
      rakeSantim
    });

    this.deck = createBallDeck();
    this.drawnBalls = [];
    this.drawnSet = new Set();
    this.winner = null;
    this.claimingLock = false;
    this.status = 'PLAYING';

    this._notifyState();
    this._startBallCalling();
  }

  _startBallCalling() {
    if (this.drawTimer) clearInterval(this.drawTimer);

    this.drawTimer = setInterval(async () => {
      if (this.deck.length === 0 || this.status !== 'PLAYING') {
        clearInterval(this.drawTimer);
        this.drawTimer = null;
        if (this.status === 'PLAYING') {
          await this.abortRound('All 75 balls drawn without a Bingo claim. Bets refunded.');
        }
        return;
      }

      const nextBall = this.deck.pop();
      this.drawnBalls.push(nextBall);
      this.drawnSet.add(nextBall.number);
      gameDb.updateRoundBalls(this.roundId, this.drawnBalls);

      this._notifyState({
        type: 'BALL_DRAWN',
        ball: nextBall,
        drawnCount: this.drawnBalls.length,
        recentBalls: this.drawnBalls.slice(-6).reverse()
      });
    }, config.ballIntervalMs);
  }

  async claimBingo(socketId) {
    const player = this._findBySocket(socketId);
    if (!player || this.status !== 'PLAYING') {
      return { success: false, message: 'Game round is not currently active.' };
    }
    if (!player.debited || player.spectating) {
      return { success: false, message: 'You are spectating this round. Wait for the next round to play.' };
    }
    if (this.winner || this.claimingLock) {
      return { success: false, message: 'Bingo has already been claimed for this round.' };
    }

    const winCheck = checkBingoWin(player.card, this.drawnSet);
    if (!winCheck.hasLine) {
      return {
        success: false,
        message: 'No completed line yet! Complete any row, column, or diagonal.'
      };
    }

    this.claimingLock = true;
    try {
      const prizeSantim = this.totalPot;
      const winRef = buildRef('win', this.roundId, player.playerRef);
      const pattern = `Any Line (${winCheck.winningLines[0].description})`;

      gameDb.recordTransactionPending({
        ref: winRef,
        roundId: this.roundId,
        playerRef: player.playerRef,
        playerName: player.name,
        token: player.token,
        type: 'credit',
        amountSantim: prizeSantim
      });

      try {
        const credRes = await walletClient.creditWin({
          token: player.token,
          amount: prizeSantim,
          ref: winRef,
          roundId: this.roundId
        });

        gameDb.markTransactionSuccess({
          ref: winRef,
          moveId: credRes.moveId,
          replayed: credRes.replayed
        });

        player.balance = credRes.balance;

        this.winner = {
          playerRef: player.playerRef,
          name: player.name,
          pattern,
          prizeSantim,
          prizeETB: (prizeSantim / 100).toFixed(2),
          moveId: credRes.moveId,
          newBalance: credRes.balance
        };

        this._finishRound(this.winner, 'Any Line Bingo claimed!');
        return { success: true, type: 'LINE', prizeSantim, moveId: credRes.moveId };
      } catch (err) {
        gameDb.markTransactionFailed({
          ref: winRef,
          errorCode: err.code,
          errorMessage: err.message
        });

        // Stop calling and finish round with payout pending desk intervention
        this.winner = {
          playerRef: player.playerRef,
          name: player.name,
          pattern,
          prizeSantim,
          prizeETB: (prizeSantim / 100).toFixed(2),
          payoutError: formatArdiErrorMessage(err)
        };
        this._finishRound(this.winner, `Bingo verified, wallet payout refused (${err.code})`);
        return {
          success: false,
          code: err.code,
          message: `Bingo verified, but wallet payout failed: ${formatArdiErrorMessage(err)}`
        };
      }
    } finally {
      this.claimingLock = false;
    }
  }

  _finishRound(winner, reason) {
    if (this.drawTimer) {
      clearInterval(this.drawTimer);
      this.drawTimer = null;
    }

    this.status = 'FINISHED';
    if (this.roundId) {
      gameDb.finishRound({
        roundId: this.roundId,
        status: 'FINISHED',
        winnerRef: winner?.playerRef || null,
        winnerName: winner?.name || null,
        winnerPattern: winner?.pattern || null,
        drawnBalls: this.drawnBalls
      });
    }

    this._notifyState({
      type: 'ROUND_FINISHED',
      winner,
      reason
    });

    if (this.intermissionTimer) clearTimeout(this.intermissionTimer);
    this.intermissionTimer = setTimeout(() => {
      this._resetRoom();
    }, config.intermissionMs);
  }

  async abortRound(reason) {
    if (this.drawTimer) {
      clearInterval(this.drawTimer);
      this.drawTimer = null;
    }
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }

    const activeRoundId = this.roundId;

    for (const p of this.players.values()) {
      if (p.debited && p.debitRef) {
        const rfndRef = buildRef('rfnd', activeRoundId, p.playerRef);
        gameDb.recordTransactionPending({
          ref: rfndRef,
          roundId: activeRoundId,
          playerRef: p.playerRef,
          playerName: p.name,
          token: p.token,
          type: 'refund',
          amountSantim: this.tier.stakeSantim,
          debitRef: p.debitRef
        });

        try {
          const res = await walletClient.refundBet({
            token: p.token,
            ref: rfndRef,
            debitRef: p.debitRef
          });
          gameDb.markTransactionSuccess({
            ref: rfndRef,
            moveId: res.moveId,
            replayed: res.replayed
          });
          p.balance = res.balance;
          p.debited = false;

          if (p.socket && p.socket.readyState === 1) {
            p.socket.send(JSON.stringify({
              type: 'BET_REFUNDED',
              balance: res.balance,
              moveId: res.moveId,
              message: reason
            }));
          }
        } catch (err) {
          gameDb.markTransactionFailed({
            ref: rfndRef,
            errorCode: err.code,
            errorMessage: err.message
          });
          console.error(`Refund failed for ${p.name}:`, err.message);
        }
      }
    }

    if (activeRoundId) {
      gameDb.finishRound({
        roundId: activeRoundId,
        status: 'ABORTED',
        drawnBalls: this.drawnBalls
      });
    }

    this._resetRoom();
  }

  _resetRoom() {
    if (this.intermissionTimer) {
      clearTimeout(this.intermissionTimer);
      this.intermissionTimer = null;
    }

    this.status = 'WAITING';
    this.roundId = null;
    this.countdown = config.countdownSeconds;
    this.drawnBalls = [];
    this.drawnSet.clear();
    this.winner = null;
    this.totalPot = 0;
    this.claimingLock = false;

    // Drop disconnected players, promote spectators & issue fresh cards for next round
    for (const [playerRef, p] of this.players.entries()) {
      if (!p.socket || p.socket.readyState !== 1) {
        this.players.delete(playerRef);
        continue;
      }
      p.card = generateBingoCard();
      p.spectating = false;
      p.debited = false;
      p.debitRef = null;
      p.socket.send(JSON.stringify({
        type: 'CARD_UPDATED',
        card: p.card
      }));
    }

    if (this._getSeatedPlayers().length >= config.minPlayersToStart) {
      this._startCountdown();
    }

    this._notifyState();
  }

  _notifyState(extraPayload = null) {
    const state = this.getPublicState();
    this.broadcast(this.tier.id, {
      type: 'ROOM_STATE',
      state,
      ...extraPayload
    });
  }
}

export class RoomManager {
  constructor(broadcastFn) {
    this.broadcast = broadcastFn;
    this.rooms = new Map();

    for (const tier of QUICK_MATCH_TIERS) {
      this.rooms.set(tier.id, new BingoRoom(tier, this.broadcast));
    }
  }

  getTiersSummary() {
    return QUICK_MATCH_TIERS.map((t) => {
      const room = this.rooms.get(t.id);
      const state = room.getPublicState();
      return {
        id: t.id,
        name: t.name,
        stakeETB: t.stakeETB,
        stakeSantim: t.stakeSantim,
        winCondition: 'Any Line',
        minPlayers: config.minPlayersToStart,
        status: state.status,
        countdown: state.countdown,
        playerCount: state.playerCount,
        totalPot: state.totalPot
      };
    });
  }

  getRoom(tierId) {
    return this.rooms.get(tierId);
  }

  handlePlayerDisconnect(socketId) {
    for (const room of this.rooms.values()) {
      room.removePlayerBySocket(socketId);
    }
  }

  /**
   * Startup crash recovery & graceful shutdown refund helper.
   */
  async recoverUnsettledDebits() {
    const unsettled = gameDb.getUnsettledDebits();
    if (unsettled.length === 0) return 0;

    console.warn(`[Recovery] Found ${unsettled.length} unsettled debit(s) from prior run. Issuing refunds...`);
    let refunded = 0;
    const roundIds = new Set();

    for (const tx of unsettled) {
      roundIds.add(tx.round_id);
      const rfndRef = buildRef('rfnd_rec', tx.round_id, tx.player_ref);
      gameDb.recordTransactionPending({
        ref: rfndRef,
        roundId: tx.round_id,
        playerRef: tx.player_ref,
        playerName: tx.player_name,
        token: tx.token,
        type: 'refund',
        amountSantim: tx.amount_santim,
        debitRef: tx.ref
      });

      try {
        const res = await walletClient.refundBet({
          token: tx.token,
          ref: rfndRef,
          debitRef: tx.ref
        });
        gameDb.markTransactionSuccess({
          ref: rfndRef,
          moveId: res.moveId,
          replayed: res.replayed
        });
        refunded++;
      } catch (err) {
        gameDb.markTransactionFailed({
          ref: rfndRef,
          errorCode: err.code,
          errorMessage: err.message
        });
        console.error(`[Recovery] Refund failed for ${tx.ref}:`, err.message);
      }
    }

    for (const rId of roundIds) {
      gameDb.finishRound({ roundId: rId, status: 'ABORTED', drawnBalls: [] });
    }
    return refunded;
  }

  async shutdownAllRooms() {
    for (const room of this.rooms.values()) {
      if (room.status === 'LOCKING' || room.status === 'PLAYING') {
        await room.abortRound('Server shutting down for maintenance. Bet refunded.');
      } else {
        if (room.countdownTimer) clearInterval(room.countdownTimer);
        if (room.drawTimer) clearInterval(room.drawTimer);
        if (room.intermissionTimer) clearTimeout(room.intermissionTimer);
      }
    }
  }
}
