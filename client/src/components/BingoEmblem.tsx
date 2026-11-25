import React from 'react';
import type { Ball } from '../types';

interface TierEmblemProps {
  tierId: string;
}

const TIER_PALETTES: Record<string, {
  containerBg: string;
  primary: string;
  secondary: string;
}> = {
  tier_5: {
    containerBg: 'bg-[#2a2121]',
    primary: '#d97742',
    secondary: '#6e6563'
  },
  tier_10: {
    containerBg: 'bg-[#252b3b]',
    primary: '#e2e8f0',
    secondary: '#64748b'
  },
  tier_25: {
    containerBg: 'bg-[#29231c]',
    primary: '#f5b027',
    secondary: '#786c57'
  },
  tier_50: {
    containerBg: 'bg-[#17283d]',
    primary: '#38bdf8',
    secondary: '#4c6785'
  },
  tier_100: {
    containerBg: 'bg-[#23203b]',
    primary: '#a78bfa',
    secondary: '#5b5685'
  }
};

export const TierEmblem: React.FC<TierEmblemProps> = ({ tierId }) => {
  const palette = TIER_PALETTES[tierId] || TIER_PALETTES.tier_25;

  return (
    <div
      className={`w-11 h-11 rounded-xl ${palette.containerBg} flex items-center justify-center shrink-0`}
    >
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" aria-hidden="true">
        <rect x="3" y="3" width="7.5" height="7.5" rx="2" fill={palette.primary} />
        <rect x="13.5" y="3" width="7.5" height="7.5" rx="2" fill={palette.secondary} />
        <rect x="3" y="13.5" width="7.5" height="7.5" rx="2" fill={palette.secondary} />
        <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2" fill={palette.primary} />
      </svg>
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
