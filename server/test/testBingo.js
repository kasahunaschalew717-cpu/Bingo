// Automated Verification Test Suite for Ardi Bingo & Wallet API
// Win Condition: Any Line ONLY (Horizontal, Vertical, or Diagonal)
import assert from 'assert';
import { generateBingoCard, checkBingoWin, createBallDeck } from '../src/bingoEngine.js';
import { mockWallet } from '../src/mockWalletApi.js';
import { QUICK_MATCH_TIERS } from '../src/roomManager.js';

console.log('--- 🧪 STARTING ARDI BINGO VERIFICATION SUITE (WIN CONDITION: ANY LINE) ---\n');

// 1. Bingo Engine: Any Line Verification
console.log('1. Testing Bingo Engine (Any Line Win Condition):');

const card = generateBingoCard();
assert.strictEqual(card.cells.length, 25, 'Card must have 25 cells');
assert.strictEqual(card.cells[12].isFree, true, 'Center cell (12) must be FREE');

// Test Horizontal Line
const drawnHorizontal = new Set();
for (let c = 0; c < 5; c++) {
  drawnHorizontal.add(card.cells[c].number);
}
const hWin = checkBingoWin(card, drawnHorizontal);
assert.strictEqual(hWin.hasLine, true, 'Horizontal row must trigger line win');
console.log('  ✅ Any Line: Horizontal line detection works');

// Test Vertical Line
const drawnVertical = new Set();
for (let r = 0; r < 5; r++) {
  const cell = card.cells[r * 5 + 0]; // Column B
  drawnVertical.add(cell.number);
}
const vWin = checkBingoWin(card, drawnVertical);
assert.strictEqual(vWin.hasLine, true, 'Vertical column must trigger line win');
console.log('  ✅ Any Line: Vertical column detection works');

// Test Diagonal Line
const drawnDiag = new Set();
[0, 6, 12, 18, 24].forEach(idx => {
  if (card.cells[idx].number !== 0) drawnDiag.add(card.cells[idx].number);
});
const dWin = checkBingoWin(card, drawnDiag);
assert.strictEqual(dWin.hasLine, true, 'Diagonal must trigger line win');
console.log('  ✅ Any Line: Diagonal detection works');

// Incomplete line test
const drawnIncomplete = new Set([card.cells[0].number, card.cells[1].number]);
const noWin = checkBingoWin(card, drawnIncomplete);
assert.strictEqual(noWin.hasLine, false, 'Incomplete line must not win');
console.log('  ✅ Incomplete line correctly rejected');

// 2. Quick Match Tiers
console.log('\n2. Testing Quick-Match Tiers:');
const expectedStakes = [5, 10, 25, 50, 100];
const actualStakes = QUICK_MATCH_TIERS.map(t => t.stakeETB);
assert.deepStrictEqual(actualStakes, expectedStakes, 'Quick match stakes must match 5, 10, 25, 50, 100 ETB');
console.log(`  ✅ 5 Tiers verified: ${actualStakes.join(', ')} ETB`);

// 3. Ardi Wallet API Tests
console.log('\n3. Testing Ardi Game Wallet API:');
const testToken = `ags_test_${Date.now()}`;
const authHeader = `Bearer agk_test_key_12345`;

const sessionRes = mockWallet.handleSession(authHeader, { token: testToken });
assert.strictEqual(sessionRes.status, 200);
const startBal = sessionRes.body.balance;

// Debit bet
const roundId = `round_line_test_1`;
const debitRef = `deb_${roundId}_test`;
const debitRes = mockWallet.handleDebit(authHeader, {
  token: testToken,
  amount: 1000, // 10 ETB
  ref: debitRef,
  roundId
});
assert.strictEqual(debitRes.status, 200);
assert.strictEqual(debitRes.body.balance, startBal - 1000);
console.log(`  ✅ /debit 10 ETB bet placed (Balance: ${debitRes.body.balance} santim)`);

// Credit 100% net pot for Any Line win
const potSantim = 3600; // e.g. 4 players * 10 ETB = 40 ETB - 10% rake = 36 ETB
const winRef = `win_ln_${roundId}_test`;
const creditRes = mockWallet.handleCredit(authHeader, {
  token: testToken,
  amount: potSantim,
  ref: winRef,
  roundId
});
assert.strictEqual(creditRes.status, 200);
assert.strictEqual(creditRes.body.balance, startBal - 1000 + potSantim);
console.log(`  ✅ /credit 100% pot (${potSantim / 100} ETB) for Any Line Bingo credited successfully!`);

console.log('\n--- 🎉 ALL TESTS PASSED! WIN CONDITION: ANY LINE ONLY ---');
