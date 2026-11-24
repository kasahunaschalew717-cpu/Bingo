import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Trophy, Sparkles, CheckCircle2 } from 'lucide-react';
import type { WinnerInfo } from '../types';
import { sound } from '../services/sound';
import { notifyParentBalanceChange } from '../services/postMessageBridge';

interface WinnerModalProps {
  winner: WinnerInfo;
  isCurrentUser: boolean;
  onClose: () => void;
}

export const WinnerModal: React.FC<WinnerModalProps> = ({
  winner,
  isCurrentUser,
  onClose
}) => {
  useEffect(() => {
    sound.playWin();
    notifyParentBalanceChange();

    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 }
      });
      setTimeout(() => {
        confetti({
          particleCount: 50,
          angle: 60,
          spread: 55,
          origin: { x: 0 }
        });
        confetti({
          particleCount: 50,
          angle: 120,
          spread: 55,
          origin: { x: 1 }
        });
      }, 250);
    } catch {
      // Confetti fallback
    }
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-sm rounded-3xl bg-gradient-to-b from-[#132342] to-[#0a1426] border-2 border-[#ffa800] p-6 shadow-[0_0_40px_rgba(255,168,0,0.4)] text-center">
        {/* Glowing Trophy Icon */}
        <div className="w-20 h-20 mx-auto -mt-12 rounded-full bg-gradient-to-b from-[#ffb800] to-[#e68a00] p-1 shadow-[0_0_24px_rgba(255,168,0,0.7)] flex items-center justify-center">
          <div className="w-full h-full rounded-full bg-[#0a1426] flex items-center justify-center">
            <Trophy className="w-10 h-10 text-[#ffa800] animate-bounce" />
          </div>
        </div>

        <div className="mt-4 space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#ffa800]/20 border border-[#ffa800]/50 text-[#ffa800] text-xs font-black tracking-wider uppercase">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{winner.pattern}</span>
          </div>

          <h2 className="text-2xl font-black text-white font-serif mt-2">
            {isCurrentUser ? '🎉 YOU WON!' : '🏆 BINGO WINNER!'}
          </h2>

          <p className="text-sm font-bold text-[#7e92b4]">
            {winner.name} {isCurrentUser && '(You)'}
          </p>
        </div>

        {/* Prize Box */}
        <div className="my-5 p-4 rounded-2xl bg-[#070e1b] border border-[#1b2f54] shadow-inner">
          <span className="text-xs text-[#7e92b4] font-semibold block mb-1">Prize Payout</span>
          <div className="text-3xl font-black text-[#00c070] drop-shadow-[0_2px_8px_rgba(0,192,112,0.5)]">
            +{winner.prizeETB} <span className="text-lg font-bold text-white">ETB</span>
          </div>
          <span className="text-[11px] text-[#7e92b4]">({winner.prizeSantim.toLocaleString()} santim credited to wallet)</span>
        </div>

        <div className="flex items-center justify-center gap-1.5 text-xs text-[#00c070] font-semibold mb-5">
          <CheckCircle2 className="w-4 h-4" />
          <span>Synced with Ardi Game Zone Wallet</span>
        </div>

        <button
          onClick={onClose}
          className="w-full py-3 rounded-2xl bg-[#ffa800] hover:bg-[#ffb820] active:scale-95 text-black font-black text-sm tracking-wider uppercase transition-all shadow-lg cursor-pointer"
        >
          Next Round
        </button>
      </div>
    </div>
  );
};
