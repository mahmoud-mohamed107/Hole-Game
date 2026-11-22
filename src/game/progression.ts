import type { HoleSkin, MiniQuest, PlayerProgress, SkinId, UpgradeKey, UpgradeLevels } from './types';

export const STORAGE_KEY = 'sinkhole_blitz_progress_v1';

export const HOLE_SKINS: HoleSkin[] = [
  {
    id: 'classic',
    name: 'Classic Void',
    description: 'Clean amber rim & pitch void',
    cost: 0,
    primaryColor: '#F59E0B',
    secondaryColor: '#FDE68A',
    innerGlow: '#1E293B',
  },
  {
    id: 'lava',
    name: 'Lava Core',
    description: 'Molten orange & crimson flare',
    cost: 150,
    primaryColor: '#F97316',
    secondaryColor: '#EF4444',
    innerGlow: '#7C2D12',
  },
  {
    id: 'cyber',
    name: 'Cyber Neon',
    description: 'Electric cyan & magenta ring',
    cost: 300,
    primaryColor: '#22D3EE',
    secondaryColor: '#E879F9',
    innerGlow: '#164E63',
  },
  {
    id: 'galaxy',
    name: 'Galaxy Vortex',
    description: 'Deep purple & starry abyss',
    cost: 500,
    primaryColor: '#A855F7',
    secondaryColor: '#818CF8',
    innerGlow: '#3B0764',
  },
];

export interface UpgradeDefinition {
  key: UpgradeKey;
  label: string;
  effectText: string;
  maxLevel: number;
  costs: number[];
}

export const UPGRADE_DEFS: UpgradeDefinition[] = [
  {
    key: 'startingSize',
    label: 'Starting Size',
    effectText: '+10% initial radius / lv',
    maxLevel: 5,
    costs: [50, 100, 200, 350, 550],
  },
  {
    key: 'baseSpeed',
    label: 'Base Speed',
    effectText: '+8% movement speed / lv',
    maxLevel: 5,
    costs: [50, 100, 200, 350, 550],
  },
  {
    key: 'extraTime',
    label: 'Extra Time',
    effectText: '+5s round timer / lv',
    maxLevel: 5,
    costs: [50, 100, 200, 350, 550],
  },
];

export const QUEST_POOL: Omit<MiniQuest, 'id'>[] = [
  { kind: 'eat_items', title: 'Eat 25 objects in one round', target: 25, rewardCoins: 150 },
  { kind: 'trigger_fever', title: 'Trigger Fever Mode 2 times', target: 2, rewardCoins: 150 },
  { kind: 'reach_rank_1', title: 'Reach Rank #1', target: 1, rewardCoins: 150 },
  { kind: 'eat_items', title: 'Eat 50 objects in one round', target: 50, rewardCoins: 150 },
  { kind: 'reach_size', title: 'Grow to 8.0m size', target: 8, rewardCoins: 150 },
  { kind: 'eat_rival', title: 'Consume 1 rival hole', target: 1, rewardCoins: 150 },
];

export function generateNextQuest(excludeTitle?: string): MiniQuest {
  const candidates = QUEST_POOL.filter((q) => q.title !== excludeTitle);
  const pick = candidates[Math.floor(Math.random() * candidates.length)] || QUEST_POOL[0];
  return {
    ...pick,
    id: `q_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
  };
}

export function getSkinById(id: SkinId): HoleSkin {
  return HOLE_SKINS.find((s) => s.id === id) || HOLE_SKINS[0];
}

export function getUpgradeCost(key: UpgradeKey, currentLevel: number): number | null {
  const def = UPGRADE_DEFS.find((u) => u.key === key);
  if (!def || currentLevel >= def.maxLevel) return null;
  return def.costs[currentLevel] ?? null;
}

export function getRoundDuration(upgrades: UpgradeLevels): number {
  return 60 + upgrades.extraTime * 5;
}

export function getDefaultProgress(): PlayerProgress {
  return {
    coins: 0,
    upgrades: {
      startingSize: 0,
      baseSpeed: 0,
      extraTime: 0,
    },
    unlockedSkins: ['classic'],
    selectedSkin: 'classic',
    activeQuest: { ...QUEST_POOL[0], id: 'q_initial' },
    bestScore: 0,
    roundsPlayed: 0,
  };
}

export function loadProgress(): PlayerProgress {
  const fallback = getDefaultProgress();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<PlayerProgress>;
    return {
      coins: typeof parsed.coins === 'number' && parsed.coins >= 0 ? Math.floor(parsed.coins) : 0,
      upgrades: {
        startingSize: Math.min(5, Math.max(0, parsed.upgrades?.startingSize ?? 0)),
        baseSpeed: Math.min(5, Math.max(0, parsed.upgrades?.baseSpeed ?? 0)),
        extraTime: Math.min(5, Math.max(0, parsed.upgrades?.extraTime ?? 0)),
      },
      unlockedSkins:
        Array.isArray(parsed.unlockedSkins) && parsed.unlockedSkins.length > 0
          ? Array.from(new Set<SkinId>(['classic', ...parsed.unlockedSkins]))
          : ['classic'],
      selectedSkin: parsed.selectedSkin ?? 'classic',
      activeQuest:
        parsed.activeQuest && parsed.activeQuest.title && parsed.activeQuest.target
          ? parsed.activeQuest
          : fallback.activeQuest,
      bestScore: typeof parsed.bestScore === 'number' ? parsed.bestScore : 0,
      roundsPlayed: typeof parsed.roundsPlayed === 'number' ? parsed.roundsPlayed : 0,
    };
  } catch {
    return fallback;
  }
}

export function saveProgress(progress: PlayerProgress): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Ignore storage quota / privacy mode errors
  }
}
