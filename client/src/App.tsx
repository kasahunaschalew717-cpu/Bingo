import { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { Lobby } from './components/Lobby';
import { GameRoom } from './components/GameRoom';
import { BottomNav } from './components/BottomNav';
import type { RoomTierSummary, SessionData } from './types';

export function App() {
  const [token, setToken] = useState<string>('');
  const [session, setSession] = useState<SessionData | null>(null);
  const [tiers, setTiers] = useState<RoomTierSummary[]>([]);
  const [selectedTierId, setSelectedTierId] = useState<string | null>(null);
  const [currentTab, setCurrentTab] = useState<'home' | 'games' | 'wallet' | 'profile'>('home');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 1. Initialize token and session
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get('token') || 'ags_sample_player_1';
    setToken(urlToken);

    async function initSession() {
      try {
        setLoading(true);
        const res = await fetch('/api/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: urlToken })
        });
        const data = await res.json();
        if (!data.ok) {
          throw new Error(data.message || 'Session verification failed');
        }
        setSession(data);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to connect to Game Zone');
      } finally {
        setLoading(false);
      }
    }

    initSession();
  }, []);

  // 2. Fetch Quick-Match Tiers
  useEffect(() => {
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
    const interval = setInterval(fetchTiers, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleBalanceUpdated = (newBalance: number) => {
    setSession((prev) => prev ? { ...prev, balance: newBalance } : null);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#070e1b] text-white p-4">
        <div className="relative w-16 h-16 mb-4">
          <div className="absolute inset-0 rounded-full border-4 border-[#162746] animate-pulse"></div>
          <div className="absolute inset-0 rounded-full border-4 border-t-[#ffa800] animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center text-2xl">🎱</div>
        </div>
        <span className="text-sm font-bold text-[#7e92b4] tracking-widest uppercase">Connecting to Ardi Game Zone...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#070e1b] text-white p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-3xl mb-4">
          ⚠️
        </div>
        <h2 className="text-xl font-bold font-serif mb-2">Connection Refused</h2>
        <p className="text-xs text-[#7e92b4] max-w-xs mb-6">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-2.5 rounded-full bg-[#ffa800] text-black font-bold text-xs uppercase tracking-wider cursor-pointer"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-b from-[#070e1b] to-[#0a1426] text-white font-sans antialiased selection:bg-[#ffa800] selection:text-black">
      {/* Ardi Game Zone Header */}
      <Header
        balanceSantim={session?.balance || 0}
        token={token}
        playerName={session?.player.name}
        onBalanceUpdated={handleBalanceUpdated}
      />

      {/* Main View: Lobby or Active Game Room */}
      {selectedTierId ? (
        <GameRoom
          tierId={selectedTierId}
          token={token}
          playerRef={session?.player.ref || 'p_unknown'}
          playerName={session?.player.name || 'Player'}
          onBackToLobby={() => setSelectedTierId(null)}
          onBalanceUpdated={handleBalanceUpdated}
        />
      ) : (
        <>
          <Lobby
            tiers={tiers}
            onSelectTier={(tierId) => setSelectedTierId(tierId)}
            playerBalanceSantim={session?.balance || 0}
          />
          <BottomNav
            currentTab={currentTab}
            onTabChange={(tab) => setCurrentTab(tab)}
          />
        </>
      )}
    </div>
  );
}

export default App;
