// 75-Ball Ethiopian Parlor Bingo Engine
// Column ranges:
// B: 1 - 15
// I: 16 - 30
// N: 31 - 45 (Center cell at row 2, col 2 is FREE)
// G: 46 - 60
// O: 61 - 75

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

function getRandomUnique(min, max, count) {
  const nums = [];
  const pool = [];
  for (let i = min; i <= max; i++) pool.push(i);
  for (let i = 0; i < count; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    nums.push(pool.splice(idx, 1)[0]);
  }
  return nums;
}

/**
 * Generate a 5x5 Bingo Card
 * Returns 25-cell array in row-major order: index = row * 5 + col
 */
export function generateBingoCard(cardId = null) {
  const id = cardId || `card_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

  const colB = getRandomUnique(1, 15, 5);
  const colI = getRandomUnique(16, 30, 5);
  const colN = getRandomUnique(31, 45, 4); // 4 numbers + 1 free center
  const colG = getRandomUnique(46, 60, 5);
  const colO = getRandomUnique(61, 75, 5);

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
 * Validates winning patterns against drawn numbers:
 * 1. Any Line (5 Horizontal rows, 5 Vertical columns, 2 Diagonals)
 * 2. Full House (all 24 numbered cells + free center)
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

  // Check Diagonal 1: Top-Left to Bottom-Right (0,0 -> 1,1 -> 2,2 -> 3,3 -> 4,4)
  const diag1Cells = card.cells.filter(cell => cell.row === cell.col);
  if (diag1Cells.every(isMarked)) {
    winningLines.push({
      type: 'diagonal_line',
      description: 'Diagonal (Top-Left to Bottom-Right)',
      cellIndices: diag1Cells.map(c => c.index)
    });
  }

  // Check Diagonal 2: Top-Right to Bottom-Left (0,4 -> 1,3 -> 2,2 -> 3,1 -> 4,0)
  const diag2Cells = card.cells.filter(cell => cell.row + cell.col === 4);
  if (diag2Cells.every(isMarked)) {
    winningLines.push({
      type: 'diagonal_line',
      description: 'Diagonal (Top-Right to Bottom-Left)',
      cellIndices: diag2Cells.map(c => c.index)
    });
  }

  // Check Full House (Blackout: all cells must be marked)
  const isFullHouse = card.cells.every(isMarked);

  return {
    hasLine: winningLines.length > 0,
    hasFullHouse: isFullHouse,
    winningLines,
    totalLines: winningLines.length
  };
}

/**
 * Creates a randomized 75-ball draw deck
 */
export function createBallDeck() {
  const deck = [];
  for (let i = 1; i <= 75; i++) {
    deck.push({
      number: i,
      letter: getBallLetter(i)
    });
  }
  // Fisher-Yates shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}
