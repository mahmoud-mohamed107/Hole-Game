import { AudioEngine } from './AudioEngine';
import { getDefaultProgress, getRoundDuration, getSkinById } from './progression';
import { Renderer, type CameraState } from './Renderer';
import {
  RIVAL_PROFILES,
  ROUND_DURATION,
  TIERS,
  WORLD_SIZE,
  generateCityItems,
  getTierSpec,
  radiusToMeters,
} from './worldData';
import type {
  FloatingText,
  GameState,
  HoleEntity,
  HudSnapshot,
  MatchOptions,
  Particle,
  Shockwave,
  SkinId,
  WorldItem,
} from './types';

const GROUND_SQUASH = 0.78;
const COMBO_WINDOW = 2.1;

export class GameEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private renderer = new Renderer();
  public audio = new AudioEngine();

  private state: GameState = 'TITLE_MENU';
  private options: MatchOptions = {
    rivalCount: 5,
    difficulty: 'standard',
    upgrades: getDefaultProgress().upgrades,
    skinId: 'classic',
    activeQuest: getDefaultProgress().activeQuest,
  };
  private rafId: number | null = null;
  private lastTimestamp = 0;
  private elapsedTime = 0;
  private timeRemaining = ROUND_DURATION;
  private lastCountdownSecond = 11;

  private holes: HoleEntity[] = [];
  private items: WorldItem[] = [];
  private particles: Particle[] = [];
  private shockwaves: Shockwave[] = [];
  private floatingTexts: FloatingText[] = [];

  private playerId = 'player';
  private maxPlayerSizeMeters = radiusToMeters(28);
  private eventBanner: string | null = null;
  private eventBannerTimer = 0;
  private questCompleted = false;
  private questRewardClaimed = false;
  private trailAccum = 0;

  private camera: CameraState = {
    x: WORLD_SIZE * 0.5,
    y: WORLD_SIZE * 0.5,
    zoom: 1,
    shakeX: 0,
    shakeY: 0,
  };
  private shakeIntensity = 0;

  // Input state
  private keys = new Set<string>();
  private pointerActive = false;
  private pointerClientX = 0;
  private pointerClientY = 0;

  private onHudUpdate: (snapshot: HudSnapshot) => void;
  private onStateChange: (state: GameState) => void;
  private onQuestReward?: (bonusCoins: number) => void;
  private onRoundComplete?: (finalScore: number, questCompleted: boolean) => void;
  private hudEmitAccum = 0;

  constructor(
    canvas: HTMLCanvasElement,
    onHudUpdate: (snapshot: HudSnapshot) => void,
    onStateChange: (state: GameState) => void,
    onQuestReward?: (bonusCoins: number) => void,
    onRoundComplete?: (finalScore: number, questCompleted: boolean) => void
  ) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Could not acquire 2D canvas context');
    }
    this.ctx = context;
    this.onHudUpdate = onHudUpdate;
    this.onStateChange = onStateChange;
    this.onQuestReward = onQuestReward;
    this.onRoundComplete = onRoundComplete;

    this.setupPreviewWorld();
    this.bindEvents();
    this.resize();
    this.startLoop();
  }

  private setupPreviewWorld(): void {
    this.items = generateCityItems(42);
    this.holes = [this.createHole('player', 'You', true, WORLD_SIZE * 0.5, WORLD_SIZE * 0.5, '#F59E0B', 'solid')];
    this.camera.x = WORLD_SIZE * 0.5;
    this.camera.y = WORLD_SIZE * 0.5;
    this.camera.zoom = 0.85;
  }

  private createHole(
    id: string,
    name: string,
    isPlayer: boolean,
    x: number,
    y: number,
    color: string,
    pattern: HoleEntity['pattern'],
    startRadius = 28,
    skinId?: SkinId
  ): HoleEntity {
    return {
      id,
      name,
      isPlayer,
      skinId,
      x,
      y,
      vx: 0,
      vy: 0,
      radius: startRadius,
      targetRadius: startRadius,
      mass: startRadius * startRadius,
      score: 0,
      tier: getTierSpec(startRadius).tier,
      color,
      pattern,
      boostTimer: 0,
      boostCooldown: 0,
      boostCooldownMax: 2.8,
      comboCount: 0,
      comboTimer: 0,
      maxCombo: 0,
      feverMeter: 0,
      feverTimer: 0,
      feverTriggers: 0,
      itemsSwallowed: 0,
      rivalsSwallowed: 0,
      respawnTimer: 0,
      aiTargetX: x,
      aiTargetY: y,
      aiDecisionTimer: 0,
      aiPersonality: 0.8 + Math.random() * 0.45,
      trail: [],
    };
  }

  public startMatch(options: MatchOptions): void {
    this.options = options;
    this.audio.unlock();
    this.items = generateCityItems(Math.floor(Math.random() * 9000) + 100);
    this.particles = [];
    this.shockwaves = [];
    this.floatingTexts = [];
    this.timeRemaining = getRoundDuration(options.upgrades);
    this.lastCountdownSecond = 11;
    this.shakeIntensity = 0;
    this.eventBanner = null;
    this.eventBannerTimer = 0;
    this.questCompleted = false;
    this.questRewardClaimed = false;
    this.trailAccum = 0;

    const playerStartRadius = Number((28 * (1 + 0.1 * options.upgrades.startingSize)).toFixed(2));
    this.maxPlayerSizeMeters = radiusToMeters(playerStartRadius);
    const skin = getSkinById(options.skinId);

    const spawnPoints = [
      [WORLD_SIZE * 0.5, WORLD_SIZE * 0.5],
      [720, 720],
      [WORLD_SIZE - 720, 720],
      [720, WORLD_SIZE - 720],
      [WORLD_SIZE - 720, WORLD_SIZE - 720],
      [WORLD_SIZE * 0.5, 580],
    ];

    this.holes = [
      this.createHole(
        this.playerId,
        'You',
        true,
        spawnPoints[0][0],
        spawnPoints[0][1],
        skin.primaryColor,
        'solid',
        playerStartRadius,
        options.skinId
      ),
    ];

    const count = Math.min(RIVAL_PROFILES.length, Math.max(1, options.rivalCount));
    for (let i = 0; i < count; i++) {
      const profile = RIVAL_PROFILES[i];
      const sp = spawnPoints[(i + 1) % spawnPoints.length];
      this.holes.push(
        this.createHole(
          `rival_${i}`,
          profile.name,
          false,
          sp[0] + (Math.random() - 0.5) * 120,
          sp[1] + (Math.random() - 0.5) * 120,
          profile.color,
          profile.pattern
        )
      );
    }

    this.camera.x = spawnPoints[0][0];
    this.camera.y = spawnPoints[0][1];
    this.camera.zoom = 1.05;

    this.setState('PLAYING');
    this.emitHud();
  }

  public togglePause(): void {
    if (this.state === 'PLAYING') {
      this.setState('PAUSED');
      this.audio.updateAmbient(false, 1, 0);
    } else if (this.state === 'PAUSED') {
      this.setState('PLAYING');
    }
  }

  public returnToMenu(): void {
    this.setupPreviewWorld();
    this.setState('TITLE_MENU');
    this.audio.updateAmbient(false, 1, 0);
  }

  public triggerPlayerBoost(): void {
    if (this.state !== 'PLAYING') return;
    this.audio.unlock();
    const player = this.holes.find((h) => h.id === this.playerId);
    if (!player || player.respawnTimer > 0) return;
    if (player.boostCooldown <= 0 && player.boostTimer <= 0) {
      player.boostTimer = 0.42;
      player.boostCooldown = player.boostCooldownMax;
      this.audio.playDash();
      this.spawnParticles(player.x, player.y, player.color, 14, 150);
    }
  }

  private setState(next: GameState): void {
    this.state = next;
    this.onStateChange(next);
  }

  private bindEvents(): void {
    window.addEventListener('resize', this.handleResize);
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    this.canvas.addEventListener('pointerdown', this.handlePointerDown);
    window.addEventListener('pointermove', this.handlePointerMove);
    window.addEventListener('pointerup', this.handlePointerUp);
    window.addEventListener('pointercancel', this.handlePointerUp);
  }

  public destroy(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    this.canvas.removeEventListener('pointerdown', this.handlePointerDown);
    window.removeEventListener('pointermove', this.handlePointerMove);
    window.removeEventListener('pointerup', this.handlePointerUp);
    window.removeEventListener('pointercancel', this.handlePointerUp);
    this.audio.destroy();
  }

  private handleResize = (): void => {
    this.resize();
  };

  public resize(): void {
    const parent = this.canvas.parentElement;
    const width = parent ? parent.clientWidth : window.innerWidth;
    const height = parent ? parent.clientHeight : window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.max(1, Math.floor(width * dpr));
    this.canvas.height = Math.max(1, Math.floor(height * dpr));
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    const code = e.code;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(code)) {
      if (this.state === 'PLAYING') {
        e.preventDefault();
      }
    }
    this.keys.add(code);

    if ((code === 'Space' || code === 'ShiftLeft' || code === 'ShiftRight') && this.state === 'PLAYING') {
      this.triggerPlayerBoost();
    } else if (code === 'Escape' || code === 'KeyP') {
      if (this.state === 'PLAYING' || this.state === 'PAUSED') {
        this.togglePause();
      }
    }
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };

  private handlePointerDown = (e: PointerEvent): void => {
    this.audio.unlock();
    this.pointerActive = true;
    this.pointerClientX = e.clientX;
    this.pointerClientY = e.clientY;
  };

  private handlePointerMove = (e: PointerEvent): void => {
    if (!this.pointerActive) return;
    this.pointerClientX = e.clientX;
    this.pointerClientY = e.clientY;
  };

  private handlePointerUp = (): void => {
    this.pointerActive = false;
  };

  private startLoop(): void {
    this.lastTimestamp = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - this.lastTimestamp) / 1000));
      this.lastTimestamp = now;
      this.update(dt);
      this.draw();
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  private update(dt: number): void {
    this.elapsedTime += dt;

    if (this.state === 'TITLE_MENU') {
      // Gentle scenic camera drift across city
      this.camera.x = WORLD_SIZE * 0.5 + Math.cos(this.elapsedTime * 0.14) * 320;
      this.camera.y = WORLD_SIZE * 0.5 + Math.sin(this.elapsedTime * 0.11) * 260;
      this.camera.zoom = 0.72;
      return;
    }

    if (this.state !== 'PLAYING') {
      return;
    }

    // Countdown timer
    this.timeRemaining = Math.max(0, this.timeRemaining - dt);
    const ceilSec = Math.ceil(this.timeRemaining);
    if (ceilSec <= 10 && ceilSec > 0 && ceilSec < this.lastCountdownSecond) {
      this.lastCountdownSecond = ceilSec;
      this.audio.playTimerTick(ceilSec <= 3);
    }

    if (this.timeRemaining <= 0) {
      this.audio.updateAmbient(false, 1, 0);
      this.audio.playRoundEnd();
      const player = this.holes.find((h) => h.id === this.playerId);
      this.evaluateQuestProgress();
      this.onRoundComplete?.(player ? player.score : 0, this.questCompleted);
      this.setState('ROUND_SUMMARY');
      this.emitHud();
      return;
    }

    if (this.eventBannerTimer > 0) {
      this.eventBannerTimer -= dt;
      if (this.eventBannerTimer <= 0) {
        this.eventBanner = null;
      }
    }

    // Update all holes (player input + AI steering + smooth size growth)
    for (const hole of this.holes) {
      if (hole.respawnTimer > 0) {
        hole.respawnTimer -= dt;
        if (hole.respawnTimer <= 0) {
          this.respawnHole(hole);
        }
        continue;
      }

      if (hole.boostTimer > 0) hole.boostTimer = Math.max(0, hole.boostTimer - dt);
      if (hole.boostCooldown > 0) hole.boostCooldown = Math.max(0, hole.boostCooldown - dt);
      if (hole.feverTimer > 0) {
        hole.feverTimer = Math.max(0, hole.feverTimer - dt);
      } else if (hole.comboTimer <= 0 && hole.feverMeter > 0) {
        hole.feverMeter = Math.max(0, hole.feverMeter - dt * 0.12);
      }

      if (hole.comboTimer > 0) {
        hole.comboTimer -= dt;
        if (hole.comboTimer <= 0) {
          hole.comboCount = 0;
        }
      }

      if (hole.isPlayer) {
        this.updatePlayerMovement(hole, dt);
      } else {
        this.updateRivalAI(hole, dt);
      }

      // Smooth radius growth
      hole.radius += (hole.targetRadius - hole.radius) * Math.min(1, dt * 8.5);

      // Keep inside world boundaries
      const pad = hole.radius + 14;
      hole.x = Math.max(pad, Math.min(WORLD_SIZE - pad, hole.x));
      hole.y = Math.max(pad, Math.min(WORLD_SIZE - pad, hole.y));

      // Boost or Fever glowing speed wake trail + particles
      const movingFast = Math.hypot(hole.vx, hole.vy) > 40;
      if (hole.feverTimer > 0 && movingFast) {
        this.trailAccum += dt;
        if (this.trailAccum >= 0.03) {
          this.trailAccum = 0;
          hole.trail.push({ x: hole.x, y: hole.y, r: hole.radius });
          if (hole.trail.length > 10) hole.trail.shift();
        }
        if (Math.random() < 0.85) {
          this.spawnParticles(
            hole.x - (hole.vx > 0 ? 1 : -1) * hole.radius * 0.35,
            hole.y,
            Math.random() < 0.5 ? '#F97316' : '#FDE047',
            2,
            85
          );
        }
      } else {
        if (hole.trail.length > 0) hole.trail.shift();
        if (hole.boostTimer > 0 && Math.random() < 0.65) {
          this.spawnParticles(hole.x, hole.y, hole.color, 1, 45);
        }
      }
    }

    // Update items (swallow suction animation, bump decay, gentle respawning)
    this.updateItems(dt);

    // Check Hole vs Item collisions (skill-based physical overlap)
    this.resolveHoleItemCollisions();

    // Check Hole vs Hole swallowing
    this.resolveHoleVsHoleCollisions();

    // Check Mini-Quest completion continuously
    this.evaluateQuestProgress();

    // Update FX
    this.updateEffects(dt);

    // Update Camera & Audio hum
    const player = this.holes.find((h) => h.id === this.playerId);
    if (player) {
      const m = radiusToMeters(player.radius);
      if (m > this.maxPlayerSizeMeters) {
        this.maxPlayerSizeMeters = m;
      }
      const targetZoom = Math.max(0.42, Math.min(1.06, 1.24 - Math.log2(player.radius / 22) * 0.24));
      this.camera.zoom += (targetZoom - this.camera.zoom) * Math.min(1, dt * 3.5);
      this.camera.x += (player.x - this.camera.x) * Math.min(1, dt * 7);
      this.camera.y += (player.y - this.camera.y) * Math.min(1, dt * 7);

      const speedMag = Math.hypot(player.vx, player.vy);
      this.audio.updateAmbient(player.respawnTimer <= 0, player.tier, Math.min(1, speedMag / 340));
    }

    // Screen shake decay
    if (this.shakeIntensity > 0.2) {
      this.camera.shakeX = (Math.random() * 2 - 1) * this.shakeIntensity;
      this.camera.shakeY = (Math.random() * 2 - 1) * this.shakeIntensity;
      this.shakeIntensity *= Math.pow(0.03, dt);
    } else {
      this.shakeIntensity = 0;
      this.camera.shakeX = 0;
      this.camera.shakeY = 0;
    }

    // Throttled HUD updates (~15Hz keeps React snappy without overhead)
    this.hudEmitAccum += dt;
    if (this.hudEmitAccum >= 0.065) {
      this.hudEmitAccum = 0;
      this.emitHud();
    }
  }

  private updatePlayerMovement(player: HoleEntity, dt: number): void {
    let dirX = 0;
    let dirY = 0;

    // Keyboard input
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) dirY -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) dirY += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) dirX -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) dirX += 1;

    // Mouse / Touch drag steering relative to player's screen position
    let speedFactor = 1;
    if (dirX === 0 && dirY === 0 && this.pointerActive) {
      const rect = this.canvas.getBoundingClientRect();
      const playerScreenX = rect.left + rect.width * 0.5 + (player.x - this.camera.x) * this.camera.zoom;
      const playerScreenY =
        rect.top + rect.height * 0.5 + (player.y - this.camera.y) * GROUND_SQUASH * this.camera.zoom;
      const dx = this.pointerClientX - playerScreenX;
      const dy = (this.pointerClientY - playerScreenY) / GROUND_SQUASH;
      const dist = Math.hypot(dx, dy);
      if (dist > 14) {
        dirX = dx / dist;
        dirY = dy / dist;
        speedFactor = Math.min(1, dist / 75);
      }
    } else if (dirX !== 0 || dirY !== 0) {
      const len = Math.hypot(dirX, dirY);
      dirX /= len;
      dirY /= len;
    }

    const speedUpgradeMult = 1 + 0.08 * this.options.upgrades.baseSpeed;
    const baseSpeed = (245 + Math.min(140, player.radius * 0.52)) * speedUpgradeMult;
    const boostMult = player.boostTimer > 0 ? 1.85 : 1;
    const feverMult = player.feverTimer > 0 ? 2.0 : 1;
    const targetVx = dirX * baseSpeed * speedFactor * boostMult * feverMult;
    const targetVy = dirY * baseSpeed * speedFactor * boostMult * feverMult;

    const accel = 1 - Math.exp(-11 * dt);
    player.vx += (targetVx - player.vx) * accel;
    player.vy += (targetVy - player.vy) * accel;
    player.x += player.vx * dt;
    player.y += player.vy * dt;
  }

  private updateRivalAI(rival: HoleEntity, dt: number): void {
    const diffMult =
      this.options.difficulty === 'casual' ? 0.78 : this.options.difficulty === 'intense' ? 1.12 : 0.94;

    rival.aiDecisionTimer -= dt;

    // Immediate threat check every frame
    let threat: HoleEntity | null = null;
    let closestThreatDist = Infinity;
    let prey: HoleEntity | null = null;
    let closestPreyDist = Infinity;

    for (const other of this.holes) {
      if (other.id === rival.id || other.respawnTimer > 0) continue;
      const d = Math.hypot(other.x - rival.x, other.y - rival.y);
      if (other.radius >= rival.radius * 1.14 && d < other.radius * 3.4 + 160 && d < closestThreatDist) {
        closestThreatDist = d;
        threat = other;
      } else if (rival.radius >= other.radius * 1.18 && d < 420 && d < closestPreyDist) {
        closestPreyDist = d;
        prey = other;
      }
    }

    if (threat) {
      const fx = rival.x - threat.x;
      const fy = rival.y - threat.y;
      const len = Math.max(1, Math.hypot(fx, fy));
      rival.aiTargetX = Math.max(160, Math.min(WORLD_SIZE - 160, rival.x + (fx / len) * 280));
      rival.aiTargetY = Math.max(160, Math.min(WORLD_SIZE - 160, rival.y + (fy / len) * 280));
      if (closestThreatDist < threat.radius + rival.radius + 95 && rival.boostCooldown <= 0) {
        rival.boostTimer = 0.36;
        rival.boostCooldown = rival.boostCooldownMax * 1.15;
      }
    } else if (prey && Math.random() < 0.85) {
      rival.aiTargetX = prey.x;
      rival.aiTargetY = prey.y;
      if (closestPreyDist < rival.radius * 2.4 && rival.boostCooldown <= 0 && this.options.difficulty !== 'casual') {
        rival.boostTimer = 0.34;
        rival.boostCooldown = rival.boostCooldownMax * 1.3;
      }
    } else if (rival.aiDecisionTimer <= 0) {
      rival.aiDecisionTimer = 0.45 + Math.random() * 0.45;
      let bestScore = -1;
      let bestX = WORLD_SIZE * 0.5;
      let bestY = WORLD_SIZE * 0.5;

      // Sample candidate edible items for fast, natural foraging
      for (let i = 0; i < 42; i++) {
        const idx = Math.floor(Math.random() * this.items.length);
        const item = this.items[idx];
        if (item.swallowState !== 'idle') continue;
        if (rival.radius < item.blueprint.requiredRadius) continue;
        const d = Math.hypot(item.x - rival.x, item.y - rival.y);
        const utility = (item.blueprint.mass * rival.aiPersonality) / (d + 70);
        if (utility > bestScore) {
          bestScore = utility;
          bestX = item.x;
          bestY = item.y;
        }
      }
      rival.aiTargetX = bestX;
      rival.aiTargetY = bestY;
    }

    const dx = rival.aiTargetX - rival.x;
    const dy = rival.aiTargetY - rival.y;
    const dist = Math.hypot(dx, dy);
    const baseSpeed = (225 + Math.min(130, rival.radius * 0.48)) * diffMult;
    const boostMult = rival.boostTimer > 0 ? 1.75 : 1;

    if (dist > 8) {
      const targetVx = (dx / dist) * baseSpeed * boostMult;
      const targetVy = (dy / dist) * baseSpeed * boostMult;
      const accel = 1 - Math.exp(-7.5 * dt);
      rival.vx += (targetVx - rival.vx) * accel;
      rival.vy += (targetVy - rival.vy) * accel;
    }

    rival.x += rival.vx * dt;
    rival.y += rival.vy * dt;
  }

  private updateItems(dt: number): void {
    for (let i = 0; i < this.items.length; i++) {
      const item = this.items[i];
      if (item.bumpTimer > 0) {
        item.bumpTimer = Math.max(0, item.bumpTimer - dt);
      }

      if (item.swallowState === 'idle') {
        if (item.spawnScale < 1) {
          item.spawnScale = Math.min(1, item.spawnScale + dt * 3.5);
        }
      } else if (item.swallowState === 'falling') {
        item.swallowProgress += dt * 4.2;
        const swallower = this.holes.find((h) => h.id === item.swallowedBy);
        if (swallower) {
          item.x += (swallower.x - item.x) * Math.min(1, dt * 11);
          item.y += (swallower.y - item.y) * Math.min(1, dt * 11);
          const dir = Math.sign(swallower.x - item.x || 1);
          item.tiltAngle += dir * dt * 2.8;
        }
        if (item.swallowProgress >= 1) {
          item.swallowState = 'gone';
          // Small & medium urban props respawn after a cooldown away from immediate start
          item.respawnTimer = item.blueprint.tier <= 3 ? 11 + Math.random() * 8 : 24 + Math.random() * 14;
        }
      } else if (item.swallowState === 'gone') {
        item.respawnTimer -= dt;
        if (item.respawnTimer <= 0) {
          // Only respawn if no active hole is sitting directly on top of home position
          const blocked = this.holes.some(
            (h) => h.respawnTimer <= 0 && Math.hypot(h.x - item.homeX, h.y - item.homeY) < h.radius + 70
          );
          if (!blocked) {
            item.x = item.homeX;
            item.y = item.homeY;
            item.tiltAngle = 0;
            item.swallowProgress = 0;
            item.swallowedBy = null;
            item.spawnScale = 0.05;
            item.swallowState = 'idle';
          } else {
            item.respawnTimer = 4;
          }
        }
      }
    }
  }

  private resolveHoleItemCollisions(): void {
    for (let i = 0; i < this.items.length; i++) {
      const item = this.items[i];
      if (item.swallowState !== 'idle' || item.spawnScale < 0.7) continue;

      for (let j = 0; j < this.holes.length; j++) {
        const hole = this.holes[j];
        if (hole.respawnTimer > 0) continue;

        const dx = item.x - hole.x;
        const dy = item.y - hole.y;
        const distSq = dx * dx + dy * dy;
        const edible = hole.radius >= item.blueprint.requiredRadius;

        if (edible) {
          // Skill-based capture only: zero wide-area magnetic suction; hole must physically move under object
          const captureRadius = hole.radius * 0.82;
          if (distSq < captureRadius * captureRadius) {
            this.swallowItem(hole, item);
            break;
          }
        } else {
          // Too large: soft physical bump feedback against hole edge
          const minDist = hole.radius + item.blueprint.footprint * 0.55;
          if (distSq < minDist * minDist && distSq > 0.01) {
            const dist = Math.sqrt(distSq);
            const overlap = minDist - dist;
            const nx = dx / dist;
            const ny = dy / dist;
            hole.x -= nx * overlap * 0.65;
            hole.y -= ny * overlap * 0.65;
            if (hole.isPlayer && item.bumpTimer <= 0) {
              item.bumpTimer = 0.35;
              this.audio.playBump();
            }
          }
        }
      }
    }
  }

  private swallowItem(hole: HoleEntity, item: WorldItem): void {
    item.swallowState = 'falling';
    item.swallowProgress = 0;
    item.swallowedBy = hole.id;

    // Combo tracking
    if (hole.comboTimer > 0) {
      hole.comboCount += 1;
    } else {
      hole.comboCount = 1;
    }
    hole.comboTimer = COMBO_WINDOW;
    if (hole.comboCount > hole.maxCombo) {
      hole.maxCombo = hole.comboCount;
    }

    const comboMult = 1 + Math.min(4, Math.floor((hole.comboCount - 1) / 3)) * 0.5;
    const points = Math.round(item.blueprint.score * comboMult);
    hole.score += points;
    hole.itemsSwallowed += 1;

    // Grow mass & target radius
    hole.mass += item.blueprint.mass * 1.65;
    hole.targetRadius = Math.min(360, Math.sqrt(hole.mass));

    const prevTier = hole.tier;
    const nextTierSpec = getTierSpec(hole.targetRadius);
    hole.tier = nextTierSpec.tier;

    this.spawnParticles(item.x, item.y, item.blueprint.wallColor, 6 + item.blueprint.tier * 2, 110);

    if (hole.isPlayer) {
      this.audio.playSwallow(item.blueprint.tier, hole.comboCount);
      if (hole.comboCount >= 2 && hole.comboCount % 2 === 0) {
        this.audio.playComboCue(hole.comboCount);
      }
      if (item.blueprint.tier >= 4) {
        this.shakeIntensity = Math.max(this.shakeIntensity, item.blueprint.tier * 2.2);
      }

      const comboSuffix = comboMult > 1 ? ` ×${comboMult.toFixed(1)}` : '';
      this.floatingTexts.push({
        x: item.x,
        y: item.y,
        z: 28,
        text: `+${points}${comboSuffix}`,
        color: comboMult > 1 ? '#FCD34D' : '#F8FAFC',
        life: 0,
        maxLife: 0.85,
        scale: item.blueprint.tier >= 4 ? 1.25 : 1,
      });

      if (hole.feverTimer <= 0) {
        hole.feverMeter = Math.min(1, hole.feverMeter + 0.13 + Math.min(0.07, (hole.comboCount - 1) * 0.01));
        if (hole.feverMeter >= 1) {
          hole.feverMeter = 0;
          hole.feverTimer = 5.0;
          hole.feverTriggers += 1;
          this.audio.playFeverStart();
          this.shakeIntensity = Math.max(this.shakeIntensity, 8);
          this.shockwaves.push({
            x: hole.x,
            y: hole.y,
            radius: hole.radius,
            maxRadius: hole.radius * 3.1,
            color: '#FDE047',
            life: 0,
            maxLife: 0.65,
          });
          this.eventBanner = 'Fever Mode Active · 2× Speed & Fiery Wake';
          this.eventBannerTimer = 2.6;
        }
      }

      if (hole.tier > prevTier) {
        this.audio.playTierUnlock(hole.tier);
        this.shakeIntensity = Math.max(this.shakeIntensity, 10);
        this.shockwaves.push({
          x: hole.x,
          y: hole.y,
          radius: hole.radius,
          maxRadius: hole.radius * 2.8,
          color: nextTierSpec.accent,
          life: 0,
          maxLife: 0.65,
        });
        this.eventBanner = `Tier ${nextTierSpec.tier} Unlocked · ${nextTierSpec.name}`;
        this.eventBannerTimer = 2.6;
      }
    }
  }

  private resolveHoleVsHoleCollisions(): void {
    for (let i = 0; i < this.holes.length; i++) {
      const a = this.holes[i];
      if (a.respawnTimer > 0) continue;

      for (let j = i + 1; j < this.holes.length; j++) {
        const b = this.holes[j];
        if (b.respawnTimer > 0) continue;

        const bigger = a.radius >= b.radius ? a : b;
        const smaller = a.radius >= b.radius ? b : a;
        const requiredRatio = !bigger.isPlayer && smaller.isPlayer ? 1.12 : 1.15;
        if (bigger.radius < smaller.radius * requiredRatio) continue;

        const dist = Math.hypot(bigger.x - smaller.x, bigger.y - smaller.y);
        // Bigger AI holes pull and swallow smaller player faster near the rim
        const captureDist = !bigger.isPlayer && smaller.isPlayer
          ? bigger.radius - smaller.radius * 0.1
          : bigger.radius - smaller.radius * 0.25;
        if (dist < captureDist) {
          // Consume smaller hole!
          const bonusPoints = 500 * smaller.tier;
          bigger.mass += smaller.mass * 0.55;
          bigger.targetRadius = Math.min(360, Math.sqrt(bigger.mass));
          bigger.score += bonusPoints;
          bigger.rivalsSwallowed += 1;
          bigger.tier = getTierSpec(bigger.targetRadius).tier;

          this.spawnParticles(smaller.x, smaller.y, smaller.color, 26, 200);
          this.shockwaves.push({
            x: bigger.x,
            y: bigger.y,
            radius: bigger.radius,
            maxRadius: bigger.radius * 2.3,
            color: bigger.color,
            life: 0,
            maxLife: 0.55,
          });

          if (bigger.isPlayer) {
            this.audio.playHeavyThud(0.5);
            this.audio.playTierUnlock(bigger.tier);
            this.shakeIntensity = Math.max(this.shakeIntensity, 14);
            this.floatingTexts.push({
              x: smaller.x,
              y: smaller.y,
              z: 36,
              text: `CONSUMED ${smaller.name.toUpperCase()} +${bonusPoints}`,
              color: '#34D399',
              life: 0,
              maxLife: 1.3,
              scale: 1.35,
            });
            this.eventBanner = `Consumed Rival ${smaller.name} (+${bonusPoints})`;
            this.eventBannerTimer = 2.4;
          } else if (smaller.isPlayer) {
            this.audio.playHeavyThud(0.55);
            this.shakeIntensity = 18;
            this.eventBanner = `Swallowed by ${bigger.name} — Reforming`;
            this.eventBannerTimer = 2.6;
          }

          smaller.respawnTimer = smaller.isPlayer ? 2.4 : 3.5;
        }
      }
    }
  }

  private respawnHole(hole: HoleEntity): void {
    // Restore at 78% of previous radius (minimum 28) in an open spot away from bigger threats
    const preservedRadius = Math.max(28, hole.radius * 0.78);
    hole.radius = preservedRadius;
    hole.targetRadius = preservedRadius;
    hole.mass = preservedRadius * preservedRadius;
    hole.tier = getTierSpec(preservedRadius).tier;
    hole.vx = 0;
    hole.vy = 0;

    let bestX = WORLD_SIZE * 0.5;
    let bestY = WORLD_SIZE * 0.5;
    let bestMinDist = -1;

    for (let attempt = 0; attempt < 16; attempt++) {
      const cx = 240 + Math.random() * (WORLD_SIZE - 480);
      const cy = 240 + Math.random() * (WORLD_SIZE - 480);
      let nearest = Infinity;
      for (const other of this.holes) {
        if (other.id === hole.id || other.respawnTimer > 0) continue;
        const d = Math.hypot(other.x - cx, other.y - cy);
        if (d < nearest) nearest = d;
      }
      if (nearest > bestMinDist) {
        bestMinDist = nearest;
        bestX = cx;
        bestY = cy;
      }
    }

    hole.x = bestX;
    hole.y = bestY;
    this.shockwaves.push({
      x: hole.x,
      y: hole.y,
      radius: 12,
      maxRadius: hole.radius * 1.9,
      color: hole.color,
      life: 0,
      maxLife: 0.45,
    });
  }

  private spawnParticles(x: number, y: number, color: string, count: number, speed: number): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = (0.35 + Math.random() * 0.85) * speed;
      this.particles.push({
        x,
        y,
        z: 6 + Math.random() * 14,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        vz: 45 + Math.random() * 95,
        size: 3 + Math.random() * 4,
        color,
        life: 0,
        maxLife: 0.32 + Math.random() * 0.25,
      });
    }
  }

  private updateEffects(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z = Math.max(0, p.z + p.vz * dt);
      p.vz -= 320 * dt;
    }

    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      sw.life += dt;
      if (sw.life >= sw.maxLife) {
        this.shockwaves.splice(i, 1);
        continue;
      }
      const p = sw.life / sw.maxLife;
      sw.radius += (sw.maxRadius - sw.radius) * Math.min(1, dt * 8 + p * 0.05);
    }

    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.life += dt;
      if (ft.life >= ft.maxLife) {
        this.floatingTexts.splice(i, 1);
        continue;
      }
      ft.z += 36 * dt;
    }
  }

  private draw(): void {
    const rect = this.canvas.getBoundingClientRect();
    this.renderer.render(
      this.ctx,
      rect.width || window.innerWidth,
      rect.height || window.innerHeight,
      this.camera,
      this.holes,
      this.items,
      this.particles,
      this.shockwaves,
      this.floatingTexts,
      this.playerId,
      this.elapsedTime
    );
  }

  private getQuestProgressValue(): number {
    const player = this.holes.find((h) => h.id === this.playerId);
    if (!player) return 0;

    const quest = this.options.activeQuest;
    if (quest.kind === 'eat_items') return player.itemsSwallowed;
    if (quest.kind === 'trigger_fever') return player.feverTriggers;
    if (quest.kind === 'eat_rival') return player.rivalsSwallowed;
    if (quest.kind === 'reach_size') return this.maxPlayerSizeMeters;
    if (quest.kind === 'reach_rank_1') {
      const sorted = [...this.holes].sort((a, b) => b.score - a.score || b.radius - a.radius);
      return sorted[0]?.id === player.id ? 1 : 0;
    }
    return 0;
  }

  private evaluateQuestProgress(): void {
    if (this.questCompleted) return;
    const progress = this.getQuestProgressValue();
    if (progress >= this.options.activeQuest.target) {
      this.questCompleted = true;
      if (!this.questRewardClaimed) {
        this.questRewardClaimed = true;
        const reward = this.options.activeQuest.rewardCoins;
        this.onQuestReward?.(reward);
        this.audio.playFeverStart();
        const player = this.holes.find((h) => h.id === this.playerId);
        if (player) {
          this.floatingTexts.push({
            x: player.x,
            y: player.y,
            z: 44,
            text: `QUEST COMPLETE +${reward} COINS`,
            color: '#FDE047',
            life: 0,
            maxLife: 1.5,
            scale: 1.35,
          });
        }
        this.eventBanner = `Mission Complete · +${reward} Bonus Coins!`;
        this.eventBannerTimer = 3.0;
      }
    }
  }

  private emitHud(): void {
    const player = this.holes.find((h) => h.id === this.playerId) || this.holes[0];
    if (!player) return;

    const tierSpec = getTierSpec(player.radius);
    const nextTier = TIERS.find((t) => t.tier === tierSpec.tier + 1) || null;
    const tierSpan = Math.max(1, tierSpec.maxRadius - tierSpec.minRadius);
    const tierProgress = nextTier
      ? Math.max(0, Math.min(1, (player.radius - tierSpec.minRadius) / tierSpan))
      : 1;

    const sorted = [...this.holes].sort((a, b) => b.score - a.score || b.radius - a.radius);
    const rank = sorted.findIndex((h) => h.id === player.id) + 1;

    this.onHudUpdate({
      timeRemaining: this.timeRemaining,
      score: player.score,
      sizeMeters: radiusToMeters(player.radius),
      tier: tierSpec.tier,
      tierName: tierSpec.name,
      tierProgress,
      nextTierMeters: nextTier ? radiusToMeters(nextTier.minRadius) : null,
      comboCount: player.comboCount,
      comboTimerRatio: Math.max(0, player.comboTimer / COMBO_WINDOW),
      feverMeter: player.feverMeter,
      feverTimer: player.feverTimer,
      isFeverActive: player.feverTimer > 0,
      boostReadyRatio:
        player.boostCooldown <= 0
          ? 1
          : Math.max(0, 1 - player.boostCooldown / player.boostCooldownMax),
      isBoosting: player.boostTimer > 0,
      isReforming: player.respawnTimer > 0,
      reformSeconds: Math.max(0, player.respawnTimer),
      rank,
      totalContenders: this.holes.length,
      itemsSwallowed: player.itemsSwallowed,
      rivalsSwallowed: player.rivalsSwallowed,
      maxCombo: player.maxCombo,
      maxSizeMeters: this.maxPlayerSizeMeters,
      standings: sorted.map((h) => ({
        id: h.id,
        name: h.name,
        isPlayer: h.isPlayer,
        color: h.color,
        score: h.score,
        sizeMeters: radiusToMeters(h.radius),
        tier: h.tier,
        itemsSwallowed: h.itemsSwallowed,
        rivalsSwallowed: h.rivalsSwallowed,
      })),
      eventBanner: this.eventBanner,
      questProgress: this.getQuestProgressValue(),
      questCompleted: this.questCompleted,
      questRewardClaimed: this.questRewardClaimed,
      coinsEarnedFromScore: Math.floor(player.score / 5),
    });
  }
}
