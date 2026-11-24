import React from 'react';
import { Star, Check } from 'lucide-react';
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

const COLUMN_COLORS = {
  B: 'text-[#ef4444] border-b-[#ef4444]',
  I: 'text-[#ffa800] border-b-[#ffa800]',
  N: 'text-[#00a3ff] border-b-[#00a3ff]',
  G: 'text-[#00c070] border-b-[#00c070]',
  O: 'text-[#a855f7] border-b-[#a855f7]'
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

  const handleCellClick = (cell: BingoCell) => {
    if (!interactive) return;
    sound.playDaub();
    onToggleCell(cell);
  };

  return (
    <div className="w-full max-w-sm mx-auto bg-[#0a1324] rounded-2xl p-3 border border-[#1b2d4e] shadow-xl">
      {/* Column Headers B - I - N - G - O */}
      <div className="grid grid-cols-5 gap-1.5 mb-1.5">
        {letters.map((letter) => (
          <div
            key={letter}
            className={`py-1 text-center font-black text-sm tracking-wider uppercase border-b-2 bg-[#0e1c35] rounded-t-lg ${COLUMN_COLORS[letter]}`}
          >
            {letter}
          </div>
        ))}
      </div>

      {/* 5x5 Matrix of Cells */}
      <div className="grid grid-cols-5 gap-1.5">
        {card.cells.map((cell) => {
          const isFree = cell.isFree;
          const isDrawn = !isFree && drawnNumbers.has(cell.number);
          const isMarked = isFree || markedIndices.has(cell.index);
          const isWinning = winningCellIndices.has(cell.index);

          return (
            <button
              key={cell.index}
              disabled={!interactive}
              onClick={() => handleCellClick(cell)}
              className={`relative aspect-square flex flex-col items-center justify-center rounded-xl font-black text-base transition-all duration-150 select-none cursor-pointer ${
                isWinning
                  ? 'bg-gradient-to-br from-[#ffa800] to-[#e67300] text-black shadow-[0_0_14px_rgba(255,168,0,0.9)] scale-95 border-2 border-white animate-pulse'
                  : isMarked
                  ? 'bg-[#14294d] text-white border-2 border-[#ffa800] shadow-[inset_0_0_10px_rgba(255,168,0,0.3)]'
                  : isDrawn
                  ? 'bg-[#0f2142] text-[#00a3ff] border border-[#00a3ff]/60 hover:bg-[#152e5c] animate-pulse'
                  : 'bg-[#0e1a32] text-white/90 border border-[#172b4c] hover:bg-[#132342] hover:border-[#1e3a6a]'
              }`}
            >
              {isFree ? (
                <div className="flex flex-col items-center justify-center">
                  <Star className="w-4 h-4 text-[#ffa800] fill-[#ffa800]" />
                  <span className="text-[9px] font-extrabold tracking-tighter text-[#ffa800] mt-0.5">FREE</span>
                </div>
              ) : (
                <>
                  <span className={`text-base font-black ${isWinning ? 'text-black' : isMarked ? 'text-[#ffa800]' : 'text-white'}`}>
                    {cell.number}
                  </span>

                  {/* Stamp badge if marked and not free */}
                  {isMarked && !isWinning && (
                    <div className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-[#ffa800] flex items-center justify-center">
                      <Check className="w-2 h-2 text-black stroke-[3]" />
                    </div>
                  )}

                  {/* Visual hint if number was drawn but not marked yet */}
                  {isDrawn && !isMarked && (
                    <span className="absolute bottom-1 w-1.5 h-1.5 rounded-full bg-[#00a3ff] animate-ping"></span>
                  )}
                </>
              )}
            </button>
          );
        })}
      </div>

      {/* Ticket Footer / ID */}
      <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-[#15233e] px-1 text-[11px] text-[#7e92b4]">
        <span>Ticket <strong className="text-white font-mono">{card.id}</strong></span>
        <span className="text-[10px] text-[#ffa800] font-semibold">Standard 75-Ball</span>
      </div>
    </div>
  );
};
