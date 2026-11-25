import React, { useState } from 'react';
import { Wallet, X, RefreshCw, User } from 'lucide-react';
import { requestCloseGame, notifyParentBalanceChange } from '../services/postMessageBridge';
import { formatETB } from '../utils/currency';

interface HeaderProps {
  balanceSantim: number;
  token: string;
  playerName?: string;
  mode?: 'production' | 'sandbox';
  onBalanceUpdated?: (newBalance: number) => void;
}

export const Header: React.FC<HeaderProps> = ({
  balanceSantim,
  token,
  playerName = 'Player',
  mode = 'production',
  onBalanceUpdated
}) => {
  const [refreshing, setRefreshing] = useState(false);

  const balanceDisplay = formatETB(balanceSantim);

  const handleRefreshBalance = async () => {
    if (!token || refreshing) return;
    setRefreshing(true);
    try {
      const res = await fetch('/api/auth/balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });
      const data = await res.json();
      if (data.ok && onBalanceUpdated) {
        onBalanceUpdated(data.balance);
        notifyParentBalanceChange();
      }
    } catch (e) {
      console.error('Balance refresh failed:', e);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between px-4 py-2.5 bg-[#070e1b]/95 backdrop-blur-md border-b border-[#15233e]">
      {/* Left: Compact Player Pill */}
      <div className="flex items-center gap-2 min-w-0">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#0e1a32] border border-[#1b2f54] text-xs font-bold text-[#a0b0cb] truncate">
          <User className="w-3.5 h-3.5 text-[#00a3ff] shrink-0" />
          <span className="truncate text-white">{playerName}</span>
        </div>
        {mode === 'sandbox' && (
          <span className="px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/50 text-[9px] font-black text-amber-400 uppercase shrink-0">
            Sandbox
          </span>
        )}
      </div>

      {/* Right: Wallet Balance Pill & Exit */}
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={handleRefreshBalance}
          title="Sync Balance"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#0e1a32] border border-[#1b2f54] hover:border-[#2a4980] text-xs font-bold text-white shadow-sm cursor-pointer active:scale-95 transition-all"
        >
          <Wallet className="w-3.5 h-3.5 text-[#ffa800]" />
          <span className="text-white font-extrabold">{balanceDisplay}</span>
          <span className="text-[#ffa800] text-[11px] font-semibold">ETB</span>
          <RefreshCw className={`w-2.5 h-2.5 text-[#7e92b4] ${refreshing ? 'animate-spin text-[#00a3ff]' : ''}`} />
        </button>

        <button
          onClick={requestCloseGame}
          title="Exit Game"
          className="flex items-center justify-center w-8 h-8 rounded-full bg-[#0e1a32] border border-[#1b2f54] text-[#7e92b4] hover:text-white hover:bg-[#152749] active:scale-95 transition-all cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
