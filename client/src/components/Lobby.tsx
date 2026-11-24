import React, { useState } from 'react';
import { Lock, ArrowRight, Sparkles, Users, Trophy } from 'lucide-react';
import type { RoomTierSummary } from '../types';

interface LobbyProps {
  tiers: RoomTierSummary[];
  onSelectTier: (tierId: string) => void;
  playerBalanceSantim: number;
}

export const Lobby: React.FC<LobbyProps> = ({
  tiers,
  onSelectTier,
  playerBalanceSantim
}) => {
  const [roomCode, setRoomCode] = useState('');
  const [codeError, setCodeError] = useState('');

  const handleJoinByCode = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = roomCode.trim().toUpperCase();
    if (!cleanCode) {
      setCodeError('Please enter a room code');
      return;
    }
    setCodeError('');
    onSelectTier('tier_10');
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 pb-24 space-y-4 max-w-md mx-auto w-full">
      {/* 1. Top Bonus Banner (Matching Sample) */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#0047b3] via-[#092654] to-[#0a152e] border border-[#163a75] p-4 text-white shadow-lg">
        {/* Decorative graphic glow */}
        <div className="absolute -top-10 -right-10 w-36 h-36 bg-[#00a3ff]/20 rounded-full blur-2xl pointer-events-none"></div>

        <div className="relative z-10 flex justify-between items-center">
          <div className="space-y-1 max-w-[65%]">
            <h2 className="text-lg font-bold text-white tracking-wide">Invite</h2>
            <p className="text-xs font-medium text-slate-200">
              Invite Your Friends and get 5 ETB.
            </p>
            <p className="text-[11px] text-[#7ea9f5] font-normal leading-tight">
              ጓደኞችዎን በመጋበዝ በ 1 ሰው 5 ETB ቦነስ ያግኙ።
            </p>

            <div className="pt-2">
              <button
                onClick={() => alert('Invite link copied! Share with friends to get 5 ETB bonus.')}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#00a3ff] hover:bg-[#20b2ff] text-white text-xs font-bold shadow-[0_2px_10px_rgba(0,163,255,0.4)] active:scale-95 transition-all cursor-pointer"
              >
                <span>Invite friends</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Extra Bonus Badge (from sample) */}
          <div className="flex flex-col items-center justify-center transform rotate-6 animate-pulse select-none">
            <div className="text-[13px] font-black tracking-widest text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
              EXTRA
            </div>
            <div className="text-xl font-black text-[#ffa800] tracking-tighter drop-shadow-[0_2px_8px_rgba(255,168,0,0.8)]">
              BONUS
            </div>
            <Sparkles className="w-5 h-5 text-yellow-300 mt-0.5" />
          </div>
        </div>
      </div>

      {/* 2. Section Heading */}
      <div className="flex items-center justify-between pt-1">
        <h1 className="text-lg font-bold text-white font-serif tracking-wide">
          Parlor Games
        </h1>
        <span className="text-xs font-bold text-[#ffa800] tracking-wider uppercase">
          Quick Match
        </span>
      </div>

      {/* 3. Quick-Match Tiers (5, 10, 25, 50, 100 ETB) */}
      <div className="space-y-2.5">
        {tiers.map((tier) => {
          const hasEnoughBalance = playerBalanceSantim >= tier.stakeSantim;
          const potETB = tier.totalPot > 0 ? (tier.totalPot / 100).toFixed(0) : (tier.stakeETB * 4).toFixed(0);

          return (
            <div
              key={tier.id}
              className="group relative rounded-2xl bg-[#0e1a32] hover:bg-[#11203d] border border-[#1b2d50] hover:border-[#274278] p-3.5 transition-all duration-150 shadow-md flex items-center justify-between gap-3"
            >
              {/* Game Icon Squircle */}
              <div className="flex items-center gap-3">
                <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-[#162a52] to-[#0a1426] border border-[#233f75] flex items-center justify-center shadow-inner shrink-0">
                  <span className="text-2xl">🎱</span>
                  <div className="absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded-full bg-[#ffa800] text-black text-[9px] font-black">
                    {tier.stakeETB}
                  </div>
                </div>

                {/* Game Info */}
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-sm font-bold text-white font-serif tracking-tight">
                      {tier.name}
                    </h3>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[#7e92b4] mt-0.5">
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3 text-[#00a3ff]" />
                      <span>{tier.playerCount || 3} Players</span>
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1 text-[#00c070]">
                      <Trophy className="w-3 h-3" />
                      <span>Pot ~{potETB} ETB</span>
                    </span>
                  </div>
                  <span className="text-[10px] text-[#ffa800] font-semibold mt-0.5">
                    Win Condition: Any Line (100% Pot)
                  </span>
                </div>
              </div>

              {/* Action Button: Amber Pill matching sample */}
              <div className="flex flex-col items-end gap-1 shrink-0">
                <button
                  onClick={() => onSelectTier(tier.id)}
                  className={`px-3.5 py-2 rounded-full font-black text-xs tracking-wider transition-all duration-150 flex items-center gap-1 shadow-md cursor-pointer ${
                    hasEnoughBalance
                      ? 'bg-[#ffa800] hover:bg-[#ffb820] active:scale-95 text-black hover:shadow-[0_0_12px_rgba(255,168,0,0.5)]'
                      : 'bg-[#1e2e4e] text-[#7e92b4] hover:text-white'
                  }`}
                >
                  <span>{tier.stakeETB} ETB</span>
                  <ArrowRight className="w-3 h-3 stroke-[3]" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* 4. Room Code Join Bar (Matching Sample) */}
      <div className="pt-2">
        <form
          onSubmit={handleJoinByCode}
          className="flex items-center gap-2 p-1.5 rounded-2xl bg-[#0e1a32] border border-[#1b2d50] shadow-md"
        >
          <div className="flex items-center gap-2 px-3 py-1.5 flex-1">
            <Lock className="w-4 h-4 text-[#7e92b4] shrink-0" />
            <input
              type="text"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              placeholder="ENTER ROOM CODE (E.G. 7K2M9X)"
              maxLength={8}
              className="w-full bg-transparent text-white placeholder-[#4e648a] text-xs font-bold tracking-wider uppercase focus:outline-none"
            />
          </div>
          <button
            type="submit"
            className="px-5 py-2.5 rounded-xl bg-[#ffa800] hover:bg-[#ffb820] active:scale-95 text-black font-black text-xs tracking-wider transition-all shadow-[0_2px_6px_rgba(255,168,0,0.3)] cursor-pointer shrink-0"
          >
            Join
          </button>
        </form>
        {codeError && (
          <p className="text-[11px] text-red-400 mt-1 px-3 font-semibold">{codeError}</p>
        )}
      </div>
    </div>
  );
};
