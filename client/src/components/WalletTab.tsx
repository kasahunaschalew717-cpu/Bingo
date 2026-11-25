import React, { useState, useEffect } from 'react';
import { Wallet, ArrowDownLeft, ArrowUpRight, RotateCcw, RefreshCw, ArrowLeft } from 'lucide-react';
import type { TransactionRecord } from '../types';
import { formatETB } from '../utils/currency';
import { notifyParentBalanceChange } from '../services/postMessageBridge';

interface WalletTabProps {
  token: string;
  balanceSantim: number;
  onBalanceUpdated: (newBalance: number) => void;
  onBack: () => void;
}

export const WalletTab: React.FC<WalletTabProps> = ({
  token,
  balanceSantim,
  onBalanceUpdated,
  onBack
}) => {
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadHistory = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });
      const data = await res.json();
      if (data.ok) {
        setTransactions(data.transactions || []);
      }
    } catch (e) {
      console.error('Failed to load history:', e);
    } finally {
      setLoading(false);
    }
  };

  const syncBalance = async () => {
    setRefreshing(true);
    try {
      const res = await fetch('/api/auth/balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });
      const data = await res.json();
      if (data.ok) {
        onBalanceUpdated(data.balance);
        notifyParentBalanceChange();
      }
      await loadHistory();
    } catch (e) {
      console.error('Sync balance error:', e);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, [token]);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 pb-8 space-y-4 max-w-md mx-auto w-full">
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0e1a32] border border-[#1b2f54] text-xs font-bold text-[#7e92b4] hover:text-white cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Parlors</span>
        </button>
      </div>

      {/* Wallet Summary Card */}
      <div className="rounded-2xl bg-gradient-to-br from-[#0e1e3d] to-[#0a1426] border border-[#1b2f54] p-4 shadow-lg">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-xs font-bold text-[#7e92b4] uppercase tracking-wider">
            <Wallet className="w-4 h-4 text-[#ffa800]" />
            <span>Ardi ETB Wallet</span>
          </div>
          <button
            onClick={syncBalance}
            disabled={refreshing}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#13223f] hover:bg-[#1a2f58] border border-[#1e3560] text-[11px] font-bold text-white cursor-pointer"
          >
            <RefreshCw className={`w-3 h-3 text-[#00a3ff] ${refreshing ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>
        </div>

        <div className="text-3xl font-black text-white">
          {formatETB(balanceSantim)} <span className="text-lg text-[#ffa800] font-bold">ETB</span>
        </div>
      </div>

      {/* Transaction History */}
      <div className="space-y-2">
        <h2 className="text-sm font-bold text-white font-serif tracking-wide">
          Transactions
        </h2>

        {loading ? (
          <div className="rounded-2xl bg-[#0e1a32] border border-[#1b2d50] p-6 text-center text-xs text-[#7e92b4]">
            Loading...
          </div>
        ) : transactions.length === 0 ? (
          <div className="rounded-2xl bg-[#0e1a32] border border-[#1b2d50] p-6 text-center text-xs text-[#7e92b4]">
            No transactions yet.
          </div>
        ) : (
          <div className="space-y-2">
            {transactions.map((tx) => {
              const isCredit = tx.type === 'credit';
              const isRefund = tx.type === 'refund';
              const isFailed = tx.status === 'FAILED';

              return (
                <div
                  key={tx.ref}
                  className="rounded-xl bg-[#0e1a32] border border-[#1b2d50] p-3 flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        isFailed
                          ? 'bg-red-500/15 text-red-400'
                          : isCredit
                          ? 'bg-[#00c070]/15 text-[#00c070]'
                          : isRefund
                          ? 'bg-[#00a3ff]/15 text-[#00a3ff]'
                          : 'bg-[#ffa800]/15 text-[#ffa800]'
                      }`}
                    >
                      {isCredit ? (
                        <ArrowDownLeft className="w-4 h-4" />
                      ) : isRefund ? (
                        <RotateCcw className="w-4 h-4" />
                      ) : (
                        <ArrowUpRight className="w-4 h-4" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-white capitalize">
                          {tx.type === 'debit' ? 'Parlor Bet' : tx.type === 'credit' ? 'Bingo Win' : 'Bet Refund'}
                        </span>
                        <span
                          className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase ${
                            isFailed
                              ? 'bg-red-500/20 text-red-400'
                              : 'bg-[#15284a] text-[#7e92b4]'
                          }`}
                        >
                          {tx.status}
                        </span>
                      </div>
                      <p className="text-[10px] text-[#5d7399] font-mono truncate">
                        {tx.move_id || tx.ref}
                      </p>
                      <p className="text-[10px] text-[#7e92b4]">
                        {new Date(tx.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div
                      className={`text-sm font-black ${
                        isFailed
                          ? 'text-red-400 line-through'
                          : isCredit || isRefund
                          ? 'text-[#00c070]'
                          : 'text-white'
                      }`}
                    >
                      {isCredit || isRefund ? '+' : '-'}
                      {formatETB(tx.amount_santim)} ETB
                    </div>
                    {tx.error_code && (
                      <span className="text-[9px] text-red-400 font-semibold">{tx.error_code}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
