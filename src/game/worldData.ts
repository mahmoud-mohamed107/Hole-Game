import type { ItemBlueprint, RimPattern, TierSpec, WorldItem } from './types';

export const WORLD_SIZE = 3200;
export const ROUND_DURATION = 60;
export const PIXELS_PER_METER = 13;

export const TIERS: TierSpec[] = [
  { tier: 1, name: 'Pothole', minRadius: 26, maxRadius: 40, accent: '#38BDF8' },
  { tier: 2, name: 'Sinkhole', minRadius: 40, maxRadius: 62, accent: '#10B981' },
  { tier: 3, name: 'Crater', minRadius: 62, maxRadius: 92, accent: '#F59E0B' },
  { tier: 4, name: 'Chasm', minRadius: 92, maxRadius: 135, accent: '#F97316' },
  { tier: 5, name: 'Abyss', minRadius: 135, maxRadius: 195, accent: '#EC4899' },
  { tier: 6, name: 'Singularity', minRadius: 195, maxRadius: 380, accent: '#A855F7' },
];

export function radiusToMeters(radius: number): number {
  return Number(((radius * 2) / PIXELS_PER_METER).toFixed(1));
}

export function getTierSpec(radius: number): TierSpec {
  for (let i = TIERS.length - 1; i >= 0; i--) {
    if (radius >= TIERS[i].minRadius) {
      return TIERS[i];
    }
  }
  return TIERS[0];
}

