export interface Player {
  playerRef: string;
  name: string;
  isBot: boolean;
  balance?: number;
}

export interface SessionData {
  ok: boolean;
  player: {
    ref: string;
    chatId: number | null;
    name: string;
  };
  balance: number; // in santim
  currency: string;
}

export interface BingoCell {
  index: number;
  row: number;
  col: number;
  letter: 'B' | 'I' | 'N' | 'G' | 'O';
  number: number;
  isFree: boolean;
}

export interface BingoCard {
  id: string;
  cells: BingoCell[];
}

export interface Ball {
  number: number;
  letter: 'B' | 'I' | 'N' | 'G' | 'O';
}

export interface WinnerInfo {
  playerRef: string;
  name: string;
  pattern: string;
  isBot: boolean;
  prizeSantim: number;
  prizeETB: string;
  newBalance?: number;
}

export interface RoomState {
  tierId: string;
  name: string;
  stakeETB: number;
  stakeSantim: number;
  winCondition: string;
  status: 'WAITING' | 'COUNTDOWN' | 'LOCKING' | 'PLAYING' | 'FINISHED';
  roundId: string | null;
  countdown: number;
  playerCount: number;
  players: Player[];
  currentBall: Ball | null;
  recentBalls: Ball[];
  drawnCount: number;
  totalPot: number; // in santim
  winner: WinnerInfo | null;
}

export interface RoomTierSummary {
  id: string;
  name: string;
  stakeETB: number;
  stakeSantim: number;
  winCondition: string;
  status: string;
  playerCount: number;
  totalPot: number;
}
