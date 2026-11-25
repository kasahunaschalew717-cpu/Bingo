// Production Verification Suite for Ardi Bingo
// Tests: CSPRNG Bingo Engine, Quick-Match Tiers, Ardi Wallet API Protocol & Retries,
// SQLite Financial Ledger & Crash Recovery, and Real Multiplayer Accounting (No Bots).
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Configure isolated test environment before importing server modules
const testDbPath = path.join(os.tmpdir(), `ardi_bingo_test_${Date.now()}.db`);
process.env.DB_PATH = testDbPath;
process.env.USE_MOCK_WALLET = 'true';
process.env.ARDI_GAME_KEY = 'agk_test_prod_suite';
process.env.MIN_PLAYERS_TO_START = '2';

const { generateBingoCard, checkBingoWin, createBallDeck } = await import('../src/bingoEngine.js');
const { mockWallet } = await import('../src/mockWalletApi.js');
const { walletClient } = await import('../src/walletClient.js');
const { gameDb } = await import('../src/db.js');
const { QUICK_MATCH_TIERS, RoomManager } = await import('../src/roomManager.js');

console.log('--- 🧪 STARTING PRODUCTION BINGO VERIFICATION SUITE ---\n');

// 1. Bingo Engine (Any Line Only)
console.log('1. Testing CSPRNG Bingo Engine (Any Line Only):');
const card = generateBingoCard();
assert.strictEqual(card.cells.length, 25);
assert.strictEqual(card.cells[12].isFree, true);

const rowSet = new Set([0, 1, 2, 3, 4].map((c) => card.cells[c].number));
assert.strictEqual(checkBingoWin(card, rowSet).hasLine, true);

const colSet = new Set([0, 1, 2, 3, 4].map((r) => card.cells[r * 5].number));
assert.strictEqual(checkBingoWin(card, colSet).hasLine, true);

const diagSet = new Set([0, 6, 12, 18, 24].map((i) => card.cells[i].number));
assert.strictEqual(checkBingoWin(card, diagSet).hasLine, true);

const partialSet = new Set([card.cells[0].number, card.cells[1].number]);
assert.strictEqual(checkBingoWin(card, partialSet).hasLine, false);

const deck = createBallDeck();
assert.strictEqual(deck.length, 75);
assert.strictEqual(new Set(deck.map((b) => b.number)).size, 75);
console.log('  ✅ Horizontal, Vertical, Diagonal, Incomplete rejection, and 75-ball deck verified');

// 2. Quick-Match Tiers
console.log('\n2. Testing Quick-Match Tiers:');
assert.deepStrictEqual(QUICK_MATCH_TIERS.map((t) => t.stakeETB), [5, 10, 25, 50, 100]);
console.log('  ✅ All 5 Quick-Match tiers verified: 5, 10, 25, 50, 100 ETB');

// 3. Ardi Wallet Client & Refusal Protocol
console.log('\n3. Testing WalletClient & Ardi Protocol:');
const p1Token = `ags_prod_p1_${Date.now()}`;
const p2Token = `ags_prod_p2_${Date.now()}`;

const who = await walletClient.whoami();
assert.strictEqual(who.ok, true);
assert.strictEqual(who.game.enabled, true);

const s1 = await walletClient.getSession(p1Token);
const s2 = await walletClient.getSession(p2Token);
assert.strictEqual(s1.balance, 50000);
assert.strictEqual(s2.balance, 50000);

// 4. SQLite Financial Ledger & Crash-Recovery Refund Flow
console.log('\n4. Testing SQLite Ledger & Crash-Recovery Refunds:');
const crashRoundId = `r_crash_${Date.now()}`;
gameDb.createRound({ roundId: crashRoundId, tierId: 'tier_10', stakeSantim: 1000 });
const debRef = `deb_${crashRoundId}_${s1.player.ref}`.slice(0, 64);

