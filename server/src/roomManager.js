// Room Manager for Ardi Ethiopian Parlor Quick-Match Bingo
// Win condition: Any Line ONLY (Horizontal, Vertical, or Diagonal)
import { generateBingoCard, checkBingoWin, createBallDeck } from './bingoEngine.js';
import { walletClient } from './walletClient.js';

export const QUICK_MATCH_TIERS = [
  { id: 'tier_5', name: 'Bronze Parlor', stakeETB: 5, stakeSantim: 500, minPlayers: 2 },
  { id: 'tier_10', name: 'Silver Parlor', stakeETB: 10, stakeSantim: 1000, minPlayers: 2 },
  { id: 'tier_25', name: 'Gold Parlor', stakeETB: 25, stakeSantim: 2500, minPlayers: 2 },
  { id: 'tier_50', name: 'Platinum Parlor', stakeETB: 50, stakeSantim: 5000, minPlayers: 2 },
  { id: 'tier_100', name: 'Diamond Parlor', stakeETB: 100, stakeSantim: 10000, minPlayers: 2 }
];

const BOT_NAMES = [
  'Abe***** T.',
  'Hanna***** K.',
  'Dawit***** M.',
  'Tigist***** B.',
  'Yonas***** G.',
  'Selam***** W.',
  'Befek***** Z.'
];

class BingoRoom {
  constructor(tier, broadcastFn) {
    this.tier = tier;
    this.broadcast = broadcastFn;
    this.status = 'WAITING'; // WAITING | COUNTDOWN | LOCKING | PLAYING | FINISHED
    this.roundId = null;
    this.countdown = 15;
    this.countdownTimer = null;
    this.drawTimer = null;

    // Players: Map<socketId, { socket, token, playerRef, name, card, isBot, debited, debitRef, balance }>
    this.players = new Map();

    // Drawn numbers
    this.deck = [];
    this.drawnBalls = [];
    this.drawnSet = new Set();

    // Winner of the round (Any Line = 100% of Net Pot)
    this.winner = null;
    this.totalPot = 0;

    // Commission rake
    this.rakePercent = 0.10; // 10%
  }

  getPublicState() {
    return {
      tierId: this.tier.id,
      name: this.tier.name,
      stakeETB: this.tier.stakeETB,
      stakeSantim: this.tier.stakeSantim,
      winCondition: 'Any Line',
      status: this.status,
      roundId: this.roundId,
      countdown: this.countdown,
      playerCount: this.players.size,
      players: Array.from(this.players.values()).map(p => ({
        playerRef: p.playerRef,
        name: p.name,
        isBot: p.isBot
      })),
      currentBall: this.drawnBalls.length > 0 ? this.drawnBalls[this.drawnBalls.length - 1] : null,
      recentBalls: this.drawnBalls.slice(-6).reverse(),
      drawnCount: this.drawnBalls.length,
      totalPot: this.totalPot,
      winner: this.winner
    };
  }

  addPlayer(socket, session) {
    for (const [sId, p] of this.players.entries()) {
      if (p.token === session.token) {
        p.socket = socket;
        return p;
      }
    }

    const card = generateBingoCard();
    const player = {
      socketId: socket.id,
      socket,
      token: session.token,
      playerRef: session.player.ref,
      name: session.player.name,
      card,
      isBot: false,
      debited: false,
      debitRef: null,
      balance: session.balance
    };

    this.players.set(socket.id, player);
    this._ensureBots();

    if (this.status === 'WAITING' && !this.countdownTimer) {
      this._startCountdown();
    }

    this._notifyState();
    return player;
  }

