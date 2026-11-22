export type GameState = 'TITLE_MENU' | 'PLAYING' | 'PAUSED' | 'ROUND_SUMMARY';

export type DifficultyLevel = 'casual' | 'standard' | 'intense';

export type SkinId = 'classic' | 'lava' | 'cyber' | 'galaxy';

export interface HoleSkin {
  id: SkinId;
  name: string;
  description: string;
  cost: number;
  primaryColor: string;
  secondaryColor: string;
  innerGlow: string;
}

export type UpgradeKey = 'startingSize' | 'baseSpeed' | 'extraTime';

export interface UpgradeLevels {
  startingSize: number;
  baseSpeed: number;
  extraTime: number;
}

export type QuestKind = 'eat_items' | 'trigger_fever' | 'reach_rank_1' | 'reach_size' | 'eat_rival';

export interface MiniQuest {
  id: string;
  kind: QuestKind;
  title: string;
  target: number;
  rewardCoins: number;
}

export interface PlayerProgress {
  coins: number;
  upgrades: UpgradeLevels;
  unlockedSkins: SkinId[];
  selectedSkin: SkinId;
  activeQuest: MiniQuest;
  bestScore: number;
  roundsPlayed: number;
}

export interface MatchOptions {
  rivalCount: number;
  difficulty: DifficultyLevel;
  upgrades: UpgradeLevels;
  skinId: SkinId;
  activeQuest: MiniQuest;
}

export interface TierSpec {
  tier: number;
  name: string;
  minRadius: number;
  maxRadius: number;
  accent: string;
}

export type ItemShape =
  | 'cone'
  | 'hydrant'
  | 'bin'
  | 'bench'
  | 'lamp'
  | 'tree'
  | 'cart'
  | 'car'
  | 'van'
  | 'bus'
  | 'house'
  | 'office'
  | 'crane'
  | 'skyscraper'
  | 'dome';

export interface ItemBlueprint {
  key: string;
  label: string;
  tier: number;
  footprint: number;
  requiredRadius: number;
  height: number;
  mass: number;
  score: number;
  shape: ItemShape;
  wallColor: string;
  sideColor: string;
  roofColor: string;
  accentColor?: string;
}

export interface WorldItem {
  id: number;
  x: number;
  y: number;
  homeX: number;
  homeY: number;
  rotation: number;
  blueprint: ItemBlueprint;
  swallowState: 'idle' | 'falling' | 'gone';
  swallowProgress: number;
  swallowedBy: string | null;
  tiltAngle: number;
  spinAngle: number;
  bumpTimer: number;
  spawnScale: number;
  respawnTimer: number;
}

export type RimPattern = 'solid' | 'dashed' | 'double' | 'segmented' | 'dotted' | 'chevron';

export interface HoleEntity {
  id: string;
  name: string;
  isPlayer: boolean;
  skinId?: SkinId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  targetRadius: number;
  mass: number;
  score: number;
  tier: number;
  color: string;
  pattern: RimPattern;
  boostTimer: number;
  boostCooldown: number;
  boostCooldownMax: number;
  comboCount: number;
  comboTimer: number;
  maxCombo: number;
  feverMeter: number;
  feverTimer: number;
  feverTriggers: number;
  itemsSwallowed: number;
  rivalsSwallowed: number;
  respawnTimer: number;
  aiTargetX: number;
  aiTargetY: number;
  aiDecisionTimer: number;
  aiPersonality: number;
  trail: Array<{ x: number; y: number; r: number }>;
}

export interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  size: number;
  color: string;
  life: number;
  maxLife: number;
}

export interface FloatingText {
  x: number;
  y: number;
  z: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
  scale: number;
}

export interface Shockwave {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  color: string;
  life: number;
  maxLife: number;
}

export interface StandingEntry {
  id: string;
  name: string;
  isPlayer: boolean;
  color: string;
  score: number;
  sizeMeters: number;
  tier: number;
  itemsSwallowed: number;
  rivalsSwallowed: number;
}

export interface HudSnapshot {
  timeRemaining: number;
  score: number;
  sizeMeters: number;
  tier: number;
  tierName: string;
  tierProgress: number;
  nextTierMeters: number | null;
  comboCount: number;
  comboTimerRatio: number;
  feverMeter: number;
  feverTimer: number;
  isFeverActive: boolean;
  boostReadyRatio: number;
  isBoosting: boolean;
  isReforming: boolean;
  reformSeconds: number;
  rank: number;
  totalContenders: number;
  itemsSwallowed: number;
  rivalsSwallowed: number;
  maxCombo: number;
  maxSizeMeters: number;
  standings: StandingEntry[];
  eventBanner: string | null;
  questProgress: number;
  questCompleted: boolean;
  questRewardClaimed: boolean;
  coinsEarnedFromScore: number;
}