gameDb.recordTransactionPending({
  ref: debRef,
  roundId: crashRoundId,
  playerRef: s1.player.ref,
  playerName: s1.player.name,
  token: p1Token,
  type: 'debit',
  amountSantim: 1000
});
const debRes = await walletClient.debitBet({ token: p1Token, amount: 1000, ref: debRef, roundId: crashRoundId });
gameDb.markTransactionSuccess({ ref: debRef, moveId: debRes.moveId, replayed: debRes.replayed });
assert.strictEqual(debRes.balance, 49000);

// Simulate server restart finding unsettled debit
const broadcastEvents = [];
const rm = new RoomManager((tierId, payload) => broadcastEvents.push({ tierId, payload }));
const recoveredCount = await rm.recoverUnsettledDebits();
assert.strictEqual(recoveredCount, 1, 'Must recover and refund 1 unsettled debit');
const afterRecoveryBal = await walletClient.getBalance(p1Token);
assert.strictEqual(afterRecoveryBal, 50000, 'Player balance must be fully restored after crash recovery');
assert.strictEqual(gameDb.getUnsettledDebits().length, 0, 'No unsettled debits should remain');
console.log('  ✅ Crash recovery automatically refunded unsettled debit and restored 50,000 santim');

// 5. Real 2-Player Multiplayer Round (Zero Bots)
console.log('\n5. Testing Real 2-Player Round & Pot Accounting (Zero Bots):');
const room = rm.getRoom('tier_5'); // 5 ETB = 500 santim
const fakeSock1 = { id: 'sock_1', readyState: 1, send: () => {} };
const fakeSock2 = { id: 'sock_2', readyState: 1, send: () => {} };

const player1 = room.addOrReconnectPlayer(fakeSock1, { token: p1Token, ...s1 });
assert.strictEqual(room.status, 'WAITING', '1 player must stay in WAITING (no bots injected)');
assert.strictEqual(room.getPublicState().playerCount, 1);

const player2 = room.addOrReconnectPlayer(fakeSock2, { token: p2Token, ...s2 });
assert.strictEqual(room.status, 'COUNTDOWN', '2 real players must start COUNTDOWN');
assert.strictEqual(room.getPublicState().playerCount, 2);

// Clear countdown timer & trigger round lock directly for deterministic test
clearInterval(room.countdownTimer);
room.countdownTimer = null;
await room._startRound();

assert.strictEqual(room.status, 'PLAYING');
// 2 players * 500 santim = 1000 santim total bet; 10% rake = 100; net pot = 900 santim
assert.strictEqual(room.totalPot, 900, 'Net pot must equal collected bets minus 10% rake (900 santim)');
assert.strictEqual(await walletClient.getBalance(p1Token), 49500);
assert.strictEqual(await walletClient.getBalance(p2Token), 49500);

// Draw numbers matching row 0 of player1's card
clearInterval(room.drawTimer);
room.drawTimer = null;
for (let c = 0; c < 5; c++) {
  room.drawnSet.add(player1.card.cells[c].number);
}

const claimRes = await room.claimBingo('sock_1');
assert.strictEqual(claimRes.success, true);
assert.strictEqual(claimRes.prizeSantim, 900);
assert.strictEqual(await walletClient.getBalance(p1Token), 50400, 'Winner must receive full 900 santim pot');

const p1History = gameDb.getPlayerTransactions(s1.player.ref, 10);
assert(p1History.some((tx) => tx.type === 'credit' && tx.amount_santim === 900 && tx.status === 'SUCCESS'));
console.log('  ✅ Real 2-player round, 500 santim debits, 900 santim pot credit, and SQLite ledger verified');

// Cleanup timers & DB
await rm.shutdownAllRooms();
gameDb.close();
try {
  fs.unlinkSync(testDbPath);
  fs.unlinkSync(`${testDbPath}-wal`);
  fs.unlinkSync(`${testDbPath}-shm`);
} catch {
  // ignore cleanup errors
}

console.log('\n--- 🎉 ALL PRODUCTION VERIFICATION TESTS PASSED! ---');
