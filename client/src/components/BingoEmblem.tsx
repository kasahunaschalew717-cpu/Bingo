import React from 'react';
import type { Ball } from '../types';

interface TierEmblemProps {
  tierId: string;
  stakeETB: number;
}

const TIER_PALETTES: Record<string, {
  ring: string;
  bgFrom: string;
  bgTo: string;
  accent: string;
  pillBg: string;
  pillText: string;
}> = {
  tier_5: {
    ring: 'border-[#cd7f32]/50',
    bgFrom: 'from-[#281b12]',
    bgTo: 'to-[#0d1424]',
    accent: '#e09145',
    pillBg: 'bg-[#cd7f32]',
    pillText: 'text-black'
  },
  tier_10: {
    ring: 'border-[#94a3b8]/45',
    bgFrom: 'from-[#1d2b44]',
    bgTo: 'to-[#0b1324]',
    accent: '#cbd5e1',
    pillBg: 'bg-[#cbd5e1]',
    pillText: 'text-black'
  },
  tier_25: {
    ring: 'border-[#ffa800]/60',
    bgFrom: 'from-[#2d210b]',
    bgTo: 'to-[#0c1426]',
    accent: '#ffa800',
    pillBg: 'bg-[#ffa800]',
    pillText: 'text-black'
  },
  tier_50: {
    ring: 'border-[#38bdf8]/55',
    bgFrom: 'from-[#102945]',
    bgTo: 'to-[#0a1324]',
    accent: '#38bdf8',
    pillBg: 'bg-[#38bdf8]',
    pillText: 'text-black'
  },
  tier_100: {
    ring: 'border-[#a855f7]/60',
    bgFrom: 'from-[#251542]',
    bgTo: 'to-[#0b1224]',
    accent: '#c084fc',
    pillBg: 'bg-gradient-to-r from-[#a855f7] to-[#38bdf8]',
    pillText: 'text-white'
  }
};

export const TierEmblem: React.FC<TierEmblemProps> = ({ tierId, stakeETB }) => {
  const palette = TIER_PALETTES[tierId] || TIER_PALETTES.tier_25;

  return (
    <div
      className={`relative w-12 h-12 rounded-2xl bg-gradient-to-br ${palette.bgFrom} ${palette.bgTo} border ${palette.ring} flex items-center justify-center shadow-[0_4px_12px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.08)] shrink-0`}
    >
      {/* Bespoke Mini 3x3 Bingo Ticket SVG */}
      <svg viewBox="0 0 36 36" className="w-7 h-7" fill="none" aria-hidden="true">
        <rect x="4" y="4" width="28" height="28" rx="6" fill="#081121" stroke={palette.accent} strokeWidth="1.75" strokeOpacity="0.85" />
        <rect x="4" y="4" width="28" height="7" rx="4" fill={palette.accent} fillOpacity="0.22" />
        <line x1="4" y1="11" x2="32" y2="11" stroke={palette.accent} strokeWidth="1.2" strokeOpacity="0.6" />
        {/* Grid cells */}
        <circle cx="11" cy="16" r="2.2" fill={palette.accent} />
        <circle cx="18" cy="16" r="2.2" fill="#23375d" />
        <circle cx="25" cy="16" r="2.2" fill="#23375d" />

        <circle cx="11" cy="22" r="2.2" fill="#23375d" />
        <circle cx="18" cy="22" r="2.6" fill={palette.accent} />
        <circle cx="25" cy="22" r="2.2" fill="#23375d" />

        <circle cx="11" cy="28" r="2.2" fill="#23375d" />
        <circle cx="18" cy="28" r="2.2" fill="#23375d" />
        <circle cx="25" cy="28" r="2.2" fill={palette.accent} />
      </svg>

      {/* Stake Pill Badge */}
      <div
        className={`absolute -bottom-1.5 -right-1.5 px-1.5 py-0.5 rounded-md ${palette.pillBg} ${palette.pillText} text-[10px] font-black leading-none shadow-[0_2px_6px_rgba(0,0,0,0.6)] border border-[#070e1b]`}
      >
        {stakeETB}
      </div>
    </div>
  );
};

export const BALL_LETTER_STYLES: Record<
  Ball['letter'],
  { gradient: string; ring: string; badge: string; text: string }
> = {
  B: {
    gradient: 'from-[#ef4444] via-[#dc2626] to-[#7f1d1d]',
    ring: 'border-[#fca5a5]/50',
    badge: 'bg-[#ef4444]',
    text: 'text-[#ef4444]'
  },
  I: {
    gradient: 'from-[#ffb800] via-[#e68a00] to-[#92400e]',
    ring: 'border-[#fde68a]/50',
    badge: 'bg-[#ffa800]',
    text: 'text-[#ffa800]'
  },
  N: {
    gradient: 'from-[#38bdf8] via-[#0284c7] to-[#0c4a6e]',
    ring: 'border-[#bae6fd]/50',
    badge: 'bg-[#00a3ff]',
    text: 'text-[#00a3ff]'
  },
  G: {
    gradient: 'from-[#10b981] via-[#059669] to-[#064e3b]',
    ring: 'border-[#a7f3d0]/50',
    badge: 'bg-[#00c070]',
    text: 'text-[#00c070]'
  },
  O: {
    gradient: 'from-[#a855f7] via-[#7e22ce] to-[#3b0764]',
    ring: 'border-[#e9d5ff]/50',
    badge: 'bg-[#a855f7]',
    text: 'text-[#a855f7]'
  }
};

export const BingoBall3D: React.FC<{ ball: Ball | null; size?: 'lg' | 'sm' }> = ({ ball, size = 'lg' }) => {
  if (!ball) {
    return (
      <div className="w-16 h-16 rounded-full bg-[#091326] border-2 border-dashed border-[#1e355e] flex items-center justify-center text-xs font-bold text-[#526a91] shrink-0">
        --
      </div>
    );
  }

  const style = BALL_LETTER_STYLES[ball.letter];

  if (size === 'sm') {
    return (
      <div
        className={`relative w-10 h-10 rounded-full bg-gradient-to-br ${style.gradient} p-0.5 shadow-[0_3px_8px_rgba(0,0,0,0.45)] flex items-center justify-center shrink-0`}
      >
        <div className="w-full h-full rounded-full bg-[#0a1324]/92 flex flex-col items-center justify-center border border-white/10">
          <span className={`text-[8px] font-black leading-none ${style.text}`}>{ball.letter}</span>
          <span className="text-xs font-black text-white leading-tight tabular-nums">{ball.number}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      key={`${ball.letter}-${ball.number}`}
      className={`animate-ball relative w-16 h-16 rounded-full bg-gradient-to-br ${style.gradient} p-1 shadow-[0_6px_18px_rgba(0,0,0,0.55)] border ${style.ring} flex items-center justify-center shrink-0`}
    >
      {/* Top specular gloss */}
      <div className="absolute top-1.5 left-3 w-4 h-2 rounded-full bg-white/30 blur-[1px] pointer-events-none"></div>

      <div className="w-full h-full rounded-full bg-gradient-to-b from-[#131d33] to-[#070e1b] flex flex-col items-center justify-center border border-white/15 shadow-inner">
        <span className={`text-[10px] font-black tracking-wider leading-none ${style.text}`}>
          {ball.letter}
        </span>
        <span className="text-[22px] font-black text-white leading-none tabular-nums mt-0.5">
          {ball.number}
        </span>
      </div>
    </div>
  );
};
