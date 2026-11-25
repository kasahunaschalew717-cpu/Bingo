import React from 'react';
import { User, ShieldCheck, BookOpen, LogOut } from 'lucide-react';
import type { SessionData } from '../types';
import { requestCloseGame } from '../services/postMessageBridge';

interface ProfileTabProps {
  session: SessionData;
}

export const ProfileTab: React.FC<ProfileTabProps> = ({ session }) => {
  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 pb-24 space-y-4 max-w-md mx-auto w-full">
      {/* Player Identity Card */}
      <div className="rounded-2xl bg-[#0e1a32] border border-[#1b2d50] p-4 shadow-md flex items-center gap-3.5">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#ffb800] to-[#e68a00] flex items-center justify-center text-black shrink-0 shadow-lg">
          <User className="w-7 h-7 stroke-[2.5]" />
        </div>
        <div className="min-w-0">
          <h2 className="text-base font-black text-white truncate">{session.player.name}</h2>
          <p className="text-[11px] text-[#7e92b4] font-mono truncate">
            ID: {session.player.ref}
          </p>
          <div className="flex items-center gap-1.5 mt-1">
            <ShieldCheck className="w-3.5 h-3.5 text-[#00c070]" />
            <span className="text-[11px] font-semibold text-[#00c070]">
              {session.mode === 'sandbox' ? 'Sandbox Session' : 'Verified Ardi Session'}
            </span>
          </div>
        </div>
      </div>

      {/* Rules Card */}
      <div className="rounded-2xl bg-[#0e1a32] border border-[#1b2d50] p-4 space-y-2.5">
        <div className="flex items-center gap-2 text-sm font-bold text-white font-serif">
          <BookOpen className="w-4 h-4 text-[#ffa800]" />
          <span>Ethiopian Parlor Bingo Rules</span>
        </div>

        <ul className="space-y-2 text-xs text-[#a0b0cb] leading-relaxed list-disc pl-4">
          <li>
            <strong className="text-white">75-Ball Grid:</strong> Cards have 24 numbers across columns B (1–15), I (16–30), N (31–45), G (46–60), O (61–75) plus a center <strong className="text-[#ffa800]">FREE</strong> space.
          </li>
          <li>
            <strong className="text-white">Win Condition — Any Line:</strong> Complete any 5 numbers in a horizontal row, vertical column, or diagonal and tap <strong className="text-[#ffa800]">BINGO!</strong>.
          </li>
          <li>
            <strong className="text-white">100% Net Pot Payout:</strong> The first player to claim a valid line wins the entire net prize pot, credited directly to their Ardi ETB wallet.
          </li>
          <li>
            <strong className="text-white">Refund Protection:</strong> If a round aborts before lock or draws all 75 balls without a claim, all bets are automatically refunded in full.
          </li>
        </ul>
      </div>

      {/* Return to Ardi Host App */}
      <button
        onClick={requestCloseGame}
        className="w-full py-3.5 rounded-2xl bg-[#13223f] hover:bg-[#1a2f58] border border-[#1e3560] text-sm font-bold text-white flex items-center justify-center gap-2 cursor-pointer active:scale-95 transition-all"
      >
        <LogOut className="w-4 h-4 text-[#ffa800]" />
        <span>Return to Ardi Game Zone</span>
      </button>
    </div>
  );
};
