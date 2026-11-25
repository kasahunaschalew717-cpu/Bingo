import React, { useMemo } from 'react';
import { Star, Flame } from 'lucide-react';
import type { BingoCard, BingoCell } from '../types';
import { sound } from '../services/sound';

interface BingoCardViewProps {
  card: BingoCard;
  drawnNumbers: Set<number>;
  markedIndices: Set<number>;
  winningCellIndices?: Set<number>;
  onToggleCell: (cell: BingoCell) => void;
  interactive?: boolean;
}

const COLUMN_STYLES = {
  B: {
    pill: 'bg-gradient-to-b from-[#ef4444] to-[#b91c1c] text-white shadow-[0_3px_10px_rgba(239,68,68,0.35)]',
    ring: 'border-[#fca5a5]/40'
  },
  I: {
    pill: 'bg-gradient-to-b from-[#ffb800] to-[#d97706] text-black shadow-[0_3px_10px_rgba(255,168,0,0.35)]',
    ring: 'border-[#fde68a]/50'
  },
  N: {
    pill: 'bg-gradient-to-b from-[#38bdf8] to-[#0284c7] text-white shadow-[0_3px_10px_rgba(0,163,255,0.35)]',
    ring: 'border-[#bae6fd]/40'
  },
  G: {
    pill: 'bg-gradient-to-b from-[#10b981] to-[#047857] text-white shadow-[0_3px_10px_rgba(0,192,112,0.35)]',
    ring: 'border-[#a7f3d0]/40'
  },
  O: {
    pill: 'bg-gradient-to-b from-[#a855f7] to-[#7e22ce] text-white shadow-[0_3px_10px_rgba(168,85,247,0.35)]',
    ring: 'border-[#e9d5ff]/40'
  }
};

