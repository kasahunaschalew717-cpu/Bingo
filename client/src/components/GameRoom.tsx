import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ArrowLeft, Dices, Trophy, Volume2, VolumeX, Sparkles, Check, User } from 'lucide-react';
import type { RoomState, BingoCard, BingoCell, WinnerInfo, Ball } from '../types';
import { BingoCardView } from './BingoCardView';
import { WinnerModal } from './WinnerModal';
import { sound } from '../services/sound';
import { notifyParentBalanceChange } from '../services/postMessageBridge';

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
  const [markedIndices, setMarkedIndices] = useState<Set<number>>(new Set());
  const [drawnNumbers, setDrawnNumbers] = useState<Set<number>>(new Set());
  const [autoDaub, setAutoDaub] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [bannerNotice, setBannerNotice] = useState<string | null>(null);
  const [winnerModal, setWinnerModal] = useState<WinnerInfo | null>(null);
  const [claimFeedback, setClaimFeedback] = useState<string | null>(null);

  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const ws = new WebSocket(wsUrl);
    socketRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: 'JOIN_ROOM',
        tierId,
        token
      }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        switch (msg.type) {
          case 'ROOM_JOINED':
            setCard(msg.card);
            setRoomState(msg.state);
            setMarkedIndices(new Set());
            setDrawnNumbers(new Set());
            break;

          case 'ROOM_STATE':
            setRoomState(msg.state);
            break;

          case 'CARD_UPDATED':
            setCard(msg.card);
            setMarkedIndices(new Set());
            sound.playTick();
            break;

          case 'BET_DEBITED':
            onBalanceUpdated(msg.balance);
            notifyParentBalanceChange();
            setBannerNotice(`🎟️ Ticket confirmed! Bet ${msg.stakeETB} ETB placed.`);
            setTimeout(() => setBannerNotice(null), 3000);
            break;

          case 'BET_FAILED':
            setBannerNotice(`⚠️ ${msg.message}`);
            break;

          case 'BALL_DRAWN': {
            const ball: Ball = msg.ball;
            sound.playBallDrop();

            setDrawnNumbers((prev) => {
              const next = new Set(prev);
              next.add(ball.number);
              return next;
            });

            if (autoDaub && card) {
              const matchingCell = card.cells.find(c => c.number === ball.number);
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
                onBalanceUpdated(msg.winner.newBalance);
                notifyParentBalanceChange();
              }
            }
            break;
          }

          case 'CLAIM_RESULT': {
            if (msg.success) {
              sound.playBingoCall();
              setClaimFeedback(`⭐ Bingo Claimed! Any Line Verified!`);
            } else {
              setClaimFeedback(msg.message || 'No complete line yet.');
            }
            setTimeout(() => setClaimFeedback(null), 3000);
            break;
          }

          case 'BET_REFUNDED':
            onBalanceUpdated(msg.balance);
            notifyParentBalanceChange();
            setBannerNotice(`↩️ Round aborted: Bet refunded.`);
            break;

          default:
            break;
        }
      } catch (err) {
        console.error('WebSocket receive error:', err);
      }
    };

    ws.onclose = () => {
      console.log('Room WebSocket closed');
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'LEAVE_ROOM', tierId }));
        ws.close();
      }
    };
  }, [tierId, token, playerRef, autoDaub, card, onBalanceUpdated]);

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
    if (cell.isFree) return;
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

  const handleChangeCard = () => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'REGENERATE_CARD', tierId }));
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

    // Rows
    for (let r = 0; r < 5; r++) {
      const rowIdxs = [0, 1, 2, 3, 4].map(c => r * 5 + c);
      if (rowIdxs.every(isMarked)) {
        rowIdxs.forEach(i => indices.add(i));
      }
    }
    // Cols
    for (let c = 0; c < 5; c++) {
      const colIdxs = [0, 1, 2, 3, 4].map(r => r * 5 + c);
      if (colIdxs.every(isMarked)) {
        colIdxs.forEach(i => indices.add(i));
      }
    }
    // Diagonals
    const d1 = [0, 6, 12, 18, 24];
    if (d1.every(isMarked)) d1.forEach(i => indices.add(i));

    const d2 = [4, 8, 12, 16, 20];
    if (d2.every(isMarked)) d2.forEach(i => indices.add(i));

    return indices;
  }, [card, markedIndices]);

  const hasLineBingo = winningIndices.size >= 5;

  const currentBall = roomState?.currentBall;
  const recentBalls = roomState?.recentBalls || [];
  const potETB = roomState?.totalPot ? (roomState.totalPot / 100).toFixed(2) : ((roomState?.stakeETB || 10) * 4).toFixed(2);
  const status = roomState?.status || 'WAITING';

  return (
    <div className="flex-1 flex flex-col overflow-y-auto px-4 py-3 pb-24 max-w-md mx-auto w-full">
      {/* 1. Header Bar for Room */}
      <div className="flex items-center justify-between py-1 border-b border-[#15233e] mb-3">
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
            <User className="w-2.5 h-2.5" />
            <span>{playerName}</span>
            <span>•</span>
            <span>Stake: {roomState?.stakeETB || 5} ETB</span>
          </div>
        </div>

        {/* Pot & Sound Toggle */}
        <div className="flex items-center gap-2">
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

      {/* 2. Notice Banner */}
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

      {/* 3. Game State Display */}
      {status === 'WAITING' || status === 'COUNTDOWN' ? (
        <div className="rounded-2xl bg-[#0e1a32] border border-[#1b2d50] p-4 text-center space-y-3 mb-3 shadow-md">
          <div className="flex items-center justify-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#00c070] animate-ping"></span>
            <span className="text-xs font-bold text-[#7e92b4] uppercase tracking-wider">
              {status === 'COUNTDOWN' ? 'Starting Soon' : 'Waiting for Players'}
            </span>
          </div>

          <div className="text-3xl font-black text-white font-mono tracking-tight">
            {status === 'COUNTDOWN' ? `${roomState?.countdown}s` : 'Waiting...'}
          </div>

          <p className="text-xs text-[#7e92b4]">
            Win Condition: Complete <strong className="text-[#ffa800]">Any Line</strong> (Horizontal, Vertical, or Diagonal) to win the full pot!
          </p>

          <div className="flex items-center justify-center gap-2 pt-1">
            <button
              onClick={handleChangeCard}
              className="px-4 py-2 rounded-full bg-[#16274a] hover:bg-[#1d3360] active:scale-95 border border-[#233d73] text-xs font-bold text-white flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Dices className="w-3.5 h-3.5 text-[#ffa800]" />
              <span>Change Ticket</span>
            </button>
          </div>
        </div>
      ) : (
        /* PLAYING / Ball Caller View */
        <div className="rounded-2xl bg-[#0e1a32] border border-[#1b2d50] p-3 mb-3 shadow-md">
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-xs font-bold text-[#7e92b4] uppercase tracking-wider flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#ef4444] animate-pulse"></span>
              Live Ball Caller
            </span>
            <span className="text-[11px] font-mono text-[#00a3ff] font-bold">
              {roomState?.drawnCount || 0} / 75 Drawn
            </span>
          </div>

          {/* Current Ball & Recent Ribbon */}
          <div className="flex items-center justify-between gap-3">
            {/* Giant 3D Current Ball */}
            <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-[#ffb800] via-[#e68a00] to-[#b35900] p-1 shadow-[0_0_16px_rgba(255,168,0,0.6)] flex items-center justify-center shrink-0">
              <div className="w-full h-full rounded-full bg-gradient-to-b from-[#1a1200] to-[#070e1b] flex flex-col items-center justify-center text-white border border-[#ffa800]/50">
                {currentBall ? (
                  <>
                    <span className="text-[10px] font-black text-[#ffa800] -mb-1">{currentBall.letter}</span>
                    <span className="text-xl font-black text-white">{currentBall.number}</span>
                  </>
                ) : (
                  <span className="text-xs text-[#7e92b4] font-bold">...</span>
                )}
              </div>
            </div>

            {/* Recent Balls Strip */}
            <div className="flex-1 overflow-x-auto flex items-center gap-1.5 py-1">
              {recentBalls.length > 0 ? (
                recentBalls.slice(1, 6).map((b, i) => (
                  <div
                    key={`${b.letter}-${b.number}-${i}`}
                    className="flex flex-col items-center justify-center w-10 h-10 rounded-xl bg-[#091326] border border-[#1b2f54] shrink-0"
                  >
                    <span className="text-[8px] font-bold text-[#ffa800]">{b.letter}</span>
                    <span className="text-xs font-black text-white">{b.number}</span>
                  </div>
                ))
              ) : (
                <span className="text-xs text-[#526a91] italic">First ball incoming...</span>
              )}
            </div>
          </div>
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
          interactive={status === 'PLAYING'}
        />
      )}

      {/* 5. In-Game Controls: Auto-Daub Toggle & Giant BINGO Button */}
      <div className="mt-3 space-y-2">
        <div className="flex items-center justify-between px-1">
          {/* Auto-Daub Switch */}
          <button
            onClick={() => setAutoDaub(!autoDaub)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
              autoDaub
                ? 'bg-[#00a3ff]/20 border border-[#00a3ff] text-[#00a3ff]'
                : 'bg-[#0e1a32] border border-[#1b2d50] text-[#7e92b4]'
            }`}
          >
            <Check className={`w-3.5 h-3.5 ${autoDaub ? 'opacity-100' : 'opacity-30'}`} />
            <span>Auto-Daub: {autoDaub ? 'ON' : 'OFF'}</span>
          </button>

          <span className="text-[11px] text-[#7e92b4]">
            {hasLineBingo ? '⭐ ANY LINE COMPLETE!' : 'Win: Any Row, Col, or Diag'}
          </span>
        </div>

        {/* Giant Glowing BINGO Button */}
        <button
          disabled={status !== 'PLAYING'}
          onClick={handleClaimBingo}
          className={`w-full py-4 rounded-2xl font-black text-xl tracking-widest uppercase transition-all duration-150 flex items-center justify-center gap-2 shadow-2xl cursor-pointer ${
            hasLineBingo
              ? 'bg-gradient-to-r from-[#ffa800] via-[#ffc030] to-[#ffa800] text-black shadow-[0_0_30px_rgba(255,168,0,0.9)] animate-pulse scale-[1.02] border-2 border-white'
              : status === 'PLAYING'
              ? 'bg-[#ffa800] hover:bg-[#ffb820] text-black active:scale-95 shadow-[0_4px_16px_rgba(255,168,0,0.4)]'
              : 'bg-[#15233e] text-[#4d6387] cursor-not-allowed border border-[#1b2d50]'
          }`}
        >
          <Sparkles className="w-5 h-5 fill-current" />
          <span>BINGO!</span>
          <Sparkles className="w-5 h-5 fill-current" />
        </button>
      </div>

      {/* 6. Winner Modal Overlay */}
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