export const ITEM_BLUEPRINTS: Record<string, ItemBlueprint> = {
  cone: {
    key: 'cone',
    label: 'Traffic Cone',
    tier: 1,
    footprint: 9,
    requiredRadius: 22,
    height: 16,
    mass: 16,
    score: 20,
    shape: 'cone',
    wallColor: '#F97316',
    sideColor: '#C2410C',
    roofColor: '#FB923C',
    accentColor: '#F8FAFC',
  },
  hydrant: {
    key: 'hydrant',
    label: 'Fire Hydrant',
    tier: 1,
    footprint: 11,
    requiredRadius: 24,
    height: 20,
    mass: 22,
    score: 30,
    shape: 'hydrant',
    wallColor: '#EF4444',
    sideColor: '#B91C1C',
    roofColor: '#FCA5A5',
    accentColor: '#CBD5E1',
  },
  bin: {
    key: 'bin',
    label: 'Trash Bin',
    tier: 1,
    footprint: 13,
    requiredRadius: 26,
    height: 24,
    mass: 28,
    score: 40,
    shape: 'bin',
    wallColor: '#475569',
    sideColor: '#334155',
    roofColor: '#64748B',
    accentColor: '#10B981',
  },
  bench: {
    key: 'bench',
    label: 'Park Bench',
    tier: 1,
    footprint: 17,
    requiredRadius: 31,
    height: 18,
    mass: 42,
    score: 60,
    shape: 'bench',
    wallColor: '#B45309',
    sideColor: '#78350F',
    roofColor: '#D97706',
    accentColor: '#334155',
  },
  lamp: {
    key: 'lamp',
    label: 'Streetlamp',
    tier: 2,
    footprint: 18,
    requiredRadius: 38,
    height: 52,
    mass: 58,
    score: 90,
    shape: 'lamp',
    wallColor: '#334155',
    sideColor: '#1E293B',
    roofColor: '#FEF08A',
    accentColor: '#FACC15',
  },
  cart: {
    key: 'cart',
    label: 'Street Cart',
    tier: 2,
    footprint: 24,
    requiredRadius: 43,
    height: 30,
    mass: 85,
    score: 130,
    shape: 'cart',
    wallColor: '#F8FAFC',
    sideColor: '#CBD5E1',
    roofColor: '#EF4444',
    accentColor: '#F59E0B',
  },
  tree: {
    key: 'tree',
    label: 'Park Tree',
    tier: 2,
    footprint: 26,
    requiredRadius: 46,
    height: 56,
    mass: 95,
    score: 145,
    shape: 'tree',
    wallColor: '#22C55E',
    sideColor: '#15803D',
    roofColor: '#4ADE80',
    accentColor: '#78350F',
  },
  car: {
    key: 'car',
    label: 'City Sedan',
    tier: 3,
    footprint: 33,
    requiredRadius: 58,
    height: 26,
    mass: 165,
    score: 260,
    shape: 'car',
    wallColor: '#3B82F6',
    sideColor: '#1D4ED8',
    roofColor: '#60A5FA',
    accentColor: '#BAE6FD',
  },
  taxi: {
    key: 'taxi',
    label: 'Yellow Cab',
    tier: 3,
    footprint: 34,
    requiredRadius: 60,
    height: 26,
    mass: 175,
    score: 280,
    shape: 'car',
    wallColor: '#FACC15',
    sideColor: '#CA8A04',
    roofColor: '#FEF08A',
    accentColor: '#0F172A',
  },
  van: {
    key: 'van',
    label: 'Delivery Van',
    tier: 3,
    footprint: 40,
    requiredRadius: 68,
    height: 36,
    mass: 240,
    score: 360,
    shape: 'van',
    wallColor: '#F1F5F9',
    sideColor: '#94A3B8',
    roofColor: '#FFFFFF',
    accentColor: '#0EA5E9',
  },
  bus: {
    key: 'bus',
    label: 'Transit Bus',
    tier: 4,
    footprint: 52,
    requiredRadius: 88,
    height: 44,
    mass: 420,
    score: 620,
    shape: 'bus',
    wallColor: '#0284C7',
    sideColor: '#0369A1',
    roofColor: '#E0F2FE',
    accentColor: '#FACC15',
  },
  house: {
    key: 'house',
    label: 'Townhouse',
    tier: 4,
    footprint: 64,
    requiredRadius: 96,
    height: 76,
    mass: 640,
    score: 900,
    shape: 'house',
    wallColor: '#E2E8F0',
    sideColor: '#94A3B8',
    roofColor: '#B45309',
    accentColor: '#334155',
  },
  cafe: {
    key: 'cafe',
    label: 'Corner Cafe',
    tier: 4,
    footprint: 60,
    requiredRadius: 92,
    height: 64,
    mass: 560,
    score: 820,
    shape: 'house',
    wallColor: '#FEF3C7',
    sideColor: '#D97706',
    roofColor: '#DC2626',
    accentColor: '#1E293B',
  },
  office: {
    key: 'office',
    label: 'Office Block',
    tier: 5,
    footprint: 88,
    requiredRadius: 132,
    height: 130,
    mass: 1400,
    score: 1850,
    shape: 'office',
    wallColor: '#CBD5E1',
    sideColor: '#64748B',
    roofColor: '#E2E8F0',
    accentColor: '#38BDF8',
  },
  crane: {
    key: 'crane',
    label: 'Tower Crane',
    tier: 5,
    footprint: 84,
    requiredRadius: 128,
    height: 150,
    mass: 1280,
    score: 1700,
    shape: 'crane',
    wallColor: '#F59E0B',
    sideColor: '#B45309',
    roofColor: '#FBBF24',
    accentColor: '#1E293B',
  },
  skyscraper: {
    key: 'skyscraper',
    label: 'Glass Skyscraper',
    tier: 6,
    footprint: 118,
    requiredRadius: 176,
    height: 210,
    mass: 3200,
    score: 4200,
    shape: 'skyscraper',
    wallColor: '#38BDF8',
    sideColor: '#0284C7',
    roofColor: '#BAE6FD',
    accentColor: '#0F172A',
  },
  dome: {
    key: 'dome',
    label: 'Civic Dome',
    tier: 6,
    footprint: 128,
    requiredRadius: 188,
    height: 124,
    mass: 3600,
    score: 4800,
    shape: 'dome',
    wallColor: '#F8FAFC',
    sideColor: '#CBD5E1',
    roofColor: '#10B981',
    accentColor: '#065F46',
  },
};