export const BingoCardView: React.FC<BingoCardViewProps> = ({
  card,
  drawnNumbers,
  markedIndices,
  winningCellIndices = new Set(),
  onToggleCell,
  interactive = true
}) => {
  const letters: ('B' | 'I' | 'N' | 'G' | 'O')[] = ['B', 'I', 'N', 'G', 'O'];

  // Compute hot cells (1 number away from Any Line) and marked count
  const { hotIndices, markedCount, bestLineProgress } = useMemo(() => {
    const hot = new Set<number>();
    let best = 0;
    const isMarked = (idx: number) => card.cells[idx].isFree || markedIndices.has(idx);

    const lines: number[][] = [];
    for (let r = 0; r < 5; r++) lines.push([0, 1, 2, 3, 4].map((c) => r * 5 + c));
    for (let c = 0; c < 5; c++) lines.push([0, 1, 2, 3, 4].map((r) => r * 5 + c));
    lines.push([0, 6, 12, 18, 24]);
    lines.push([4, 8, 12, 16, 20]);

    for (const line of lines) {
      const unmarked = line.filter((idx) => !isMarked(idx));
      const progress = 5 - unmarked.length;
      if (progress > best) best = progress;
      if (unmarked.length === 1) {
        hot.add(unmarked[0]);
      }
    }

    const totalMarked = card.cells.filter((c) => c.isFree || markedIndices.has(c.index)).length;
    return { hotIndices: hot, markedCount: totalMarked, bestLineProgress: best };
  }, [card, markedIndices]);

  const handleCellClick = (cell: BingoCell) => {
    if (!interactive) return;
    sound.playDaub();
    onToggleCell(cell);
  };

  const hasWin = winningCellIndices.size >= 5;
  const isOneAway = !hasWin && bestLineProgress === 4;

  return (
    <div className="relative w-full max-w-sm mx-auto rounded-3xl bg-gradient-to-b from-[#101e38] via-[#0b162b] to-[#081020] border border-[#223963] shadow-[0_14px_34px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.07)] overflow-hidden">
      {/* Top Ticket Stub Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#0c172c] border-b border-dashed border-[#213760]">
        <span className="px-2 py-0.5 rounded-md bg-[#ffa800]/15 border border-[#ffa800]/40 text-[#ffa800] text-[11px] font-black tracking-wide font-mono">
          {card.id}
        </span>

        <div className="flex items-center gap-1.5">
          {hasWin ? (
            <span className="px-2 py-0.5 rounded-full bg-[#00c070]/20 border border-[#00c070]/50 text-[#00c070] text-[10px] font-black uppercase tracking-wider">
              Line Ready
            </span>
          ) : isOneAway ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#ffa800]/20 border border-[#ffa800]/50 text-[#ffa800] text-[10px] font-black uppercase tracking-wider">
              <Flame className="w-3 h-3 fill-[#ffa800]" />
              1 Away
            </span>
          ) : (
            <span className="text-[11px] font-bold text-[#7e92b4] tabular-nums">
              {markedCount}/25
            </span>
          )}
        </div>
      </div>

      {/* Ticket Perforation Side Notches */}
      <div className="relative px-3.5 pt-3 pb-3.5">
        <div className="absolute -left-2 -top-2 w-4 h-4 rounded-full bg-[#070e1b] border-r border-[#213760]"></div>
        <div className="absolute -right-2 -top-2 w-4 h-4 rounded-full bg-[#070e1b] border-l border-[#213760]"></div>

        {/* Column Header Spheres: B - I - N - G - O */}
        <div className="grid grid-cols-5 gap-2 mb-2.5">
          {letters.map((letter) => (
            <div
              key={letter}
              className={`h-8 rounded-xl border ${COLUMN_STYLES[letter].ring} ${COLUMN_STYLES[letter].pill} flex items-center justify-center font-black text-base tracking-widest`}
            >
              {letter}
            </div>
          ))}
        </div>

        {/* 5x5 Matrix of Tactile Tiles */}
        <div className="grid grid-cols-5 gap-2">
          {card.cells.map((cell) => {
            const isFree = cell.isFree;
            const isDrawn = !isFree && drawnNumbers.has(cell.number);
            const isMarked = isFree || markedIndices.has(cell.index);
            const isWinning = winningCellIndices.has(cell.index);
            const isHot = !isMarked && hotIndices.has(cell.index);

            return (
              <button
                key={cell.index}
                type="button"
                disabled={!interactive}
                onClick={() => handleCellClick(cell)}
                className={`relative aspect-square rounded-xl flex items-center justify-center transition-all duration-150 select-none ${
                  interactive ? 'cursor-pointer active:scale-92' : 'cursor-default'
                } ${
                  isWinning
                    ? 'bg-gradient-to-b from-[#ffc436] to-[#e68a00] border-2 border-[#fff3cc] shadow-[0_4px_14px_rgba(255,168,0,0.45)]'
                    : isMarked
                    ? 'bg-[#0c182e] border border-[#2a4575] shadow-[inset_0_2px_6px_rgba(0,0,0,0.5)]'
                    : isDrawn
                    ? 'bg-[#102446] border-2 border-[#00a3ff]/80 shadow-[0_2px_10px_rgba(0,163,255,0.2)] hover:bg-[#142d56]'
                    : isHot
                    ? 'bg-[#15223d] border border-[#ffa800]/55 shadow-[inset_0_1px_0_rgba(255,168,0,0.15)] hover:bg-[#1a2b4c]'
                    : 'bg-[#0e1b33] border border-[#1a2d50] shadow-[0_2px_5px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.05)] hover:bg-[#132342] hover:border-[#243d6b]'
                }`}
              >
                {isFree ? (
                  <div
                    className={`w-[82%] h-[82%] rounded-full flex flex-col items-center justify-center shadow-[inset_0_1px_2px_rgba(255,255,255,0.35),0_2px_6px_rgba(0,0,0,0.4)] ${
                      isWinning
                        ? 'bg-[#070e1b]/20'
                        : 'bg-gradient-to-b from-[#ffb800] to-[#cc7a00] border border-[#ffe08a]/60'
                    }`}
                  >
                    <Star
                      className={`w-3.5 h-3.5 ${
                        isWinning ? 'text-[#070e1b] fill-[#070e1b]' : 'text-[#070e1b] fill-[#070e1b]'
                      }`}
                    />
                    <span className="text-[8px] font-black tracking-wider text-[#070e1b] leading-none mt-0.5">
                      FREE
                    </span>
                  </div>
                ) : (
                  <>
                    {/* Dauber Ink Stamp when Marked (not winning) */}
                    {isMarked && !isWinning && (
                      <div className="animate-daub absolute inset-1.5 rounded-full bg-gradient-to-b from-[#ffa800] to-[#d97706] border border-[#ffd875]/60 shadow-[inset_0_2px_3px_rgba(255,255,255,0.35),0_3px_8px_rgba(255,168,0,0.35)]" />
                    )}

                    {/* Cell Numeral */}
                    <span
                      className={`relative z-10 text-[17px] font-black tabular-nums leading-none ${
                        isWinning || isMarked
                          ? 'text-[#070e1b]'
                          : isDrawn
                          ? 'text-[#58c4ff]'
                          : 'text-white'
                      }`}
                    >
                      {cell.number}
                    </span>

                    {/* Subtle Unmarked Called Indicator */}
                    {isDrawn && !isMarked && (
                      <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#00a3ff] shadow-[0_0_6px_#00a3ff]" />
                    )}

                    {/* Subtle 1-Away Target Dot */}
                    {isHot && !isDrawn && (
                      <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[#ffa800]" />
                    )}
                  </>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
