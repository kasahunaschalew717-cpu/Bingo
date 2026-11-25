import React from 'react';
import { ArrowRight, Users, Trophy, Clock, History, BookOpen } from 'lucide-react';
import type { RoomTierSummary } from '../types';
import { formatETB } from '../utils/currency';
import { TierEmblem } from './BingoEmblem';

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
        <h1 className="text-xl font-bold text-white font-serif tracking-wide">
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
      <div className="space-y-3">
        {tiers.map((tier) => {
          const hasEnoughBalance = playerBalanceSantim >= tier.stakeSantim;
          const isPlaying = tier.status === 'PLAYING' || tier.status === 'LOCKING';
          const isCountdown = tier.status === 'COUNTDOWN';
          const potDisplay = tier.totalPot > 0 ? `${formatETB(tier.totalPot)} ETB` : 'Open Table';

          return (
            <div
              key={tier.id}
              onClick={() => onSelectTier(tier.id)}
              className="group relative rounded-2xl bg-gradient-to-br from-[#101e38] to-[#0b1528] hover:from-[#132442] hover:to-[#0d1930] border border-[#1c3057] hover:border-[#2c4b85] p-3.5 transition-all duration-150 shadow-[0_6px_18px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.05)] flex items-center justify-between gap-3 cursor-pointer"
            >
              {/* Tier SVG Emblem + Info */}
              <div className="flex items-center gap-3.5 min-w-0">
                <TierEmblem tierId={tier.id} stakeETB={tier.stakeETB} />

                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-[15px] font-bold text-white font-serif tracking-tight truncate">
                      {tier.name}
                    </h3>
                    {isPlaying && (
                      <span className="px-1.5 py-0.5 rounded bg-red-500/20 border border-red-500/40 text-[9px] font-bold text-red-400 uppercase tracking-wider">
                        Live
                      </span>
                    )}
                    {isCountdown && (
                      <span className="px-1.5 py-0.5 rounded bg-[#00c070]/20 border border-[#00c070]/40 text-[9px] font-bold text-[#00c070] flex items-center gap-0.5 tabular-nums">
                        <Clock className="w-2.5 h-2.5" />
                        {tier.countdown}s
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-xs text-[#8ea4c9] mt-0.5 tabular-nums">
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3 text-[#00a3ff]" />
                      <span>{tier.playerCount} / {tier.minPlayers}+</span>
                    </span>
                    <span className="text-[#2c436e]">•</span>
                    <span className="flex items-center gap-1 text-[#00c070] font-semibold">
                      <Trophy className="w-3 h-3" />
                      <span>{potDisplay}</span>
                    </span>
                  </div>

                  <span className="text-[10px] text-[#ffa800] font-semibold mt-0.5 tracking-wide">
                    Any Line • 100% Net Pot
                  </span>
                </div>
              </div>

              {/* Action Button: Ardi Amber Pill */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectTier(tier.id);
                }}
                className={`px-3.5 py-2 rounded-full font-black text-xs tracking-wider transition-all duration-150 flex items-center gap-1 shrink-0 cursor-pointer ${
                  hasEnoughBalance
                    ? 'bg-gradient-to-b from-[#ffb800] to-[#e69500] hover:from-[#ffc629] hover:to-[#ffa800] active:scale-95 text-[#070e1b] shadow-[0_4px_12px_rgba(255,168,0,0.3)]'
                    : 'bg-[#1a2947] border border-[#283d66] text-[#8ea4c9] hover:text-white'
                }`}
              >
                <span className="tabular-nums">{tier.stakeETB} ETB</span>
                <ArrowRight className="w-3.5 h-3.5 stroke-[2.75]" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
