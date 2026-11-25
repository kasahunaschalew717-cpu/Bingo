export interface Player {
  playerRef: string;
  name: string;
  ticketNumber?: number | null;
  spectating?: boolean;
  debited?: boolean;
}

export interface TakenTicket {
  ticketNumber: number;
  playerRef: string;
  name: string;
}

export interface DeskGameInfo {
  slug: string;
  title: string;
  txName: string;
  enabled: boolean;
}

export interface SessionData {
  ok: boolean;
  mode?: 'production' | 'sandbox';
  game?: DeskGameInfo;
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
  ticketNumber?: number;
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
  prizeSantim: number;
  prizeETB: string;
  moveId?: string;
  newBalance?: number;
  payoutError?: string;
}

export interface RoomState {
  tierId: string;
  name: string;
  stakeETB: number;
  stakeSantim: number;
  winCondition: string;
  minPlayers: number;
  status: 'WAITING' | 'COUNTDOWN' | 'LOCKING' | 'PLAYING' | 'FINISHED';
  roundId: string | null;
  countdown: number;
  playerCount: number;
  totalConnected: number;
  ticketPoolSize?: number;
  takenTickets?: TakenTicket[];
  players: Player[];
  currentBall: Ball | null;
  recentBalls: Ball[];
  drawnBalls: Ball[];
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
  minPlayers: number;
  status: 'WAITING' | 'COUNTDOWN' | 'LOCKING' | 'PLAYING' | 'FINISHED';
  countdown: number;
  playerCount: number;
  totalPot: number;
}

export interface TransactionRecord {
  ref: string;
  round_id: string;
  type: 'debit' | 'credit' | 'refund';
  amount_santim: number;
  move_id: string | null;
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'REPLAYED';
  error_code: string | null;
  created_at: number;
}