export interface RivalProfile {
  name: string;
  color: string;
  pattern: RimPattern;
}

export const RIVAL_PROFILES: RivalProfile[] = [
  { name: 'Vortex', color: '#06B6D4', pattern: 'dashed' },
  { name: 'Maw', color: '#F43F5E', pattern: 'double' },
  { name: 'Umbra', color: '#8B5CF6', pattern: 'segmented' },
  { name: 'Trench', color: '#10B981', pattern: 'dotted' },
  { name: 'Quarry', color: '#F97316', pattern: 'chevron' },
];

export interface CityBlock {
  x: number;
  y: number;
  w: number;
  h: number;
  kind: 'park' | 'plaza' | 'midtown' | 'industrial' | 'downtown';
}

export const CITY_BLOCKS: CityBlock[] = (() => {
  const blocks: CityBlock[] = [];
  const margin = 180;
  const roadWidth = 130;
  const cols = 4;
  const rows = 4;
  const usable = WORLD_SIZE - margin * 2 - roadWidth * (cols - 1);
  const blockW = usable / cols;
  const blockH = usable / rows;

  const layout: CityBlock['kind'][][] = [
    ['park', 'midtown', 'midtown', 'industrial'],
    ['midtown', 'plaza', 'downtown', 'industrial'],
    ['park', 'downtown', 'plaza', 'midtown'],
    ['midtown', 'midtown', 'industrial', 'park'],
  ];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      blocks.push({
        x: margin + c * (blockW + roadWidth),
        y: margin + r * (blockH + roadWidth),
        w: blockW,
        h: blockH,
        kind: layout[r][c],
      });
    }
  }
  return blocks;
})();

