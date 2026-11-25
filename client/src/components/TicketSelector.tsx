import React, { useState, useEffect } from 'react';
import { Lock, Ticket } from 'lucide-react';
import type { TakenTicket } from '../types';

interface TicketSelectorProps {
  poolSize: number;
  currentTicketNumber: number | null;
  currentPlayerRef: string;
  takenTickets: TakenTicket[];
  errorMessage: string | null;
  onSelectTicket: (ticketNumber: number) => void;
}

const RANGES = [
  { label: '1–25', start: 1, end: 25 },
  { label: '26–50', start: 26, end: 50 },
  { label: '51–75', start: 51, end: 75 },
  { label: '76–100', start: 76, end: 100 }
];

export const TicketSelector: React.FC<TicketSelectorProps> = ({
  poolSize = 100,
  currentTicketNumber,
  currentPlayerRef,
  takenTickets,
  errorMessage,
  onSelectTicket
}) => {
  const [pageIdx, setPageIdx] = useState(0);

  useEffect(() => {
    if (currentTicketNumber) {
      const targetPage = Math.floor((currentTicketNumber - 1) / 25);
      if (targetPage >= 0 && targetPage < RANGES.length) {
        setPageIdx(targetPage);
      }
    }
  }, [currentTicketNumber]);

  const takenMap = new Map<number, TakenTicket>();
  takenTickets.forEach((t) => takenMap.set(t.ticketNumber, t));

  const activeRange = RANGES[pageIdx];
  const numbers: number[] = [];
  for (let n = activeRange.start; n <= Math.min(activeRange.end, poolSize); n++) {
    numbers.push(n);
  }

  return (
    <div className="w-full max-w-sm mx-auto rounded-2xl bg-gradient-to-b from-[#101e38] to-[#0a1426] border border-[#1f345c] p-3 mb-3 shadow-[0_8px_24px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.05)]">
      {/* Header + Range Tabs */}
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-1.5">
          <Ticket className="w-4 h-4 text-[#ffa800] shrink-0" />
          <span className="text-xs font-bold text-white font-serif whitespace-nowrap">
            {currentTicketNumber ? `Ticket #${currentTicketNumber}` : 'Pick Ticket'}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {RANGES.map((r, idx) => (
            <button
              key={r.label}
              type="button"
              onClick={() => setPageIdx(idx)}
              className={`px-2 py-1 rounded-lg text-[10px] font-bold tabular-nums transition-all cursor-pointer ${
                pageIdx === idx
                  ? 'bg-[#ffa800] text-[#070e1b] font-black shadow-sm'
                  : 'bg-[#0b1528] border border-[#1a2c4f] text-[#8ea4c9] hover:text-white'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* 25-Number Single-Tap Grid */}
      <div className="grid grid-cols-5 gap-1.5">
        {numbers.map((num) => {
          const taken = takenMap.get(num);
          const takenByOther = Boolean(taken && taken.playerRef !== currentPlayerRef);
          const isMine = currentTicketNumber === num;

          return (
            <button
              key={num}
              type="button"
              disabled={takenByOther}
              onClick={() => onSelectTicket(num)}
              className={`py-2 rounded-xl text-xs font-black tabular-nums transition-all flex items-center justify-center ${
                takenByOther
                  ? 'bg-[#070e1b] border border-[#142038] text-[#3f5275] cursor-not-allowed'
                  : isMine
                  ? 'bg-gradient-to-b from-[#ffb800] to-[#e69500] text-[#070e1b] border border-[#ffe08a] shadow-[0_3px_10px_rgba(255,168,0,0.4)] cursor-pointer'
                  : 'bg-[#0e1c36] hover:bg-[#162b52] active:scale-95 text-white border border-[#1b2f54] cursor-pointer'
              }`}
            >
              {takenByOther ? (
                <Lock className="w-3 h-3 text-[#465b80]" />
              ) : (
                <span>#{num}</span>
              )}
            </button>
          );
        })}
      </div>

      {errorMessage && (
        <div className="mt-2 p-2 rounded-xl bg-red-500/15 border border-red-500/40 text-red-300 text-[11px] font-bold text-center">
          {errorMessage}
        </div>
      )}
    </div>
  );
};
