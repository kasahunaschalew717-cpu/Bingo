import React, { useState, useEffect } from 'react';
import { X, Lock, Check, Ticket, Star } from 'lucide-react';
import type { BingoCard, TakenTicket } from '../types';

interface TicketPickerModalProps {
  poolSize: number;
  currentTicketNumber: number | null;
  currentPlayerRef: string;
  takenTickets: TakenTicket[];
  previewCard: BingoCard | null;
  previewTakenBy: string | null;
  errorMessage: string | null;
  onPreviewTicket: (ticketNumber: number) => void;
  onConfirmTicket: (ticketNumber: number) => void;
  onClose: () => void;
}

const RANGES = [
  { label: '1–25', start: 1, end: 25 },
  { label: '26–50', start: 26, end: 50 },
  { label: '51–75', start: 51, end: 75 },
  { label: '76–100', start: 76, end: 100 }
];

export const TicketPickerModal: React.FC<TicketPickerModalProps> = ({
  poolSize = 100,
  currentTicketNumber,
  currentPlayerRef,
  takenTickets,
  previewCard,
  previewTakenBy,
  errorMessage,
  onPreviewTicket,
  onConfirmTicket,
  onClose
}) => {
  const initialPage = currentTicketNumber ? Math.floor((currentTicketNumber - 1) / 25) : 0;
  const [pageIdx, setPageIdx] = useState(Math.min(Math.max(initialPage, 0), RANGES.length - 1));
  const [selectedNum, setSelectedNum] = useState<number>(currentTicketNumber || 1);

  useEffect(() => {
    if (selectedNum) {
      onPreviewTicket(selectedNum);
    }
  }, [selectedNum]);

  const takenMap = new Map<number, TakenTicket>();
  takenTickets.forEach((t) => takenMap.set(t.ticketNumber, t));

  const activeRange = RANGES[pageIdx];
  const numbers: number[] = [];
  for (let n = activeRange.start; n <= Math.min(activeRange.end, poolSize); n++) {
    numbers.push(n);
  }

  const selectedTakenInfo = takenMap.get(selectedNum);
  const isTakenByOther = Boolean(
    selectedTakenInfo && selectedTakenInfo.playerRef !== currentPlayerRef
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-sm rounded-3xl bg-[#0a1324] border border-[#1b2f54] p-4 shadow-2xl flex flex-col max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Ticket className="w-5 h-5 text-[#ffa800]" />
            <h3 className="text-base font-black text-white font-serif">Select Your Ticket</h3>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-[#13223f] flex items-center justify-center text-[#7e92b4] hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Range Tabs */}
        <div className="grid grid-cols-4 gap-1.5 mb-3">
          {RANGES.map((r, idx) => (
            <button
              key={r.label}
              onClick={() => setPageIdx(idx)}
              className={`py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                pageIdx === idx
                  ? 'bg-[#ffa800] text-black font-black shadow-sm'
                  : 'bg-[#0e1a32] border border-[#1b2d50] text-[#7e92b4] hover:text-white'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        {/* 25-Number Ticket Grid */}
        <div className="grid grid-cols-5 gap-1.5 mb-3">
          {numbers.map((num) => {
            const taken = takenMap.get(num);
            const takenByOther = Boolean(taken && taken.playerRef !== currentPlayerRef);
            const isMine = currentTicketNumber === num;
            const isFocused = selectedNum === num;

            return (
              <button
                key={num}
                disabled={takenByOther}
                onClick={() => setSelectedNum(num)}
                className={`relative py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-0.5 ${
                  takenByOther
                    ? 'bg-[#08101e] border border-[#15223b] text-[#3f5275] cursor-not-allowed'
                    : isFocused
                    ? 'bg-[#ffa800] text-black border-2 border-white shadow-[0_0_10px_rgba(255,168,0,0.6)] cursor-pointer'
                    : isMine
                    ? 'bg-[#1a3360] text-[#ffa800] border border-[#ffa800] cursor-pointer'
                    : 'bg-[#0e1a32] hover:bg-[#15284a] text-white border border-[#1b2d50] cursor-pointer'
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

        {/* Legend */}
        <div className="flex items-center justify-center gap-4 text-[10px] text-[#7e92b4] mb-3">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded bg-[#ffa800]"></span> Selected
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded bg-[#0e1a32] border border-[#1b2d50]"></span> Available
          </span>
          <span className="flex items-center gap-1">
            <Lock className="w-2.5 h-2.5 text-[#465b80]" /> Taken
          </span>
        </div>

        {/* Live 5x5 Preview of Selected Ticket */}
        {previewCard && previewCard.ticketNumber === selectedNum && (
          <div className="rounded-2xl bg-[#070e1b] border border-[#16294a] p-2.5 mb-3">
            <div className="flex items-center justify-between mb-1.5 px-1">
              <span className="text-[11px] font-bold text-white">
                Preview <span className="text-[#ffa800]">#{selectedNum}</span>
              </span>
              {previewTakenBy && (
                <span className="text-[10px] font-bold text-red-400">Taken by {previewTakenBy}</span>
              )}
            </div>

            <div className="grid grid-cols-5 gap-1 mb-1 text-center text-[10px] font-black">
              <span className="text-[#ef4444]">B</span>
              <span className="text-[#ffa800]">I</span>
              <span className="text-[#00a3ff]">N</span>
              <span className="text-[#00c070]">G</span>
              <span className="text-[#a855f7]">O</span>
            </div>

            <div className="grid grid-cols-5 gap-1">
              {previewCard.cells.map((c) => (
                <div
                  key={c.index}
                  className={`py-1.5 rounded-lg text-center text-xs font-bold flex items-center justify-center ${
                    c.isFree
                      ? 'bg-[#1a2b4c] text-[#ffa800]'
                      : 'bg-[#0e1a32] text-white/90 border border-[#17284a]'
                  }`}
                >
                  {c.isFree ? <Star className="w-3 h-3 fill-[#ffa800]" /> : c.number}
                </div>
              ))}
            </div>
          </div>
        )}

        {errorMessage && (
          <div className="mb-2 p-2 rounded-xl bg-red-500/15 border border-red-500/40 text-red-300 text-xs font-bold text-center">
            {errorMessage}
          </div>
        )}

        {/* Confirm Button */}
        <button
          disabled={isTakenByOther}
          onClick={() => onConfirmTicket(selectedNum)}
          className={`w-full py-3 rounded-2xl font-black text-xs tracking-wider uppercase flex items-center justify-center gap-1.5 transition-all ${
            isTakenByOther
              ? 'bg-[#15233e] text-[#4d6387] cursor-not-allowed'
              : 'bg-[#ffa800] hover:bg-[#ffb820] active:scale-95 text-black shadow-lg cursor-pointer'
          }`}
        >
          <Check className="w-4 h-4 stroke-[3]" />
          <span>{isTakenByOther ? `Ticket #${selectedNum} Taken` : `Confirm Ticket #${selectedNum}`}</span>
        </button>
      </div>
    </div>
  );
};
