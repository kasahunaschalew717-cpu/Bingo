import React from 'react';
import { ArrowRight, Users, Trophy, Clock, History, BookOpen } from 'lucide-react';
import type { RoomTierSummary } from '../types';
import { formatETB } from '../utils/currency';

interface LobbyProps {
  tiers: RoomTierSummary[];
  onSelectTier: (tierId: string) => void;
  playerBalanceSantim: number;
  onOpenHistory: () => void;
  onOpenRules: () => void;
}

export const Lobby: React.FC<LobbyProps> = ({
  tiers,
  onSelectTier,
  playerBalanceSantim,
  onOpenHistory,
  onOpenRules
}) => {
  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 pb-8 space-y-4 max-w-md mx-auto w-full">
      {/* Section Heading */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-white font-serif tracking-wide">
          Parlor Games
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenHistory}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#0e1a32] hover:bg-[#15284a] border border-[#1b2d50] text-[11px] font-bold text-[#7e92b4] hover:text-white cursor-pointer transition-colors"
          >
            <History className="w-3 h-3 text-[#00a3ff]" />
            <span>History</span>
          </button>
          <button
            onClick={onOpenRules}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#0e1a32] hover:bg-[#15284a] border border-[#1b2d50] text-[11px] font-bold text-[#ffa800] cursor-pointer transition-colors"
          >
            <BookOpen className="w-3 h-3" />
            <span>Rules</span>
          </button>
        </div>
      </div>

      {/* Quick-Match Tiers (5, 10, 25, 50, 100 ETB) */}
      <div className="space-y-2.5">
        {tiers.map((tier) => {
          const hasEnoughBalance = playerBalanceSantim >= tier.stakeSantim;
          const isPlaying = tier.status === 'PLAYING' || tier.status === 'LOCKING';
          const isCountdown = tier.status === 'COUNTDOWN';
          const potDisplay = tier.totalPot > 0 ? `${formatETB(tier.totalPot)} ETB` : 'Open Table';

          return (
            <div
              key={tier.id}
              className="group relative rounded-2xl bg-[#0e1a32] hover:bg-[#11203d] border border-[#1b2d50] hover:border-[#274278] p-3.5 transition-all duration-150 shadow-md flex items-center justify-between gap-3"
            >
              {/* Game Icon Squircle */}
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-[#162a52] to-[#0a1426] border border-[#233f75] flex items-center justify-center shadow-inner shrink-0">
                  <span className="text-2xl">🎱</span>
                  <div className="absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded-full bg-[#ffa800] text-black text-[9px] font-black">
                    {tier.stakeETB}
                  </div>
                </div>

                {/* Game Info */}
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-sm font-bold text-white font-serif tracking-tight truncate">
                      {tier.name}
                    </h3>
                    {isPlaying && (
                      <span className="px-1.5 py-0.5 rounded bg-red-500/20 border border-red-500/40 text-[9px] font-bold text-red-400 uppercase">
                        Live
                      </span>
                    )}
                    {isCountdown && (
                      <span className="px-1.5 py-0.5 rounded bg-[#00c070]/20 border border-[#00c070]/40 text-[9px] font-bold text-[#00c070] flex items-center gap-0.5">
                        <Clock className="w-2.5 h-2.5" />
                        {tier.countdown}s
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-xs text-[#7e92b4] mt-0.5">
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3 text-[#00a3ff]" />
                      <span>{tier.playerCount} / {tier.minPlayers}+</span>
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1 text-[#00c070] font-semibold">
                      <Trophy className="w-3 h-3" />
                      <span>{potDisplay}</span>
                    </span>
                  </div>

                  <span className="text-[10px] text-[#ffa800] font-semibold mt-0.5">
                    Win: Any Line • 100% Net Pot
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
    </div>
  );
};
