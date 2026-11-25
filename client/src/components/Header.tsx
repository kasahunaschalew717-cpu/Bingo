import React, { useState } from 'react';
import { Wallet, Zap, X, PlusCircle, Check, RefreshCw, ArrowUpRight } from 'lucide-react';
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
  const [showCashModal, setShowCashModal] = useState(false);
  const [toppingUp, setToppingUp] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [topupSuccess, setTopupSuccess] = useState(false);

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

  const handleSandboxTopup = async (amountSantim: number) => {
    setToppingUp(true);
    try {
      const res = await fetch('/api/mock/topup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, amountSantim })
      });
      const data = await res.json();
      if (data.ok && onBalanceUpdated) {
        onBalanceUpdated(data.balance);
        setTopupSuccess(true);
        setTimeout(() => {
          setTopupSuccess(false);
          setShowCashModal(false);
        }, 1000);
      }
    } catch (e) {
      console.error('Sandbox topup failed:', e);
    } finally {
      setToppingUp(false);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-30 flex items-center justify-between px-4 py-3 bg-[#070e1b]/95 backdrop-blur-md border-b border-[#15233e]">
        {/* Logo Badge matching Ardi Game Zone */}
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-[#13223f] to-[#0a1324] border border-[#1e345e] shadow-inner">
            <span className="text-xl">🎱</span>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-black tracking-wider text-white">ARDI</span>
              <span className="w-1.5 h-1.5 rounded-full bg-[#00a3ff] shadow-[0_0_6px_#00a3ff]"></span>
              {mode === 'sandbox' && (
                <span className="px-1.5 py-0.2 rounded bg-amber-500/20 border border-amber-500/50 text-[8px] font-black text-amber-400 uppercase">
                  Sandbox
                </span>
              )}
            </div>
            <span className="text-[10px] font-semibold tracking-widest text-[#7e92b4] uppercase">Game Zone</span>
          </div>
        </div>

        {/* Right Section: Wallet Balance & Cash Button */}
        <div className="flex items-center gap-1.5">
          {/* Wallet Balance Pill with Live Refresh */}
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

          {/* Cash Button Pill */}
          <button
            onClick={() => setShowCashModal(true)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-gradient-to-r from-[#00b060] to-[#00c070] hover:from-[#00c070] hover:to-[#00d880] active:scale-95 transition-all text-xs font-bold text-white shadow-[0_2px_8px_rgba(0,192,112,0.3)] cursor-pointer"
          >
            <Zap className="w-3 h-3 fill-white" />
            <span>Cash</span>
          </button>

          {/* Close Game Button (ardi:close) */}
          <button
            onClick={requestCloseGame}
            title="Return to Ardi Game Zone"
            className="flex items-center justify-center w-8 h-8 rounded-full bg-[#0e1a32] border border-[#1b2f54] text-[#7e92b4] hover:text-white hover:bg-[#152749] active:scale-95 transition-all ml-0.5 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Cash / Wallet Modal */}
      {showCashModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-sm rounded-2xl bg-[#0e1a32] border border-[#1e345e] p-5 shadow-2xl text-center">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2 text-white font-bold text-base">
                <Wallet className="w-5 h-5 text-[#ffa800]" />
                <span>{playerName}</span>
              </div>
              <button
                onClick={() => setShowCashModal(false)}
                className="text-[#7e92b4] hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 mb-4 rounded-xl bg-[#08101e] border border-[#15233e]">
              <span className="text-xs text-[#7e92b4] block mb-1">Ardi ETB Wallet Balance</span>
              <div className="text-2xl font-black text-white">
                {balanceDisplay} <span className="text-[#ffa800] text-lg font-bold">ETB</span>
              </div>
              <span className="text-[11px] text-[#7e92b4]">({balanceSantim.toLocaleString()} santim)</span>
            </div>

            {mode === 'sandbox' ? (
              <>
                <p className="text-xs text-amber-300/90 mb-3 text-left font-semibold">
                  Sandbox Mode: Add test ETB credits to simulate bets and payouts.
                </p>
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {[
                    { label: '+50 ETB', santim: 5000 },
                    { label: '+100 ETB', santim: 10000 },
                    { label: '+250 ETB', santim: 25000 },
                    { label: '+500 ETB', santim: 50000 }
                  ].map((opt) => (
                    <button
                      key={opt.santim}
                      disabled={toppingUp}
                      onClick={() => handleSandboxTopup(opt.santim)}
                      className="py-2.5 px-3 rounded-xl bg-[#13223f] hover:bg-[#1a2f58] border border-[#1e3560] text-sm font-bold text-white transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <PlusCircle className="w-4 h-4 text-[#00c070]" />
                      <span>{opt.label}</span>
                    </button>
                  ))}
                </div>
                {topupSuccess && (
                  <div className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-[#00c070]/20 border border-[#00c070] text-[#00c070] text-xs font-bold">
                    <Check className="w-4 h-4" />
                    <span>Sandbox balance updated!</span>
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-[#a0b0cb] leading-relaxed">
                  Deposits and withdrawals are managed directly by your **Ardi Game Zone** wallet.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleRefreshBalance}
                    disabled={refreshing}
                    className="flex-1 py-2.5 px-3 rounded-xl bg-[#13223f] hover:bg-[#1a2f58] border border-[#1e3560] text-xs font-bold text-white flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 text-[#00a3ff] ${refreshing ? 'animate-spin' : ''}`} />
                    <span>Sync Balance</span>
                  </button>
                  <button
                    onClick={requestCloseGame}
                    className="flex-1 py-2.5 px-3 rounded-xl bg-[#00c070] hover:bg-[#00d07a] text-black text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>Ardi Wallet</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};
