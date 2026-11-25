// 75-Ball Ethiopian Parlor Bingo Engine (Cryptographically Shuffled)
// Column ranges:
// B: 1 - 15
// I: 16 - 30
// N: 31 - 45 (Center cell at row 2, col 2 is FREE)
// G: 46 - 60
// O: 61 - 75
import { randomInt, randomBytes } from 'crypto';

export const BINGO_LETTERS = ['B', 'I', 'N', 'G', 'O'];

export const COLUMN_RANGES = {
  B: { min: 1, max: 15 },
  I: { min: 16, max: 30 },
  N: { min: 31, max: 45 },
  G: { min: 46, max: 60 },
  O: { min: 61, max: 75 },
};

export function getBallLetter(num) {
  if (num <= 15) return 'B';
  if (num <= 30) return 'I';
  if (num <= 45) return 'N';
  if (num <= 60) return 'G';
  return 'O';
}

function getCryptoUnique(min, max, count) {
  const pool = [];
  for (let i = min; i <= max; i++) pool.push(i);
  const nums = [];
  for (let i = 0; i < count; i++) {
    const idx = randomInt(0, pool.length);
    nums.push(pool.splice(idx, 1)[0]);
  }
  return nums;
}

/**
 * Generate a 5x5 Bingo Card using CSPRNG
 * Returns 25-cell array in row-major order: index = row * 5 + col
 */
export function generateBingoCard(cardId = null) {
  const id = cardId || `TKT-${randomBytes(3).toString('hex').toUpperCase()}`;

  const colB = getCryptoUnique(1, 15, 5);
  const colI = getCryptoUnique(16, 30, 5);
  const colN = getCryptoUnique(31, 45, 4); // 4 numbers + 1 free center
  const colG = getCryptoUnique(46, 60, 5);
  const colO = getCryptoUnique(61, 75, 5);

  const columns = {
    B: colB,
    I: colI,
    N: [colN[0], colN[1], 0, colN[2], colN[3]], // 0 marks the center FREE cell
    G: colG,
    O: colO
  };

  const cells = [];
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 5; col++) {
      const letter = BINGO_LETTERS[col];
      const isFree = (row === 2 && col === 2);
      const number = isFree ? 0 : columns[letter][row];
      cells.push({
        index: row * 5 + col,
        row,
        col,
        letter,
        number,
        isFree
      });
    }
  }

  return {
    id,
    cells
  };
}

/**
 * Generates a pool of numbered unique Bingo tickets (1..count) for parlor selection.
 */
export function generateTicketPool(count = 100) {
  const pool = new Map();
  const seenSignatures = new Set();

  for (let num = 1; num <= count; num++) {
    let card;
    let sig;
    do {
      card = generateBingoCard(`#${num}`);
      sig = card.cells.map((c) => c.number).join(',');
    } while (seenSignatures.has(sig));

    seenSignatures.add(sig);
    card.ticketNumber = num;
    pool.set(num, card);
  }

  return pool;
}

/**
 * Validates winning patterns against drawn numbers:
 * Win Condition: Any Line ONLY (5 Horizontal rows, 5 Vertical columns, 2 Diagonals)
 */
export function checkBingoWin(card, drawnNumbersSet) {
  const isMarked = (cell) => cell.isFree || drawnNumbersSet.has(cell.number);

  const winningLines = [];

  // Check 5 horizontal rows
  for (let r = 0; r < 5; r++) {
    const rowCells = card.cells.filter(c => c.row === r);
    if (rowCells.every(isMarked)) {
      winningLines.push({
        type: 'horizontal_line',
        description: `Row ${r + 1}`,
        cellIndices: rowCells.map(c => c.index)
      });
    }
  }

  // Check 5 vertical columns
  for (let c = 0; c < 5; c++) {
    const colCells = card.cells.filter(cell => cell.col === c);
    if (colCells.every(isMarked)) {
      winningLines.push({
        type: 'vertical_line',
        description: `Column ${BINGO_LETTERS[c]}`,
        cellIndices: colCells.map(c => c.index)
      });
    }
  }

  // Check Diagonal 1: Top-Left to Bottom-Right
  const diag1Cells = card.cells.filter(cell => cell.row === cell.col);
  if (diag1Cells.every(isMarked)) {
    winningLines.push({
      type: 'diagonal_line',
      description: 'Diagonal (TL-BR)',
      cellIndices: diag1Cells.map(c => c.index)
    });
  }

  // Check Diagonal 2: Top-Right to Bottom-Left
  const diag2Cells = card.cells.filter(cell => cell.row + cell.col === 4);
  if (diag2Cells.every(isMarked)) {
    winningLines.push({
      type: 'diagonal_line',
      description: 'Diagonal (TR-BL)',
      cellIndices: diag2Cells.map(c => c.index)
    });
  }

  return {
    hasLine: winningLines.length > 0,
    winningLines,
    totalLines: winningLines.length
  };
}

/**
 * Creates a cryptographically shuffled 75-ball draw deck
 */
export function createBallDeck() {
  const deck = [];
  for (let i = 1; i <= 75; i++) {
    deck.push({
      number: i,
      letter: getBallLetter(i)
    });
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = randomInt(0, i + 1);
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}
