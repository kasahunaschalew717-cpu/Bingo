import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ArrowLeft,
  Ticket,
  Trophy,
  Volume2,
  VolumeX,
  Sparkles,
  Check,
  Users,
  Grid,
  WifiOff
} from 'lucide-react';
import type { RoomState, BingoCard, BingoCell, WinnerInfo, Ball } from '../types';
import { BingoCardView } from './BingoCardView';
import { WinnerModal } from './WinnerModal';
import { TicketPickerModal } from './TicketPickerModal';
import { BingoBall3D } from './BingoEmblem';
import { sound } from '../services/sound';
import { notifyParentBalanceChange } from '../services/postMessageBridge';
import { formatETB } from '../utils/currency';

interface GameRoomProps {
  tierId: string;
  token: string;
  playerRef: string;
  playerName: string;
  onBackToLobby: () => void;
  onBalanceUpdated: (newBalance: number) => void;
}

export const GameRoom: React.FC<GameRoomProps> = ({
  tierId,
  token,
  playerRef,
  playerName,
  onBackToLobby,
  onBalanceUpdated
}) => {
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [card, setCard] = useState<BingoCard | null>(null);
  const [ticketNumber, setTicketNumber] = useState<number | null>(null);
  const [showTicketPicker, setShowTicketPicker] = useState(false);
  const [previewCard, setPreviewCard] = useState<BingoCard | null>(null);
  const [previewTakenBy, setPreviewTakenBy] = useState<string | null>(null);
  const [ticketSelectError, setTicketSelectError] = useState<string | null>(null);
  const [spectating, setSpectating] = useState(false);
  const [debited, setDebited] = useState(false);
  const [markedIndices, setMarkedIndices] = useState<Set<number>>(new Set());
  const [drawnNumbers, setDrawnNumbers] = useState<Set<number>>(new Set());
  const [autoDaub, setAutoDaub] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showBoard, setShowBoard] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [bannerNotice, setBannerNotice] = useState<string | null>(null);
  const [winnerModal, setWinnerModal] = useState<WinnerInfo | null>(null);
  const [claimFeedback, setClaimFeedback] = useState<string | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const autoDaubRef = useRef(autoDaub);
  const cardRef = useRef(card);
  const balanceCbRef = useRef(onBalanceUpdated);

  autoDaubRef.current = autoDaub;
  cardRef.current = card;
  balanceCbRef.current = onBalanceUpdated;

  useEffect(() => {
    let unmounted = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let pingTimer: ReturnType<typeof setInterval> | null = null;
    let attempt = 0;

    function connect() {
      if (unmounted) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        attempt = 0;
        setWsConnected(true);
        ws.send(JSON.stringify({ type: 'JOIN_ROOM', tierId, token }));
        pingTimer = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'PING' }));
          }
        }, 20000);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          switch (msg.type) {
            case 'ROOM_JOINED': {
              const joinedCard: BingoCard = msg.card;
              const joinedState: RoomState = msg.state;
              setCard(joinedCard);
              setTicketNumber(msg.ticketNumber ?? joinedCard?.ticketNumber ?? null);
              setRoomState(joinedState);
              setSpectating(Boolean(msg.spectating));
              setDebited(Boolean(msg.debited));
              if (typeof msg.balance === 'number') {
                balanceCbRef.current(msg.balance);
              }

              // Restore drawn numbers on reconnect or spectator join
              const restoredDrawn = new Set<number>(
                (joinedState.drawnBalls || []).map((b: Ball) => b.number)
              );
              setDrawnNumbers(restoredDrawn);

              if (autoDaubRef.current && joinedCard && restoredDrawn.size > 0) {
                const restoredMarks = new Set<number>();
                joinedCard.cells.forEach((cell) => {
                  if (!cell.isFree && restoredDrawn.has(cell.number)) {
                    restoredMarks.add(cell.index);
                  }
                });
                setMarkedIndices(restoredMarks);
              } else {
                setMarkedIndices(new Set());
              }
              break;
            }

            case 'ROOM_STATE':
              setRoomState(msg.state);
              if (msg.state?.status === 'WAITING') {
                setSpectating(false);
                setDebited(false);
              }
              break;

            case 'CARD_UPDATED':
              setCard(msg.card);
              setTicketNumber(msg.ticketNumber ?? msg.card?.ticketNumber ?? null);
              setShowTicketPicker(false);
              setTicketSelectError(null);
              setMarkedIndices(new Set());
              setDrawnNumbers(new Set());
              setSpectating(false);
              setDebited(false);
              sound.playTick();
              break;

            case 'TICKET_PREVIEW':
              setPreviewCard(msg.card);
              setPreviewTakenBy(msg.takenBy || null);
              setTicketSelectError(null);
              break;

            case 'TICKET_SELECT_ERROR':
              setTicketSelectError(msg.message || 'Could not select ticket.');
              break;

            case 'BET_DEBITED':
              setDebited(true);
              setSpectating(false);
              balanceCbRef.current(msg.balance);
              notifyParentBalanceChange();
              setBannerNotice(`Ticket confirmed — ${msg.stakeETB} ETB bet locked.`);
              setTimeout(() => setBannerNotice(null), 3500);
              break;

            case 'BET_FAILED':
              setDebited(false);
              if (typeof msg.balance === 'number') {
                balanceCbRef.current(msg.balance);
              }
              setBannerNotice(msg.message);
              break;

            case 'BALL_DRAWN': {
              const ball: Ball = msg.ball;
              sound.playBallDrop();

              setDrawnNumbers((prev) => {
                const next = new Set(prev);
                next.add(ball.number);
                return next;
              });

              const activeCard = cardRef.current;
              if (autoDaubRef.current && activeCard) {
                const matchingCell = activeCard.cells.find((c) => c.number === ball.number);
                if (matchingCell) {
                  setMarkedIndices((prev) => {
                    const next = new Set(prev);
                    next.add(matchingCell.index);
                    return next;
                  });
                  sound.playDaub();
                }
              }
              break;
            }

            case 'ROUND_FINISHED': {
              if (msg.winner) {
                setWinnerModal(msg.winner);
                sound.playBingoCall();
                if (msg.winner.newBalance !== undefined && msg.winner.playerRef === playerRef) {
                  balanceCbRef.current(msg.winner.newBalance);
                  notifyParentBalanceChange();
                }
              } else if (msg.reason) {
                setBannerNotice(msg.reason);
              }
              break;
            }

            case 'CLAIM_RESULT': {
              if (msg.success) {
                sound.playBingoCall();
                setClaimFeedback('Bingo Claimed! Any Line Verified.');
              } else {
                setClaimFeedback(msg.message || 'No complete line yet.');
              }
              setTimeout(() => setClaimFeedback(null), 3500);
              break;
            }

            case 'BET_REFUNDED':
              setDebited(false);
              balanceCbRef.current(msg.balance);
              notifyParentBalanceChange();
              setBannerNotice(msg.message || 'Round cancelled: Bet refunded.');
              setTimeout(() => setBannerNotice(null), 5000);
              break;

            case 'ERROR':
              setBannerNotice(msg.message);
              break;

            default:
              break;
          }
        } catch (err) {
          console.error('WebSocket receive error:', err);
        }
      };

      ws.onclose = () => {
        setWsConnected(false);
        if (pingTimer) clearInterval(pingTimer);
        if (!unmounted) {
          const delay = Math.min(1000 * 2 ** attempt, 8000);
          attempt++;
          reconnectTimer = setTimeout(connect, delay);
        }
      };
    }

    connect();

    return () => {
      unmounted = true;
      if (pingTimer) clearInterval(pingTimer);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      const ws = socketRef.current;
      if (ws) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'LEAVE_ROOM', tierId }));
        }
        ws.close();
      }
    };
  }, [tierId, token, playerRef]);

  useEffect(() => {
    if (autoDaub && card && drawnNumbers.size > 0) {
      setMarkedIndices((prev) => {
        const next = new Set(prev);
        card.cells.forEach((cell) => {
          if (!cell.isFree && drawnNumbers.has(cell.number)) {
            next.add(cell.index);
          }
        });
        return next;
      });
    }
  }, [autoDaub, card, drawnNumbers]);

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    sound.enabled = next;
  };

  const handleToggleCell = (cell: BingoCell) => {
    if (cell.isFree || spectating) return;
    if (!drawnNumbers.has(cell.number)) {
      setClaimFeedback(`Number ${cell.number} has not been called yet!`);
      setTimeout(() => setClaimFeedback(null), 2000);
      return;
    }
    setMarkedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(cell.index)) {
        next.delete(cell.index);
      } else {
        next.add(cell.index);
      }
      return next;
    });
  };

  const handlePreviewTicket = (num: number) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'PREVIEW_TICKET', tierId, ticketNumber: num }));
    }
  };

  const handleConfirmTicket = (num: number) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'SELECT_TICKET', tierId, ticketNumber: num }));
    }
  };

  const handleClaimBingo = () => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'CLAIM_BINGO', tierId }));
    }
  };

  // Detect any complete Line (5 in row, 5 in col, or 5 in diagonal)
  const winningIndices = useMemo(() => {
    if (!card) return new Set<number>();
    const indices = new Set<number>();
    const isMarked = (idx: number) => card.cells[idx].isFree || markedIndices.has(idx);

    for (let r = 0; r < 5; r++) {
      const rowIdxs = [0, 1, 2, 3, 4].map((c) => r * 5 + c);
      if (rowIdxs.every(isMarked)) rowIdxs.forEach((i) => indices.add(i));
    }
    for (let c = 0; c < 5; c++) {
      const colIdxs = [0, 1, 2, 3, 4].map((r) => r * 5 + c);
      if (colIdxs.every(isMarked)) colIdxs.forEach((i) => indices.add(i));
    }
    const d1 = [0, 6, 12, 18, 24];
    if (d1.every(isMarked)) d1.forEach((i) => indices.add(i));

    const d2 = [4, 8, 12, 16, 20];
    if (d2.every(isMarked)) d2.forEach((i) => indices.add(i));

    return indices;
  }, [card, markedIndices]);

  const hasLineBingo = !spectating && debited && winningIndices.size >= 5;

  const currentBall = roomState?.currentBall;
  const recentBalls = roomState?.recentBalls || [];
  const potETB = roomState?.totalPot ? formatETB(roomState.totalPot) : '0';
  const status = roomState?.status || 'WAITING';
  const minPlayers = roomState?.minPlayers || 2;
  const players = roomState?.players || [];

  return (
    <div className="flex-1 flex flex-col overflow-y-auto px-4 py-3 pb-10 max-w-md mx-auto w-full">
      {/* 1. Room Top Bar */}
      <div className="flex items-center justify-between py-1 border-b border-[#15233e] mb-2.5">
        <button
          onClick={onBackToLobby}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#0e1a32] border border-[#1b2f54] text-xs font-bold text-[#7e92b4] hover:text-white active:scale-95 transition-all cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Lobby</span>
        </button>

        <div className="flex flex-col items-center">
          <span className="text-xs font-black text-white font-serif">{roomState?.name || 'Bingo Parlor'}</span>
          <div className="flex items-center gap-1 text-[10px] text-[#ffa800] font-bold">
            <span>{playerName}</span>
            <span>•</span>
            <span>Stake: {roomState?.stakeETB || 5} ETB</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#00c070]/15 border border-[#00c070]/40 text-[#00c070] text-xs font-extrabold shadow-sm">
            <Trophy className="w-3 h-3" />
            <span>{potETB} ETB</span>
          </div>

          <button
            onClick={toggleSound}
            className="p-1.5 rounded-xl bg-[#0e1a32] border border-[#1b2f54] text-[#7e92b4] hover:text-white cursor-pointer"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-[#ffa800]" /> : <VolumeX className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Reconnecting indicator */}
      {!wsConnected && (
        <div className="mb-2 p-2 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs font-bold flex items-center justify-center gap-1.5">
          <WifiOff className="w-3.5 h-3.5" />
          <span>Reconnecting to room...</span>
        </div>
      )}

      {/* Spectator / Queued notice */}
      {spectating && (
        <div className="mb-2 p-2.5 rounded-xl bg-[#00a3ff]/15 border border-[#00a3ff]/40 text-[#58c4ff] text-xs font-bold text-center">
          Round in Progress — You are queued for the next round
        </div>
      )}

      {/* Notice & Claim Feedback Banners */}
      {bannerNotice && (
        <div className="mb-2 p-2.5 rounded-xl bg-[#0e2246] border border-[#00a3ff]/60 text-white text-xs font-bold text-center animate-fadeIn shadow-md">
          {bannerNotice}
        </div>
      )}
      {claimFeedback && (
        <div className="mb-2 p-2 rounded-xl bg-[#ffa800]/20 border border-[#ffa800] text-[#ffa800] text-xs font-bold text-center animate-fadeIn">
          {claimFeedback}
        </div>
      )}

      {/* 2. Seated Players Strip (shortened Ardi names) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 mb-2">
        <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#0e1a32] border border-[#1b2d50] text-[10px] font-bold text-[#7e92b4] shrink-0">
          <Users className="w-3 h-3 text-[#00a3ff]" />
          <span>{roomState?.playerCount || 0}</span>
        </div>
        {players.map((p) => (
          <span
            key={p.playerRef}
            className={`px-2 py-1 rounded-lg text-[10px] font-semibold shrink-0 border ${p.playerRef === playerRef
              ? 'bg-[#ffa800]/15 border-[#ffa800]/50 text-[#ffa800]'
              : 'bg-[#0e1a32] border-[#1b2d50] text-[#a0b0cb]'
              }`}
          >
            {p.name}
            {p.spectating ? ' (Next)' : ''}
          </span>
        ))}
      </div>

      {/* 3. Game State Display */}
      {status === 'WAITING' || status === 'COUNTDOWN' || status === 'LOCKING' ? (
        <div className="rounded-2xl bg-gradient-to-b from-[#101e38] to-[#0a1426] border border-[#1f345c] p-4 text-center space-y-2.5 mb-3 shadow-[0_8px_24px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.05)]">
          <div className="flex items-center justify-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${status === 'COUNTDOWN' ? 'bg-[#00c070] animate-ping' : 'bg-[#ffa800] animate-pulse'
                }`}
            ></span>
            <span className="text-[11px] font-bold text-[#8ea4c9] uppercase tracking-wider">
              {status === 'LOCKING'
                ? 'Locking Bets'
                : status === 'COUNTDOWN'
                  ? 'Round Starting'
                  : `Waiting for Players (${roomState?.playerCount || 0}/${minPlayers})`}
            </span>
          </div>

          <div className="text-3xl font-black text-white tabular-nums tracking-tight">
            {status === 'COUNTDOWN'
              ? `${roomState?.countdown}s`
              : status === 'LOCKING'
                ? 'Locking...'
                : `${roomState?.playerCount || 0} / ${minPlayers}+`}
          </div>

          <p className="text-xs text-[#8ea4c9]">
            Win Condition: Complete <strong className="text-[#ffa800]">Any Line</strong> (Row, Column, or Diagonal) for 100% of the net pot.
          </p>

          {!spectating && (status === 'WAITING' || status === 'COUNTDOWN') && (
            <div className="flex items-center justify-center gap-2 pt-1">
              <button
                onClick={() => {
                  setTicketSelectError(null);
                  setShowTicketPicker(true);
                }}
                className="px-4 py-2 rounded-full bg-gradient-to-b from-[#ffb800] to-[#e69500] hover:from-[#ffc629] hover:to-[#ffa800] active:scale-95 text-xs font-black text-[#070e1b] flex items-center gap-1.5 shadow-[0_4px_12px_rgba(255,168,0,0.3)] cursor-pointer transition-all"
              >
                <Ticket className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Select Ticket {ticketNumber ? `(#${ticketNumber})` : ''}</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        /* PLAYING / Ball Caller View */
        <div className="rounded-2xl bg-gradient-to-b from-[#101e38] to-[#0a1426] border border-[#1f345c] p-3 mb-3 shadow-[0_8px_24px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.05)]">
          <div className="flex items-center justify-between mb-2.5 px-1">
            <span className="text-[11px] font-bold text-[#8ea4c9] uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#ef4444] animate-pulse"></span>
              Live Ball Caller
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold tabular-nums text-[#00a3ff]">
                {roomState?.drawnCount || 0} / 75
              </span>
              <button
                onClick={() => setShowBoard(!showBoard)}
                className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#142648] hover:bg-[#1a325e] border border-[#243f75] text-[10px] font-bold text-white cursor-pointer transition-colors"
              >
                <Grid className="w-3 h-3 text-[#ffa800]" />
                <span>{showBoard ? 'Hide' : 'Board'}</span>
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <BingoBall3D ball={currentBall || null} size="lg" />

            <div className="flex-1 overflow-x-auto flex items-center gap-2 py-1">
              {recentBalls.length > 1 ? (
                recentBalls.slice(1, 6).map((b, i) => (
                  <BingoBall3D key={`${b.letter}-${b.number}-${i}`} ball={b} size="sm" />
                ))
              ) : (
                <span className="text-xs text-[#647aa1] italic">
                  {currentBall ? 'Previous balls appear here' : 'First ball incoming...'}
                </span>
              )}
            </div>
          </div>

          {/* Collapsible 1-75 Caller Audit Board */}
          {showBoard && (
            <div className="mt-3 pt-2.5 border-t border-[#17294a] grid grid-cols-[repeat(15,minmax(0,1fr))] gap-0.5">
              {Array.from({ length: 75 }, (_, idx) => idx + 1).map((n) => {
                const isCalled = drawnNumbers.has(n);
                return (
                  <div
                    key={n}
                    className={`text-[9px] text-center py-0.5 rounded font-bold ${isCalled
                      ? 'bg-[#ffa800] text-black'
                      : 'bg-[#08101f] text-[#455a7e]'
                      }`}
                  >
                    {n}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 4. Bingo Card View */}
      {card && (
        <BingoCardView
          card={card}
          drawnNumbers={drawnNumbers}
          markedIndices={markedIndices}
          winningCellIndices={winningIndices}
          onToggleCell={handleToggleCell}
          interactive={status === 'PLAYING' && !spectating}
        />
      )}

      {/* 5. In-Game Controls */}
      <div className="mt-3 space-y-2">
        <div className="flex items-center justify-between px-1">
          <button
            onClick={() => setAutoDaub(!autoDaub)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${autoDaub
              ? 'bg-[#00a3ff]/20 border border-[#00a3ff] text-[#00a3ff]'
              : 'bg-[#0e1a32] border border-[#1b2d50] text-[#7e92b4]'
              }`}
          >
            <Check className={`w-3.5 h-3.5 ${autoDaub ? 'opacity-100' : 'opacity-30'}`} />
            <span>Auto-Daub: {autoDaub ? 'ON' : 'OFF'}</span>
          </button>

          <span className="text-[11px] text-[#7e92b4] font-semibold">
            {hasLineBingo ? 'Any Line Ready to Claim' : 'Win: Any Row, Col, or Diag'}
          </span>
        </div>

        <button
          disabled={status !== 'PLAYING' || spectating || !debited}
          onClick={handleClaimBingo}
          className={`w-full py-4 rounded-2xl font-black text-xl tracking-widest uppercase transition-all duration-150 flex items-center justify-center gap-2 shadow-2xl ${hasLineBingo
            ? 'bg-gradient-to-r from-[#ffa800] via-[#ffc030] to-[#ffa800] text-black shadow-[0_0_30px_rgba(255,168,0,0.9)] animate-pulse scale-[1.02] border-2 border-white cursor-pointer'
            : status === 'PLAYING' && !spectating && debited
              ? 'bg-[#ffa800] hover:bg-[#ffb820] text-black active:scale-95 shadow-[0_4px_16px_rgba(255,168,0,0.4)] cursor-pointer'
              : 'bg-[#15233e] text-[#4d6387] cursor-not-allowed border border-[#1b2d50]'
            }`}
        >
          <Sparkles className="w-5 h-5 fill-current" />
          <span>{spectating ? 'WAITING NEXT ROUND' : 'BINGO!'}</span>
          <Sparkles className="w-5 h-5 fill-current" />
        </button>
      </div>

      {showTicketPicker && (status === 'WAITING' || status === 'COUNTDOWN') && (
        <TicketPickerModal
          poolSize={roomState?.ticketPoolSize || 100}
          currentTicketNumber={ticketNumber}
          currentPlayerRef={playerRef}
          takenTickets={roomState?.takenTickets || []}
          previewCard={previewCard}
          previewTakenBy={previewTakenBy}
          errorMessage={ticketSelectError}
          onPreviewTicket={handlePreviewTicket}
          onConfirmTicket={handleConfirmTicket}
          onClose={() => setShowTicketPicker(false)}
        />
      )}

      {winnerModal && (
        <WinnerModal
          winner={winnerModal}
          isCurrentUser={winnerModal.playerRef === playerRef}
          onClose={() => setWinnerModal(null)}
        />
      )}
    </div>
  );
};