function seededRandom(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function generateCityItems(seed = 42): WorldItem[] {
  const rand = seededRandom(seed);
  const items: WorldItem[] = [];
  let nextId = 1;

  const canPlace = (x: number, y: number, footprint: number): boolean => {
    if (x < 110 || x > WORLD_SIZE - 110 || y < 110 || y > WORLD_SIZE - 110) return false;
    for (let i = 0; i < items.length; i++) {
      const other = items[i];
      const minSep = footprint + other.blueprint.footprint + 10;
      const dx = x - other.x;
      const dy = y - other.y;
      if (dx * dx + dy * dy < minSep * minSep) return false;
    }
    return true;
  };

  const addItem = (key: string, x: number, y: number, rotation = 0) => {
    const bp = ITEM_BLUEPRINTS[key];
    if (!bp) return false;
    if (!canPlace(x, y, bp.footprint)) return false;
    items.push({
      id: nextId++,
      x,
      y,
      homeX: x,
      homeY: y,
      rotation,
      blueprint: bp,
      swallowState: 'idle',
      swallowProgress: 0,
      swallowedBy: null,
      tiltAngle: 0,
      spinAngle: 0,
      bumpTimer: 0,
      spawnScale: 1,
      respawnTimer: 0,
    });
    return true;
  };

  // 1. Place landmark skyscrapers, domes, offices, cranes, houses inside blocks
  for (const block of CITY_BLOCKS) {
    const cx = block.x + block.w * 0.5;
    const cy = block.y + block.h * 0.5;

    if (block.kind === 'downtown') {
      addItem('skyscraper', cx - 125, cy - 110, 0);
      addItem('skyscraper', cx + 125, cy + 105, 0);
      addItem('office', cx + 120, cy - 110, 0);
      addItem('office', cx - 125, cy + 105, 0);
      addItem('cafe', cx, cy, 0);
    } else if (block.kind === 'plaza') {
      addItem('dome', cx, cy, 0);
      addItem('cart', cx - 150, cy - 120, 0.2);
      addItem('cart', cx + 150, cy + 120, -0.2);
      addItem('bench', cx - 150, cy + 120, 0);
      addItem('bench', cx + 150, cy - 120, 0);
    } else if (block.kind === 'industrial') {
      addItem('crane', cx - 115, cy - 100, 0);
      addItem('office', cx + 120, cy + 105, 0);
      addItem('van', cx + 115, cy - 110, 0);
      addItem('van', cx - 115, cy + 110, 0);
      for (let i = 0; i < 8; i++) {
        addItem('cone', block.x + 50 + rand() * (block.w - 100), block.y + 50 + rand() * (block.h - 100));
      }
    } else if (block.kind === 'midtown') {
      addItem('office', cx - 115, cy - 105, 0);
      addItem('house', cx + 120, cy - 105, 0);
      addItem('house', cx - 115, cy + 110, 0);
      addItem('cafe', cx + 120, cy + 110, 0);
    } else if (block.kind === 'park') {
      for (let i = 0; i < 9; i++) {
        addItem('tree', block.x + 55 + rand() * (block.w - 110), block.y + 55 + rand() * (block.h - 110));
      }
      for (let i = 0; i < 6; i++) {
        addItem('bench', block.x + 45 + rand() * (block.w - 90), block.y + 45 + rand() * (block.h - 90));
      }
      addItem('cart', cx, cy, 0);
    }

    // Perimeter street furniture along sidewalks of every block
    const corners = [
      [block.x + 26, block.y + 26],
      [block.x + block.w - 26, block.y + 26],
      [block.x + 26, block.y + block.h - 26],
      [block.x + block.w - 26, block.y + block.h - 26],
    ];
    for (const [sx, sy] of corners) {
      addItem('lamp', sx, sy, 0);
    }

    const edgeProps = ['hydrant', 'bin', 'cone', 'bench', 'tree', 'lamp'];
    for (let i = 0; i < 10; i++) {
      const side = i % 4;
      let px = block.x + 30 + rand() * (block.w - 60);
      let py = block.y + 22;
      if (side === 1) py = block.y + block.h - 22;
      if (side === 2) {
        px = block.x + 22;
        py = block.y + 30 + rand() * (block.h - 60);
      }
      if (side === 3) {
        px = block.x + block.w - 22;
        py = block.y + 30 + rand() * (block.h - 60);
      }
      const pick = edgeProps[Math.floor(rand() * edgeProps.length)];
      addItem(pick, px, py, 0);
    }
  }

  // 2. Scatter vehicles along road corridors
  const roadCenters: number[] = [];
  const margin = 180;
  const roadWidth = 130;
  const usable = WORLD_SIZE - margin * 2 - roadWidth * 3;
  const blockSize = usable / 4;
  for (let i = 0; i < 3; i++) {
    roadCenters.push(margin + (i + 1) * blockSize + i * roadWidth + roadWidth * 0.5);
  }
  // Outer ring road
  roadCenters.push(105, WORLD_SIZE - 105);

  const vehicleKeys = ['car', 'taxi', 'van', 'bus'];
  for (const rc of roadCenters) {
    for (let pos = 180; pos < WORLD_SIZE - 180; pos += 165) {
      if (rand() < 0.72) {
        const key = vehicleKeys[Math.floor(rand() * vehicleKeys.length)];
        addItem(key, pos + (rand() - 0.5) * 40, rc + (rand() - 0.5) * 32, 0);
      }
      if (rand() < 0.72) {
        const key = vehicleKeys[Math.floor(rand() * vehicleKeys.length)];
        addItem(key, rc + (rand() - 0.5) * 32, pos + (rand() - 0.5) * 40, Math.PI * 0.5);
      }
    }
  }

  // 3. Fill abundant Tier 1 & Tier 2 starter items so early-game eating feels rapid and juicy
  const starterKeys = ['cone', 'cone', 'hydrant', 'bin', 'bench', 'lamp', 'cart', 'tree'];
  for (let i = 0; i < 240; i++) {
    const x = 140 + rand() * (WORLD_SIZE - 280);
    const y = 140 + rand() * (WORLD_SIZE - 280);
    const key = starterKeys[Math.floor(rand() * starterKeys.length)];
    addItem(key, x, y, (rand() - 0.5) * 0.4);
  }

  return items;
}
