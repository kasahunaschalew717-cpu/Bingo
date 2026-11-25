import { useState, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Header } from './components/Header';
import { Lobby } from './components/Lobby';
import { GameRoom } from './components/GameRoom';
import { WalletTab } from './components/WalletTab';
import { ProfileTab } from './components/ProfileTab';
import { requestCloseGame } from './services/postMessageBridge';
import type { RoomTierSummary, SessionData } from './types';

export function App() {
  const [token, setToken] = useState<string>('');
  const [session, setSession] = useState<SessionData | null>(null);
  const [tiers, setTiers] = useState<RoomTierSummary[]>([]);
  const [selectedTierId, setSelectedTierId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'lobby' | 'history' | 'rules'>('lobby');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get('token');

    async function initSession() {
      try {
        setLoading(true);
        let effectiveToken = urlToken || '';
        if (!effectiveToken) {
          const healthRes = await fetch('/health');
          const health = await healthRes.json();
          if (health.mode === 'sandbox') {
            effectiveToken = 'ags_sample_player_1';
          } else {
            throw new Error(
              'No Ardi player session token found. Please open Ethiopian Bingo from Extra Games inside the Ardi Telegram app.'
            );
          }
        }

        setToken(effectiveToken);

        const res = await fetch('/api/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: effectiveToken })
        });
        const data = await res.json();
        if (!data.ok) {
          throw new Error(data.message || 'Session verification failed');
        }
        setSession(data);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to connect to Ardi Game Zone');
      } finally {
        setLoading(false);
      }
    }

    initSession();
  }, []);

  useEffect(() => {
    if (!session) return;

    async function fetchTiers() {
      try {
        const res = await fetch('/api/rooms');
        const data = await res.json();
        if (data.ok) {
          setTiers(data.tiers);
        }
      } catch (err) {
        console.error('Error fetching tiers:', err);
      }
    }

    fetchTiers();
    const interval = setInterval(fetchTiers, 3000);
    return () => clearInterval(interval);
  }, [session]);

  const handleBalanceUpdated = (newBalance: number) => {
    setSession((prev) => (prev ? { ...prev, balance: newBalance } : null));
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#070e1b] text-white p-4">
        <div className="relative w-14 h-14 mb-4">
          <div className="absolute inset-0 rounded-full border-4 border-[#162746]"></div>
          <div className="absolute inset-0 rounded-full border-4 border-t-[#ffa800] animate-spin"></div>
        </div>
        <span className="text-xs font-bold text-[#8ea4c9] tracking-widest uppercase">
          Connecting to Ardi Game Zone...
        </span>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#070e1b] text-white p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center mb-4">
          <AlertTriangle className="w-8 h-8 text-red-400" />
        </div>
        <h2 className="text-xl font-bold font-serif mb-2">Session Required</h2>
        <p className="text-xs text-[#7e92b4] max-w-xs mb-6 leading-relaxed">{error}</p>
        <div className="flex gap-2">
          <button
            onClick={() => window.location.reload()}
            className="px-5 py-2.5 rounded-full bg-[#ffa800] text-black font-bold text-xs uppercase tracking-wider cursor-pointer"
          >
            Retry
          </button>
          <button
            onClick={requestCloseGame}
            className="px-5 py-2.5 rounded-full bg-[#13223f] border border-[#1e3560] text-white font-bold text-xs uppercase tracking-wider cursor-pointer"
          >
            Back to Ardi
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-b from-[#070e1b] to-[#0a1426] text-white font-sans antialiased selection:bg-[#ffa800] selection:text-black">
      <Header
        balanceSantim={session.balance}
        token={token}
        playerName={session.player.name}
        mode={session.mode}
        onBalanceUpdated={handleBalanceUpdated}
      />

      {selectedTierId ? (
        <GameRoom
          tierId={selectedTierId}
          token={token}
          playerRef={session.player.ref}
          playerName={session.player.name}
          onBackToLobby={() => setSelectedTierId(null)}
          onBalanceUpdated={handleBalanceUpdated}
        />
      ) : activeView === 'history' ? (
        <WalletTab
          token={token}
          balanceSantim={session.balance}
          onBalanceUpdated={handleBalanceUpdated}
          onBack={() => setActiveView('lobby')}
        />
      ) : activeView === 'rules' ? (
        <ProfileTab
          session={session}
          onBack={() => setActiveView('lobby')}
        />
      ) : (
        <Lobby
          tiers={tiers}
          onSelectTier={(tierId) => setSelectedTierId(tierId)}
          playerBalanceSantim={session.balance}
          onOpenHistory={() => setActiveView('history')}
          onOpenRules={() => setActiveView('rules')}
        />
      )}
    </div>
  );
}

export default App;
