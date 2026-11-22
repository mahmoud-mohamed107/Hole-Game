/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState } from 'react';
import {
  Check,
  Coins,
  Crown,
  Download,
  Flame,
  Lock,
  Pause,
  Play,
  RotateCcw,
  Target,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import { GameEngine } from './game/GameEngine';
import {
  HOLE_SKINS,
  UPGRADE_DEFS,
  generateNextQuest,
  getRoundDuration,
  getUpgradeCost,
  loadProgress,
  saveProgress,
} from './game/progression';
import type {
  DifficultyLevel,
  GameState,
  HudSnapshot,
  PlayerProgress,
  SkinId,
  UpgradeKey,
} from './game/types';

const INITIAL_HUD: HudSnapshot = {
  timeRemaining: 60,
  score: 0,
  sizeMeters: 4.3,
  tier: 1,
  tierName: 'Pothole',
  tierProgress: 0.12,
  nextTierMeters: 6.2,
  comboCount: 0,
  comboTimerRatio: 0,
  feverMeter: 0,
  feverTimer: 0,
  isFeverActive: false,
  boostReadyRatio: 1,
  isBoosting: false,
  isReforming: false,
  reformSeconds: 0,
  rank: 1,
  totalContenders: 6,
  itemsSwallowed: 0,
  rivalsSwallowed: 0,
  maxCombo: 0,
  maxSizeMeters: 4.3,
  standings: [],
  eventBanner: null,
  questProgress: 0,
  questCompleted: false,
  questRewardClaimed: false,
  coinsEarnedFromScore: 0,
};

interface RoundRewardSummary {
  scoreCoins: number;
  questBonus: number;
  questTitle: string;
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);

  const [progress, setProgress] = useState<PlayerProgress>(() => loadProgress());
  const progressRef = useRef<PlayerProgress>(progress);
  useEffect(() => {
    progressRef.current = progress;
    saveProgress(progress);
  }, [progress]);

  const [gameState, setGameState] = useState<GameState>('TITLE_MENU');
  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [muted, setMuted] = useState(false);
  const [rivalCount, setRivalCount] = useState(5);
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('standard');
  const [roundReward, setRoundReward] = useState<RoundRewardSummary | null>(null);
  const [questPopupCoins, setQuestPopupCoins] = useState<number | null>(null);
  const [shopNotice, setShopNotice] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new GameEngine(
      canvas,
      (snapshot) => setHud(snapshot),
      (nextState) => setGameState(nextState),
      (bonusCoins) => {
        setProgress((prev) => ({
          ...prev,
          coins: prev.coins + bonusCoins,
        }));
        setQuestPopupCoins(bonusCoins);
        window.setTimeout(() => setQuestPopupCoins(null), 3200);
      },
      (finalScore, questCompleted) => {
        const current = progressRef.current;
        const scoreCoins = Math.floor(finalScore / 5);
        const questTitle = current.activeQuest.title;
        const questBonus = questCompleted ? current.activeQuest.rewardCoins : 0;

        setRoundReward({ scoreCoins, questBonus, questTitle });
        setProgress((prev) => ({
          ...prev,
          coins: prev.coins + scoreCoins,
          bestScore: Math.max(prev.bestScore, finalScore),
          roundsPlayed: prev.roundsPlayed + 1,
          activeQuest: questCompleted
            ? generateNextQuest(prev.activeQuest.title)
            : prev.activeQuest,
        }));
      }
    );
    engineRef.current = engine;

    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'KeyM') {
        setMuted((prev) => {
          const next = !prev;
          engineRef.current?.audio.setMuted(next);
          return next;
        });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const showShopNotice = (msg: string) => {
    setShopNotice(msg);
    window.setTimeout(() => setShopNotice(null), 2200);
  };

  const handleToggleMute = () => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.audio.unlock();
    const next = !muted;
    engine.audio.setMuted(next);
    setMuted(next);
  };

  const handleStartMatch = () => {
    setRoundReward(null);
    setQuestPopupCoins(null);
    const current = progressRef.current;
    engineRef.current?.startMatch({
      rivalCount,
      difficulty,
      upgrades: current.upgrades,
      skinId: current.selectedSkin,
      activeQuest: current.activeQuest,
    });
  };

  const handleTogglePause = () => {
    engineRef.current?.togglePause();
  };

  const handleReturnToMenu = () => {
    engineRef.current?.returnToMenu();
  };

  const handleBoost = () => {
    engineRef.current?.triggerPlayerBoost();
  };

  const handleBuyUpgrade = (key: UpgradeKey) => {
    const level = progress.upgrades[key];
    const cost = getUpgradeCost(key, level);
    if (cost === null) return;
    if (progress.coins < cost) {
      showShopNotice(`Need ${cost - progress.coins} more Gold Coins`);
      return;
    }
    setProgress((prev) => ({
      ...prev,
      coins: prev.coins - cost,
      upgrades: {
        ...prev.upgrades,
        [key]: prev.upgrades[key] + 1,
      },
    }));
  };

  const handleSelectOrBuySkin = (skinId: SkinId) => {
    const skin = HOLE_SKINS.find((s) => s.id === skinId);
    if (!skin) return;

    if (progress.unlockedSkins.includes(skinId)) {
      setProgress((prev) => ({ ...prev, selectedSkin: skinId }));
      return;
    }

    if (progress.coins < skin.cost) {
      showShopNotice(`Need ${skin.cost - progress.coins} more Gold Coins for ${skin.name}`);
      return;
    }

    setProgress((prev) => ({
      ...prev,
      coins: prev.coins - skin.cost,
      unlockedSkins: [...prev.unlockedSkins, skinId],
      selectedSkin: skinId,
    }));
  };

  const comboMultiplier = 1 + Math.min(4, Math.floor(Math.max(0, hud.comboCount - 1) / 3)) * 0.5;
  const maxComboMult = 1 + Math.min(4, Math.floor(Math.max(0, hud.maxCombo - 1) / 3)) * 0.5;
  const isFinalTen = hud.timeRemaining <= 10 && hud.timeRemaining > 0;
  const isBoostReady = hud.boostReadyRatio >= 0.999;
  const roundDurationSeconds = getRoundDuration(progress.upgrades);

  const activeQuest = progress.activeQuest;
  const questProgressDisplay =
    activeQuest.kind === 'reach_size'
      ? `${Math.min(activeQuest.target, hud.questProgress).toFixed(1)}/${activeQuest.target.toFixed(1)}m`
      : `${Math.min(activeQuest.target, Math.floor(hud.questProgress))}/${activeQuest.target}`;

  return (
    <div className="relative w-full h-full overflow-hidden bg-slate-950 text-slate-50">
      <canvas
        ref={canvasRef}
        className="block w-full h-full cursor-crosshair"
        aria-label="Sinkhole Blitz 2.5D city playfield"
      />

      {/* Active Gameplay HUD */}
      {gameState === 'PLAYING' && (
        <div className="pointer-events-none fixed inset-0 flex flex-col justify-between p-4 sm:p-5">
          {/* Top Bar */}
          <div className="flex flex-col items-center gap-2.5">
            <div className="w-full flex flex-wrap items-start justify-between gap-3">
              {/* Primary Match Telemetry */}
              <div className="pointer-events-auto flex items-center gap-4 sm:gap-6 rounded-xl border border-slate-700/70 bg-slate-900/90 px-4 py-2.5 backdrop-blur-md shadow-lg">
                <div>
                  <div className="text-[11px] font-medium text-slate-400 whitespace-nowrap">
                    {isFinalTen ? 'Time · Final 10s' : 'Time Left'}
                  </div>
                  <div
                    className={`font-mono-tabular text-xl sm:text-2xl font-bold leading-tight ${
                      isFinalTen ? 'text-red-400' : 'text-slate-50'
                    }`}
                  >
                    {hud.timeRemaining.toFixed(1)}s
                  </div>
                </div>

                <div className="h-8 w-px bg-slate-700/70" aria-hidden="true" />

                <div>
                  <div className="text-[11px] font-medium text-slate-400 whitespace-nowrap">Score</div>
                  <div className="font-mono-tabular text-xl sm:text-2xl font-bold leading-tight text-slate-50">
                    {hud.score.toLocaleString()}
                  </div>
                </div>

                <div className="h-8 w-px bg-slate-700/70" aria-hidden="true" />

                <div>
                  <div className="text-[11px] font-medium text-slate-400 whitespace-nowrap">
                    {hud.isFeverActive ? 'Fever Mode' : 'Combo · Fever'}
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span
                      className={`font-mono-tabular text-xl sm:text-2xl font-bold leading-tight ${
                        hud.isFeverActive
                          ? 'text-yellow-300'
                          : comboMultiplier > 1
                            ? 'text-amber-400'
                            : 'text-slate-200'
                      }`}
                    >
                      ×{comboMultiplier.toFixed(1)}
                    </span>
                    <span className="font-mono-tabular text-xs font-medium text-amber-300">
                      {hud.isFeverActive
                        ? `${hud.feverTimer.toFixed(1)}s`
                        : `${Math.round(hud.feverMeter * 100)}%`}
                    </span>
                  </div>
                  <div className="mt-1 h-1 w-20 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className={`h-full transition-[width] duration-75 ${
                        hud.isFeverActive ? 'bg-yellow-300' : 'bg-amber-400'
                      }`}
                      style={{
                        width: `${Math.round(
                          (hud.isFeverActive ? hud.feverTimer / 5 : hud.feverMeter) * 100
                        )}%`,
                      }}
                    />
                  </div>
                </div>

                <div className="hidden sm:block h-8 w-px bg-slate-700/70" aria-hidden="true" />

                <div className="hidden sm:block">
                  <div className="text-[11px] font-medium text-slate-400 whitespace-nowrap">Rank</div>
                  <div className="font-mono-tabular text-xl sm:text-2xl font-bold leading-tight text-emerald-400">
                    #{hud.rank} <span className="text-sm font-medium text-slate-400">/ {hud.totalContenders}</span>
                  </div>
                </div>
              </div>

              {/* Hole Size & Tier Progress */}
              <div className="pointer-events-auto min-w-[190px] rounded-xl border border-slate-700/70 bg-slate-900/90 px-4 py-2.5 backdrop-blur-md shadow-lg">
                <div className="flex items-center justify-between gap-4 text-xs text-slate-400">
                  <span className="font-medium text-slate-200 whitespace-nowrap">
                    Tier {hud.tier} · {hud.tierName}
                  </span>
                  <span className="font-mono-tabular whitespace-nowrap">
                    {hud.nextTierMeters ? `Next ${hud.nextTierMeters}m` : 'Max Tier'}
                  </span>
                </div>
                <div className="mt-0.5 flex items-baseline gap-2">
                  <span className="font-mono-tabular text-xl font-bold text-slate-50">
                    {hud.sizeMeters}m
                  </span>
                  <span className="text-xs text-slate-400">
                    {hud.itemsSwallowed} eaten
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full bg-emerald-400 transition-[width] duration-100"
                    style={{ width: `${Math.round(hud.tierProgress * 100)}%` }}
                  />
                </div>
              </div>

              {/* Persistent Coins & Audio/Pause Controls */}
              <div className="pointer-events-auto flex items-center gap-2">
                <div className="inline-flex min-h-[42px] items-center gap-2 rounded-xl border border-amber-400/40 bg-slate-900/90 px-3.5 py-2 text-xs font-bold text-amber-300 backdrop-blur-md shadow-lg whitespace-nowrap shrink-0">
                  <Coins className="h-4 w-4 text-amber-400" />
                  <span className="font-mono-tabular">{progress.coins.toLocaleString()}</span>
                </div>
                <button
                  type="button"
                  onClick={handleToggleMute}
                  aria-label={muted ? 'Unmute audio' : 'Mute audio'}
                  className="inline-flex min-h-[42px] items-center gap-2 rounded-xl border border-slate-700/70 bg-slate-900/90 px-3.5 py-2 text-xs font-semibold text-slate-100 backdrop-blur-md transition-colors hover:border-slate-500 hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-amber-400 whitespace-nowrap shrink-0"
                >
                  {muted ? <VolumeX className="h-4 w-4 text-slate-400" /> : <Volume2 className="h-4 w-4 text-emerald-400" />}
                  <span className="hidden sm:inline">{muted ? 'Muted' : 'Audio'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleTogglePause}
                  className="inline-flex min-h-[42px] items-center gap-2 rounded-xl border border-slate-700/70 bg-slate-900/90 px-3.5 py-2 text-xs font-semibold text-slate-100 backdrop-blur-md transition-colors hover:border-slate-500 hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-amber-400 whitespace-nowrap shrink-0"
                >
                  <Pause className="h-4 w-4" />
                  <span className="hidden sm:inline">Pause</span>
                </button>
              </div>
            </div>

            {/* Active Dynamic Mini-Quest Banner */}
            <div className="inline-flex items-center gap-3 rounded-xl border border-slate-700/80 bg-slate-900/90 px-4 py-1.5 text-xs backdrop-blur-md shadow-md">
              <Target className={`h-3.5 w-3.5 shrink-0 ${hud.questCompleted ? 'text-emerald-400' : 'text-amber-400'}`} />
              <span className="font-semibold text-slate-100">{activeQuest.title}</span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span className={`font-mono-tabular font-bold ${hud.questCompleted ? 'text-emerald-400' : 'text-amber-300'}`}>
                {hud.questCompleted ? 'Completed' : questProgressDisplay}
              </span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span className="font-mono-tabular text-amber-300">+{activeQuest.rewardCoins} Coins</span>
            </div>
          </div>

          {/* Center Event & Fever Mode Banner */}
          <div className="flex flex-col items-center gap-2">
            {questPopupCoins !== null && (
              <div className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/80 bg-slate-900/95 px-5 py-2.5 text-sm font-bold text-emerald-300 shadow-2xl">
                <Coins className="h-4 w-4 text-amber-400" />
                <span>Quest Complete · +{questPopupCoins} Bonus Coins Awarded!</span>
              </div>
            )}
            {hud.isFeverActive && (
              <div className="inline-flex items-center gap-2 rounded-xl border border-yellow-300/80 bg-slate-900/95 px-4 py-2 text-sm font-bold text-yellow-200 shadow-xl">
                <Flame className="h-4 w-4 text-orange-400" />
                <span>Fever Mode Active</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono-tabular">{hud.feverTimer.toFixed(1)}s</span>
                <span aria-hidden="true">·</span>
                <span className="text-xs font-semibold text-amber-300">2× Speed</span>
              </div>
            )}
            {hud.isReforming && (
              <div className="rounded-xl border border-red-500/70 bg-slate-900/95 px-5 py-2.5 text-center shadow-xl">
                <div className="font-display text-base font-bold text-red-300">
                  Swallowed — Reforming in {hud.reformSeconds.toFixed(1)}s
                </div>
              </div>
            )}
            {hud.eventBanner && !hud.isFeverActive && questPopupCoins === null && (
              <div className="rounded-xl border border-amber-400/70 bg-slate-900/95 px-4 py-2 text-sm font-semibold text-amber-200 shadow-lg">
                {hud.eventBanner}
              </div>
            )}
          </div>

          {/* Bottom Bar: Dash Boost & Live Leaderboard */}
          <div className="flex items-end justify-between gap-4">
            <button
              type="button"
              onClick={handleBoost}
              disabled={!isBoostReady}
              className={`pointer-events-auto min-h-[48px] min-w-[168px] rounded-xl border px-4 py-2.5 text-left backdrop-blur-md transition-all focus-visible:outline-2 focus-visible:outline-amber-400 ${
                isBoostReady
                  ? 'border-amber-400/80 bg-slate-900/92 text-slate-50 hover:bg-slate-800 cursor-pointer'
                  : 'border-slate-700/60 bg-slate-900/75 text-slate-400 cursor-not-allowed'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold whitespace-nowrap">
                  <Zap className={`h-4 w-4 ${isBoostReady ? 'text-amber-400' : 'text-slate-500'}`} />
                  Dash Boost
                </span>
                <span className="font-mono-tabular text-xs font-medium">
                  {isBoostReady ? 'Ready' : `${Math.round(hud.boostReadyRatio * 100)}%`}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                <div
                  className={`h-full transition-[width] duration-75 ${
                    isBoostReady ? 'bg-amber-400' : 'bg-slate-500'
                  }`}
                  style={{ width: `${Math.round(hud.boostReadyRatio * 100)}%` }}
                />
              </div>
            </button>

            {/* Real-Time Live Leaderboard */}
            <div className="mr-[112px] sm:mr-[154px] rounded-xl border border-slate-700/70 bg-slate-900/88 px-3.5 py-2.5 backdrop-blur-md shadow-lg">
              <div className="flex items-center justify-between gap-4 mb-1.5">
                <span className="text-[11px] font-semibold text-slate-300 whitespace-nowrap">
                  Live Leaderboard
                </span>
                <span className="font-mono-tabular text-[11px] text-slate-400 whitespace-nowrap">
                  You #{hud.rank}/{hud.totalContenders}
                </span>
              </div>
              <div className="space-y-1">
                {hud.standings.map((entry, idx) => (
                  <div
                    key={entry.id}
                    className={`flex items-center justify-between gap-4 text-xs rounded px-1.5 py-0.5 ${
                      entry.isPlayer
                        ? 'bg-amber-400/15 font-semibold text-amber-200'
                        : 'text-slate-300'
                    }`}
                  >
                    <span className="flex items-center gap-1.5 whitespace-nowrap">
                      <span className="font-mono-tabular text-slate-500 w-4">#{idx + 1}</span>
                      <span
                        className="inline-block h-2 w-2 rounded-full shrink-0"
                        style={{ backgroundColor: entry.color }}
                        aria-hidden="true"
                      />
                      <span>{entry.name}</span>
                      {idx === 0 && <Crown className="h-3 w-3 text-yellow-400 shrink-0" />}
                    </span>
                    <span className="flex items-center gap-2 font-mono-tabular text-[11px] text-slate-300">
                      <span>{entry.sizeMeters}m</span>
                      <span className="text-slate-500">·</span>
                      <span>{entry.score.toLocaleString()}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Title Menu Overlay (Retention & Meta-Progression Hub) */}
      {gameState === 'TITLE_MENU' && (
        <div className="fixed inset-0 overflow-y-auto flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-3xl rounded-2xl border border-slate-700/80 bg-slate-900/95 p-5 sm:p-7 shadow-2xl">
            {/* Top Bar: Brand + Persistent Gold Coins + Audio */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-xs font-medium text-amber-400">
                  2.5D Urban Arcade · {roundDurationSeconds}s Round · Best {progress.bestScore.toLocaleString()}
                </div>
                <h1 className="font-display mt-0.5 text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-50 text-balance">
                  Sinkhole Blitz
                </h1>
              </div>

              <div className="flex items-center gap-2.5">
                <div className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-amber-400/40 bg-slate-950 px-4 py-2 text-sm font-bold text-amber-300 whitespace-nowrap">
                  <Coins className="h-4 w-4 text-amber-400" />
                  <span className="font-mono-tabular">{progress.coins.toLocaleString()}</span>
                  <span className="text-xs font-medium text-slate-400">Coins</span>
                </div>
                <button
                  type="button"
                  onClick={handleToggleMute}
                  className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-2 text-xs font-semibold text-slate-200 transition-colors hover:border-slate-500 hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-amber-400 whitespace-nowrap shrink-0"
                >
                  {muted ? <VolumeX className="h-4 w-4 text-slate-400" /> : <Volume2 className="h-4 w-4 text-emerald-400" />}
                  <span>{muted ? 'Muted' : 'Audio'}</span>
                </button>
              </div>
            </div>

            {/* Active Mini-Quest Strip */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-950/75 px-4 py-2.5 text-xs">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-amber-400 shrink-0" />
                <span className="font-medium text-slate-400">Active Mission:</span>
                <span className="font-semibold text-slate-100">{progress.activeQuest.title}</span>
              </div>
              <span className="font-mono-tabular font-bold text-amber-300">
                Reward +{progress.activeQuest.rewardCoins} Coins
              </span>
            </div>

            {shopNotice && (
              <div className="mt-3 rounded-lg border border-amber-400/50 bg-amber-400/10 px-3 py-1.5 text-xs font-semibold text-amber-200">
                {shopNotice}
              </div>
            )}

            {/* 3 Permanent Upgrades */}
            <div className="mt-5">
              <div className="flex items-center justify-between mb-2.5">
                <h2 className="font-display text-sm font-bold text-slate-200">Permanent Upgrades</h2>
                <span className="text-xs text-slate-400">Saved automatically</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {UPGRADE_DEFS.map((upg) => {
                  const level = progress.upgrades[upg.key];
                  const cost = getUpgradeCost(upg.key, level);
                  const canAfford = cost !== null && progress.coins >= cost;
                  return (
                    <div
                      key={upg.key}
                      className="flex flex-col justify-between rounded-xl border border-slate-800 bg-slate-950/70 p-3.5"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-bold text-slate-100">{upg.label}</span>
                          <span className="font-mono-tabular text-xs font-semibold text-emerald-400">
                            Lv {level}/{upg.maxLevel}
                          </span>
                        </div>
                        <div className="mt-1 text-xs text-slate-400">{upg.effectText}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleBuyUpgrade(upg.key)}
                        disabled={cost === null}
                        className={`mt-3 inline-flex min-h-[38px] w-full items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors whitespace-nowrap ${
                          cost === null
                            ? 'bg-slate-800 text-slate-500 cursor-default'
                            : canAfford
                              ? 'bg-amber-400 text-slate-950 hover:bg-amber-300 cursor-pointer'
                              : 'border border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-500 cursor-pointer'
                        }`}
                      >
                        {cost === null ? (
                          <span>Max Level</span>
                        ) : (
                          <>
                            <Coins className="h-3.5 w-3.5" />
                            <span className="font-mono-tabular">{cost}</span>
                            <span>Upgrade</span>
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Hole Skins Shop (4 Unlockable Themes) */}
            <div className="mt-5">
              <div className="flex items-center justify-between mb-2.5">
                <h2 className="font-display text-sm font-bold text-slate-200">Hole Skins</h2>
                <span className="text-xs text-slate-400">Select or unlock theme</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {HOLE_SKINS.map((skin) => {
                  const unlocked = progress.unlockedSkins.includes(skin.id);
                  const equipped = progress.selectedSkin === skin.id;
                  return (
                    <button
                      key={skin.id}
                      type="button"
                      onClick={() => handleSelectOrBuySkin(skin.id)}
                      className={`flex flex-col items-start rounded-xl border p-3 text-left transition-colors cursor-pointer ${
                        equipped
                          ? 'border-amber-400 bg-amber-400/10'
                          : 'border-slate-800 bg-slate-950/70 hover:border-slate-600'
                      }`}
                    >
                      <div className="flex w-full items-center justify-between gap-2">
                        <span
                          className="inline-block h-6 w-6 rounded-full border-4 bg-slate-950 shrink-0"
                          style={{
                            borderColor: skin.primaryColor,
                            boxShadow: `0 0 0 2px ${skin.secondaryColor}66`,
                          }}
                          aria-hidden="true"
                        />
                        {equipped ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-300">
                            <Check className="h-3.5 w-3.5" />
                            Equipped
                          </span>
                        ) : unlocked ? (
                          <span className="text-[11px] font-semibold text-emerald-400">Unlocked</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 font-mono-tabular text-[11px] font-bold text-slate-300">
                            <Lock className="h-3 w-3 text-slate-400" />
                            {skin.cost}
                          </span>
                        )}
                      </div>
                      <div className="mt-2 text-xs font-bold text-slate-100">{skin.name}</div>
                      <div className="mt-0.5 text-[11px] text-slate-400 leading-snug">{skin.description}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Match Setup & Controls Row */}
            <div className="mt-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-slate-800 pt-4">
              <div className="flex flex-wrap items-center gap-4">
                <div>
                  <div className="text-[11px] font-medium text-slate-400 mb-1.5">Rival Holes</div>
                  <div className="inline-flex rounded-lg bg-slate-950 p-1 border border-slate-800">
                    {[3, 4, 5].map((count) => (
                      <button
                        key={count}
                        type="button"
                        onClick={() => setRivalCount(count)}
                        className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                          rivalCount === count ? 'bg-slate-800 text-slate-50' : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {count}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-[11px] font-medium text-slate-400 mb-1.5">Rival Pace</div>
                  <div className="inline-flex rounded-lg bg-slate-950 p-1 border border-slate-800">
                    {(['casual', 'standard', 'intense'] as DifficultyLevel[]).map((diff) => (
                      <button
                        key={diff}
                        type="button"
                        onClick={() => setDifficulty(diff)}
                        className={`px-2.5 py-1 text-xs font-semibold rounded-md capitalize transition-colors whitespace-nowrap ${
                          difficulty === diff ? 'bg-slate-800 text-slate-50' : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {diff}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="text-xs text-slate-400">
                Steer: <span className="text-slate-200 font-medium">Mouse/Touch or WASD</span> · Dash:{' '}
                <span className="text-slate-200 font-medium">Space</span>
              </div>
            </div>

            {/* Primary PLAY & Single-File HTML Export */}
            <div className="mt-5 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <button
                type="button"
                onClick={handleStartMatch}
                className="flex-1 inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-amber-400 px-6 py-3 font-display text-base font-extrabold tracking-wide text-slate-950 transition-colors hover:bg-amber-300 focus-visible:outline-2 focus-visible:outline-amber-200 whitespace-nowrap cursor-pointer"
              >
                <Play className="h-4 w-4 fill-current" />
                <span>PLAY ({roundDurationSeconds}s)</span>
              </button>

              <a
                href="/sinkhole-arcade.html"
                download="sinkhole-arcade.html"
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-3 text-sm font-semibold text-slate-200 transition-colors hover:border-slate-500 hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-amber-400 whitespace-nowrap"
              >
                <Download className="h-4 w-4 text-slate-300" />
                <span>Download Single-File HTML</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Pause Modal */}
      {gameState === 'PAUSED' && (
        <div className="fixed inset-0 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-slate-700/80 bg-slate-900 p-6 text-center shadow-2xl">
            <h2 className="font-display text-2xl font-bold text-slate-50">Match Paused</h2>
            <p className="mt-2 text-sm text-slate-400">
              {hud.timeRemaining.toFixed(1)}s remaining · Current size {hud.sizeMeters}m
            </p>
            <div className="mt-6 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={handleTogglePause}
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-amber-400 px-5 py-2.5 font-display text-sm font-bold text-slate-950 hover:bg-amber-300 whitespace-nowrap"
              >
                <Play className="h-4 w-4 fill-current" />
                <span>Resume Match</span>
              </button>
              <button
                type="button"
                onClick={handleStartMatch}
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-5 py-2.5 text-sm font-semibold text-slate-200 hover:bg-slate-700 whitespace-nowrap"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Restart Match</span>
              </button>
              <button
                type="button"
                onClick={handleReturnToMenu}
                className="inline-flex min-h-[44px] items-center justify-center rounded-xl px-5 py-2.5 text-sm font-medium text-slate-400 hover:text-slate-200 whitespace-nowrap"
              >
                Return to Start Menu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Post-Game Summary Modal */}
      {gameState === 'ROUND_SUMMARY' && (
        <div className="fixed inset-0 overflow-y-auto flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-2xl border border-slate-700/80 bg-slate-900 p-6 sm:p-7 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-medium text-amber-400">
                  Match Complete · {roundDurationSeconds}s Round
                </div>
                <h2 className="font-display mt-1 text-2xl sm:text-3xl font-extrabold text-slate-50">
                  {hud.rank === 1 ? 'Victory · #1 Hole in the City' : `Finished Rank #${hud.rank}`}
                </h2>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-400">Final Score</div>
                <div className="font-mono-tabular text-2xl font-bold text-amber-400">
                  {hud.score.toLocaleString()}
                </div>
              </div>
            </div>

            {/* Coins Earned & Persistent Balance */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-400/35 bg-amber-400/10 px-4 py-3">
              <div className="flex items-center gap-2.5">
                <Coins className="h-5 w-5 text-amber-400 shrink-0" />
                <div className="text-xs sm:text-sm">
                  <span className="font-bold text-amber-200">
                    +{(roundReward?.scoreCoins ?? hud.coinsEarnedFromScore).toLocaleString()} Coins
                  </span>
                  <span className="text-slate-300"> from score</span>
                  {(roundReward?.questBonus ?? 0) > 0 && (
                    <span className="font-bold text-emerald-300">
                      {' '}+ {roundReward?.questBonus} Quest Bonus
                    </span>
                  )}
                </div>
              </div>
              <div className="font-mono-tabular text-sm font-bold text-amber-300">
                Total: {progress.coins.toLocaleString()} Coins
              </div>
            </div>

            {/* Key Run Metrics */}
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 border-b border-slate-800 pb-4">
              <div>
                <div className="text-xs text-slate-400">Peak Size</div>
                <div className="font-mono-tabular text-lg font-bold text-slate-100">{hud.maxSizeMeters}m</div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Objects Eaten</div>
                <div className="font-mono-tabular text-lg font-bold text-slate-100">{hud.itemsSwallowed}</div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Max Combo</div>
                <div className="font-mono-tabular text-lg font-bold text-slate-100">×{maxComboMult.toFixed(1)}</div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Rivals Eaten</div>
                <div className="font-mono-tabular text-lg font-bold text-slate-100">{hud.rivalsSwallowed}</div>
              </div>
            </div>

            {/* Standings Table */}
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-xs text-slate-400">
                    <th className="py-2 font-medium">Contender</th>
                    <th className="py-2 text-right font-medium">Size</th>
                    <th className="py-2 text-right font-medium">Eaten</th>
                    <th className="py-2 text-right font-medium">Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {hud.standings.map((entry, idx) => (
                    <tr
                      key={entry.id}
                      className={entry.isPlayer ? 'bg-amber-400/10 font-semibold text-amber-200' : 'text-slate-300'}
                    >
                      <td className="py-2 pr-3">
                        <span className="inline-flex items-center gap-2 whitespace-nowrap">
                          <span className="font-mono-tabular text-xs text-slate-500 w-5">#{idx + 1}</span>
                          <span
                            className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: entry.color }}
                            aria-hidden="true"
                          />
                          <span>{entry.name}</span>
                        </span>
                      </td>
                      <td className="py-2 text-right font-mono-tabular">{entry.sizeMeters}m</td>
                      <td className="py-2 text-right font-mono-tabular">{entry.itemsSwallowed}</td>
                      <td className="py-2 text-right font-mono-tabular">{entry.score.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-6 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <button
                type="button"
                onClick={handleStartMatch}
                className="flex-1 inline-flex min-h-[46px] items-center justify-center gap-2 rounded-xl bg-amber-400 px-6 py-3 font-display text-base font-extrabold text-slate-950 transition-colors hover:bg-amber-300 whitespace-nowrap cursor-pointer"
              >
                <RotateCcw className="h-4 w-4" />
                <span>PLAY AGAIN</span>
              </button>
              <button
                type="button"
                onClick={handleReturnToMenu}
                className="inline-flex min-h-[46px] items-center justify-center rounded-xl border border-slate-700 bg-slate-800 px-5 py-3 text-sm font-semibold text-slate-200 hover:bg-slate-700 whitespace-nowrap cursor-pointer"
              >
                Start Menu & Shop
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
