import React from 'react';
import { Clock, History, BookOpen } from 'lucide-react';
import type { RoomTierSummary } from '../types';
import { formatETB } from '../utils/currency';
import { formatCountdown } from '../utils/time';
import { TierEmblem } from './BingoEmblem';
import { sound } from '../services/sound';

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
    <div className="flex-1 overflow-y-auto px-4 py-4 pb-8 space-y-3.5 max-w-md mx-auto w-full">
      {/* Section Heading */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white font-serif tracking-wide leading-tight">
          Parlor Games
        </h1>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={onOpenHistory}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#0e1a32] hover:bg-[#15284a] border border-[#1b2d50] text-[11px] font-bold text-[#8ea4c9] hover:text-white cursor-pointer transition-colors"
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
          const shortTitle = tier.name.replace(/\s+Parlor$/i, '');

          return (
            <div
              key={tier.id}
              onClick={() => {
                sound.unlockAudio();
                onSelectTier(tier.id);
              }}
              className="rounded-2xl bg-[#111b2e] hover:bg-[#15223a] border border-[#1e2e4d] hover:border-[#2a426e] px-3.5 py-3 transition-all duration-150 flex items-center justify-between gap-3 cursor-pointer"
            >
              {/* Left: 2x2 Grid Emblem + Tier Label & Dot Status */}
              <div className="flex items-center gap-3.5 flex-1 min-w-0">
                <TierEmblem tierId={tier.id} />

                <div className="flex flex-col min-w-0 flex-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <h3 className="text-[15px] font-bold text-white tracking-tight truncate">
                      {shortTitle}
                    </h3>
                    {isPlaying && (
                      <span className="px-1.5 py-0.5 rounded bg-red-500/20 border border-red-500/40 text-[9px] font-bold text-red-400 uppercase tracking-wider shrink-0">
                        Live
                      </span>
                    )}
                    {isCountdown && (
                      <span className="px-1.5 py-0.5 rounded bg-[#00c070]/20 border border-[#00c070]/40 text-[9px] font-bold text-[#00c070] flex items-center gap-0.5 tabular-nums shrink-0">
                        <Clock className="w-2.5 h-2.5" />
                        {formatCountdown(tier.countdown)}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-[#8ea4c9] mt-0.5 tabular-nums whitespace-nowrap">
                    <span className="w-2 h-2 rounded-full bg-[#22c55e] shrink-0"></span>
                    <span>{tier.playerCount}/{tier.minPlayers}+</span>
                    {tier.totalPot > 0 && (
                      <>
                        <span className="text-[#364e78]">•</span>
                        <span className="text-[#00c070] font-semibold">
                          {formatETB(tier.totalPot)} ETB
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Right: Solid Amber Pill */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  sound.unlockAudio();
                  onSelectTier(tier.id);
                }}
                className={`min-w-[82px] px-4 py-2 rounded-full font-extrabold text-xs tracking-wide transition-all duration-150 text-center shrink-0 whitespace-nowrap cursor-pointer ${
                  hasEnoughBalance
                    ? 'bg-[#f5a623] hover:bg-[#ffb636] active:scale-95 text-[#070e1b]'
                    : 'bg-[#1a2947] border border-[#283d66] text-[#8ea4c9] hover:text-white'
                }`}
              >
                <span className="tabular-nums">{tier.stakeETB} ETB</span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