  _ensureBots() {
    const currentBots = Array.from(this.players.values()).filter(p => p.isBot);
    const needed = Math.max(0, 2 - currentBots.length);
    for (let i = 0; i < needed; i++) {
      const botId = `bot_${Date.now()}_${Math.random()}`;
      const botName = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];
      const botCard = generateBingoCard();
      this.players.set(botId, {
        socketId: botId,
        socket: null,
        token: `bot_token_${botId}`,
        playerRef: `pref_${botId.slice(0, 8)}`,
        name: botName,
        card: botCard,
        isBot: true,
        debited: true,
        debitRef: `debit_bot_${botId}`,
        balance: 100000
      });
    }
  }

  removePlayer(socketId) {
    const player = this.players.get(socketId);
    if (!player) return;

    if (this.status === 'PLAYING') {
      player.socket = null; // detached
    } else {
      this.players.delete(socketId);
      const realPlayers = Array.from(this.players.values()).filter(p => !p.isBot);
      if (realPlayers.length === 0) {
        this._resetRoom();
      }
    }
    this._notifyState();
  }

  regenerateCard(socketId) {
    const player = this.players.get(socketId);
    if (player && (this.status === 'WAITING' || this.status === 'COUNTDOWN')) {
      player.card = generateBingoCard();
      if (player.socket && player.socket.send) {
        player.socket.send(JSON.stringify({
          type: 'CARD_UPDATED',
          card: player.card
        }));
      }
    }
  }

  _startCountdown() {
    this.status = 'COUNTDOWN';
    this.countdown = 12;
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
    this.roundId = `rnd_${Date.now()}_${this.tier.id}`;
    this.status = 'LOCKING';
    this._notifyState();

    // 1. Debit all real players
    const debitedRealPlayers = [];
    const failedPlayers = [];

    for (const [sId, p] of this.players.entries()) {
      if (p.isBot) continue;

      const debitRef = `deb_${this.roundId}_${p.playerRef}`.slice(0, 64);
      try {
        const debitRes = await walletClient.debitBet({
          token: p.token,
          amount: this.tier.stakeSantim,
          ref: debitRef,
          roundId: this.roundId
        });
        p.debited = true;
        p.debitRef = debitRef;
        p.balance = debitRes.balance;
        debitedRealPlayers.push(p);

        if (p.socket && p.socket.send) {
          p.socket.send(JSON.stringify({
            type: 'BET_DEBITED',
            balance: debitRes.balance,
            stakeSantim: this.tier.stakeSantim,
            stakeETB: this.tier.stakeETB
          }));
        }
      } catch (err) {
        console.error(`Debit failed for player ${p.name}:`, err.message);
        failedPlayers.push(sId);
        if (p.socket && p.socket.send) {
          p.socket.send(JSON.stringify({
            type: 'BET_FAILED',
            message: err.code === 'INSUFFICIENT_FUNDS'
              ? 'Insufficient wallet balance for this parlor stake.'
              : 'Could not place bet with wallet. Please try again.'
          }));
        }
      }
    }

    for (const sId of failedPlayers) {
      this.players.delete(sId);
    }

    const activeReal = Array.from(this.players.values()).filter(p => !p.isBot && p.debited);
    if (activeReal.length === 0) {
      console.log(`[${this.tier.name}] No active debited players. Cancelling round.`);
      await this._abortRound('Not enough funded players to start round.');
      return;
    }

    // Calculate total net prize pot (100% goes to the first Any Line winner)
    const totalEntries = this.players.size;
    const rawTotalSantim = totalEntries * this.tier.stakeSantim;
    const netPotSantim = Math.floor(rawTotalSantim * (1 - this.rakePercent));
    this.totalPot = netPotSantim;

    this.deck = createBallDeck();
    this.drawnBalls = [];
    this.drawnSet = new Set();
    this.winner = null;
    this.status = 'PLAYING';

    this._notifyState();
    this._startBallCalling();
  }

  _startBallCalling() {
    if (this.drawTimer) clearInterval(this.drawTimer);

    // Call a ball every 3.2 seconds
    this.drawTimer = setInterval(() => {
      if (this.deck.length === 0 || this.status !== 'PLAYING') {
        clearInterval(this.drawTimer);
        this.drawTimer = null;
        if (this.status === 'PLAYING') {
          this._finishRound(null, 'All 75 balls drawn');
        }
        return;
      }

      const nextBall = this.deck.pop();
      this.drawnBalls.push(nextBall);
      this.drawnSet.add(nextBall.number);

      // Check simulated players for Any Line win
      this._checkBotBingo();

      this._notifyState({
        type: 'BALL_DRAWN',
        ball: nextBall,
        drawnCount: this.drawnBalls.length,
        recentBalls: this.drawnBalls.slice(-6).reverse()
      });
    }, 3200);
  }

  _checkBotBingo() {
    if (this.winner || this.status !== 'PLAYING') return;

    for (const p of this.players.values()) {
      if (!p.isBot) continue;
      const win = checkBingoWin(p.card, this.drawnSet);
      if (win.hasLine) {
        this.winner = {
          playerRef: p.playerRef,
          name: p.name,
          pattern: `Any Line (${win.winningLines[0].description})`,
          isBot: true,
          prizeSantim: this.totalPot,
          prizeETB: (this.totalPot / 100).toFixed(2)
        };
        this._finishRound(this.winner, `Bot Bingo: ${win.winningLines[0].description}`);
        break;
      }
    }
  }

  async claimBingo(socketId) {
    const player = this.players.get(socketId);
    if (!player || this.status !== 'PLAYING') {
      return { success: false, message: 'Game is not currently active.' };
    }

    if (this.winner) {
      return { success: false, message: 'Bingo has already been claimed for this round!' };
    }

    const winCheck = checkBingoWin(player.card, this.drawnSet);

    // Win condition: Any Line ONLY (Row, Column, or Diagonal)
    if (winCheck.hasLine) {
      const prizeSantim = this.totalPot;
      const winRef = `win_ln_${this.roundId}_${player.playerRef}`.slice(0, 64);

      let newBalance = player.balance + prizeSantim;
      if (!player.isBot) {
        try {
          const credRes = await walletClient.creditWin({
            token: player.token,
            amount: prizeSantim,
            ref: winRef,
            roundId: this.roundId
          });
          newBalance = credRes.balance;
          player.balance = newBalance;
        } catch (err) {
          console.error(`Credit win failed for ${player.name}:`, err);
        }
      }

      this.winner = {
        playerRef: player.playerRef,
        name: player.name,
        pattern: `Any Line (${winCheck.winningLines[0].description})`,
        isBot: false,
        prizeSantim,
        prizeETB: (prizeSantim / 100).toFixed(2),
        newBalance
      };

      this._finishRound(this.winner, 'Any Line Bingo claimed!');
      return { success: true, type: 'LINE', prizeSantim };
    }

    return {
      success: false,
      message: 'No completed line yet! Complete any horizontal row, vertical column, or diagonal.'
    };
  }

  async _finishRound(winner, reason) {
    if (this.drawTimer) {
      clearInterval(this.drawTimer);
      this.drawTimer = null;
    }

    this.status = 'FINISHED';
    this._notifyState({
      type: 'ROUND_FINISHED',
      winner,
      reason
    });

    // 10 second intermission before next round starts
    setTimeout(() => {
      this._resetRoom();
    }, 10000);
  }

  async _abortRound(reason) {
    if (this.drawTimer) clearInterval(this.drawTimer);
    if (this.countdownTimer) clearInterval(this.countdownTimer);

    for (const p of this.players.values()) {
      if (!p.isBot && p.debited && p.debitRef) {
        const rfndRef = `rfnd_${this.roundId}_${p.playerRef}`.slice(0, 64);
        try {
          const res = await walletClient.refundBet({
            token: p.token,
            ref: rfndRef,
            debitRef: p.debitRef
          });
          p.balance = res.balance;
          if (p.socket && p.socket.send) {
            p.socket.send(JSON.stringify({
              type: 'BET_REFUNDED',
              balance: res.balance,
              message: reason
            }));
          }
        } catch (err) {
          console.error(`Refund failed for ${p.name}:`, err);
        }
      }
    }

    this.status = 'WAITING';
    this._resetRoom();
  }

  _resetRoom() {
    this.status = 'WAITING';
    this.roundId = null;
    this.countdown = 15;
    this.drawnBalls = [];
    this.drawnSet.clear();
    this.winner = null;
    this.totalPot = 0;

    for (const p of this.players.values()) {
      p.card = generateBingoCard();
      p.debited = false;
      p.debitRef = null;
    }

    this._ensureBots();

    const realPlayers = Array.from(this.players.values()).filter(p => !p.isBot);
    if (realPlayers.length > 0) {
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
    return QUICK_MATCH_TIERS.map(t => {
      const room = this.rooms.get(t.id);
      return {
        id: t.id,
        name: t.name,
        stakeETB: t.stakeETB,
        stakeSantim: t.stakeSantim,
        winCondition: 'Any Line',
        status: room.status,
        playerCount: room.players.size,
        totalPot: room.totalPot
      };
    });
  }

  getRoom(tierId) {
    return this.rooms.get(tierId);
  }

  handlePlayerDisconnect(socketId) {
    for (const room of this.rooms.values()) {
      if (room.players.has(socketId)) {
        room.removePlayer(socketId);
      }
    }
  }
}
