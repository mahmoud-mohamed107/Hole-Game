import { getSkinById } from './progression';
import { CITY_BLOCKS, WORLD_SIZE, radiusToMeters } from './worldData';
import type { FloatingText, HoleEntity, Particle, Shockwave, WorldItem } from './types';

const GROUND_SQUASH = 0.78;

export interface CameraState {
  x: number;
  y: number;
  zoom: number;
  shakeX: number;
  shakeY: number;
}

export class Renderer {
  public render(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    camera: CameraState,
    holes: HoleEntity[],
    items: WorldItem[],
    particles: Particle[],
    shockwaves: Shockwave[],
    floatingTexts: FloatingText[],
    playerId: string,
    elapsedTime: number
  ): void {
    // Deep outer ocean/void beyond the city perimeter
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.translate(width * 0.5 + camera.shakeX, height * 0.5 + camera.shakeY);
    ctx.scale(camera.zoom, camera.zoom);
    ctx.translate(-camera.x, -camera.y * GROUND_SQUASH);

    const viewHalfW = (width * 0.5) / camera.zoom + 260;
    const viewHalfH = (height * 0.5) / (camera.zoom * GROUND_SQUASH) + 260;
    const minX = camera.x - viewHalfW;
    const maxX = camera.x + viewHalfW;
    const minY = camera.y - viewHalfH;
    const maxY = camera.y + viewHalfH;

    // 1. City Ground & Roads
    this.drawGround(ctx, minX, maxX, minY, maxY);

    // 2. Ground Shockwaves
    for (const sw of shockwaves) {
      const alpha = Math.max(0, 1 - sw.life / sw.maxLife);
      ctx.save();
      ctx.strokeStyle = sw.color;
      ctx.globalAlpha = alpha * 0.75;
      ctx.lineWidth = 4 + (1 - alpha) * 4;
      ctx.beginPath();
      ctx.ellipse(sw.x, sw.y * GROUND_SQUASH, sw.radius, sw.radius * GROUND_SQUASH, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    const playerHole = holes.find((h) => h.id === playerId) || null;

    // 3. Sort active holes by radius (larger under or over, sorted by y for consistent draw)
    const activeHoles = holes
      .filter((h) => h.respawnTimer <= 0)
      .sort((a, b) => a.y - b.y);

    // Map falling items per hole so we can clip them cleanly inside each pit
    const fallingByHole = new Map<string, WorldItem[]>();
    const visibleIdleItems: WorldItem[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.swallowState === 'gone') continue;
      if (item.swallowState === 'falling' && item.swallowedBy) {
        let list = fallingByHole.get(item.swallowedBy);
        if (!list) {
          list = [];
          fallingByHole.set(item.swallowedBy, list);
        }
        list.push(item);
        continue;
      }
      if (
        item.x + item.blueprint.footprint < minX ||
        item.x - item.blueprint.footprint > maxX ||
        item.y + item.blueprint.footprint < minY ||
        item.y - item.blueprint.footprint - item.blueprint.height > maxY
      ) {
        continue;
      }
      visibleIdleItems.push(item);
    }

    // 4. Draw Ground Shadows of idle items first so holes cut through ground cleanly
    for (let i = 0; i < visibleIdleItems.length; i++) {
      this.drawItemShadow(ctx, visibleIdleItems[i]);
    }

    // 5. Draw 2.5D Holes + Clipped Falling Objects inside each hole
    let largestHoleId: string | null = null;
    let largestRadius = -1;
    for (const h of activeHoles) {
      if (h.radius > largestRadius) {
        largestRadius = h.radius;
        largestHoleId = h.id;
      }
    }

    for (const hole of activeHoles) {
      const falling = fallingByHole.get(hole.id) || [];
      this.drawHole(ctx, hole, falling, elapsedTime, hole.id === largestHoleId && activeHoles.length > 1);
    }

    // 6. Draw Standing 2.5D Items sorted by Y (painter's algorithm)
    visibleIdleItems.sort((a, b) => a.y - b.y);
    for (let i = 0; i < visibleIdleItems.length; i++) {
      const item = visibleIdleItems[i];
      this.drawItemAffordance(ctx, item, playerHole, elapsedTime);
      this.drawItem25D(ctx, item, 0, 0, 1);
    }

    // 7. Particles
    for (const p of particles) {
      const alpha = Math.max(0, 1 - p.life / p.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y * GROUND_SQUASH - p.z, p.size * (0.4 + 0.6 * alpha), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 8. Hole Name & Size Labels above/below holes
    for (const hole of activeHoles) {
      const labelY = hole.y * GROUND_SQUASH + hole.radius * GROUND_SQUASH + 18;
      ctx.save();
      ctx.font = '700 13px "Outfit", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const label = `${hole.name} · ${radiusToMeters(hole.radius)}m`;
      const textW = ctx.measureText(label).width;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
      this.roundRect(ctx, hole.x - textW * 0.5 - 8, labelY - 10, textW + 16, 20, 6);
      ctx.fill();
      ctx.strokeStyle = hole.color;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#F8FAFC';
      ctx.fillText(label, hole.x, labelY + 0.5);
      ctx.restore();
    }

    // 9. Floating Score & Event Texts
    for (const ft of floatingTexts) {
      const progress = ft.life / ft.maxLife;
      const alpha = progress < 0.7 ? 1 : Math.max(0, (1 - progress) / 0.3);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = `800 ${Math.round(16 * ft.scale)}px "Outfit", system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.strokeText(ft.text, ft.x, ft.y * GROUND_SQUASH - ft.z);
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, ft.x, ft.y * GROUND_SQUASH - ft.z);
      ctx.restore();
    }

    ctx.restore();

    // 10. Screen-Space Minimap (Bottom-Right)
    this.drawMinimap(ctx, width, height, holes, playerId);
  }

  private drawGround(ctx: CanvasRenderingContext2D, minX: number, maxX: number, minY: number, maxY: number): void {
    // Outer border hazard frame
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(-32, -32 * GROUND_SQUASH, WORLD_SIZE + 64, (WORLD_SIZE + 64) * GROUND_SQUASH);

    // City asphalt base
    ctx.fillStyle = '#334155';
    ctx.fillRect(0, 0, WORLD_SIZE, WORLD_SIZE * GROUND_SQUASH);

    // Subtle road grid lines & asphalt texture
    ctx.strokeStyle = 'rgba(248, 250, 252, 0.08)';
    ctx.lineWidth = 2;
    const step = 160;
    const startX = Math.max(0, Math.floor(minX / step) * step);
    const endX = Math.min(WORLD_SIZE, Math.ceil(maxX / step) * step);
    const startY = Math.max(0, Math.floor(minY / step) * step);
    const endY = Math.min(WORLD_SIZE, Math.ceil(maxY / step) * step);

    ctx.beginPath();
    for (let x = startX; x <= endX; x += step) {
      ctx.moveTo(x, startY * GROUND_SQUASH);
      ctx.lineTo(x, endY * GROUND_SQUASH);
    }
    for (let y = startY; y <= endY; y += step) {
      ctx.moveTo(startX, y * GROUND_SQUASH);
      ctx.lineTo(endX, y * GROUND_SQUASH);
    }
    ctx.stroke();

    // Dashed yellow centerlines along main avenues
    const margin = 180;
    const roadWidth = 130;
    const usable = WORLD_SIZE - margin * 2 - roadWidth * 3;
    const blockSize = usable / 4;

    ctx.save();
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.5)';
    ctx.lineWidth = 3;
    ctx.setLineDash([22, 18]);
    for (let i = 0; i < 3; i++) {
      const rc = margin + (i + 1) * blockSize + i * roadWidth + roadWidth * 0.5;
      ctx.beginPath();
      ctx.moveTo(80, rc * GROUND_SQUASH);
      ctx.lineTo(WORLD_SIZE - 80, rc * GROUND_SQUASH);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(rc, 80 * GROUND_SQUASH);
      ctx.lineTo(rc, (WORLD_SIZE - 80) * GROUND_SQUASH);
      ctx.stroke();
    }
    ctx.restore();

    // City Blocks (Sidewalks + District Fill)
    for (const block of CITY_BLOCKS) {
      if (block.x + block.w < minX || block.x > maxX || block.y + block.h < minY || block.y > maxY) {
        continue;
      }
      const by = block.y * GROUND_SQUASH;
      const bh = block.h * GROUND_SQUASH;

      // Curb shadow
      ctx.fillStyle = '#1E293B';
      this.roundRect(ctx, block.x - 4, by - 4, block.w + 8, bh + 10, 14);
      ctx.fill();

      // Sidewalk rim
      ctx.fillStyle = '#CBD5E1';
      this.roundRect(ctx, block.x, by, block.w, bh, 12);
      ctx.fill();

      // Inner district lot
      const pad = 22;
      let fill = '#E2E8F0';
      if (block.kind === 'park') fill = '#4D8B55';
      else if (block.kind === 'plaza') fill = '#E5E7EB';
      else if (block.kind === 'industrial') fill = '#94A3B8';
      else if (block.kind === 'downtown') fill = '#B8C4D4';
      else fill = '#D5DCE6';

      ctx.fillStyle = fill;
      this.roundRect(ctx, block.x + pad, by + pad * GROUND_SQUASH, block.w - pad * 2, bh - pad * 2 * GROUND_SQUASH, 8);
      ctx.fill();

      if (block.kind === 'plaza') {
        ctx.strokeStyle = 'rgba(100, 116, 139, 0.35)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(
          block.x + block.w * 0.5,
          by + bh * 0.5,
          block.w * 0.28,
          (bh * 0.28),
          0,
          0,
          Math.PI * 2
        );
        ctx.stroke();
      } else if (block.kind === 'park') {
        ctx.strokeStyle = 'rgba(226, 232, 240, 0.45)';
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.moveTo(block.x + pad + 10, by + bh * 0.5);
        ctx.lineTo(block.x + block.w - pad - 10, by + bh * 0.5);
        ctx.moveTo(block.x + block.w * 0.5, by + pad * GROUND_SQUASH + 10);
        ctx.lineTo(block.x + block.w * 0.5, by + bh - pad * GROUND_SQUASH - 10);
        ctx.stroke();
      }
    }

    // Arena Boundary Curb
    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 6;
    ctx.strokeRect(4, 4 * GROUND_SQUASH, WORLD_SIZE - 8, (WORLD_SIZE - 8) * GROUND_SQUASH);
  }

  private drawHole(
    ctx: CanvasRenderingContext2D,
    hole: HoleEntity,
    fallingItems: WorldItem[],
    elapsedTime: number,
    isLargest: boolean
  ): void {
    const cx = hole.x;
    const cy = hole.y * GROUND_SQUASH;
    const rx = hole.radius;
    const ry = hole.radius * GROUND_SQUASH;
    const inFever = hole.feverTimer > 0;
    const skin = hole.isPlayer ? getSkinById(hole.skinId ?? 'classic') : null;
    const baseColor = skin ? skin.primaryColor : hole.color;
    const rimColor = inFever ? '#FDE047' : baseColor;

    // Fever Mode glowing speed trail / wake behind the hole
    if (hole.trail.length > 1) {
      ctx.save();
      for (let i = 0; i < hole.trail.length; i++) {
        const pt = hole.trail[i];
        const alpha = ((i + 1) / hole.trail.length) * (inFever ? 0.34 : 0.16);
        ctx.strokeStyle = inFever ? '#F97316' : baseColor;
        ctx.globalAlpha = alpha;
        ctx.lineWidth = Math.max(2, pt.r * 0.14);
        ctx.beginPath();
        ctx.ellipse(
          pt.x,
          pt.y * GROUND_SQUASH,
          pt.r * (0.75 + 0.25 * (i / hole.trail.length)),
          pt.r * GROUND_SQUASH * (0.75 + 0.25 * (i / hole.trail.length)),
          0,
          0,
          Math.PI * 2
        );
        ctx.stroke();
      }
      ctx.restore();
    }

    // Fiery gold outer aura during Fever Mode (skill-based speed only, no magnet ring)
    if (inFever) {
      const pulse = 0.5 + 0.5 * Math.sin(elapsedTime * 14);
      ctx.save();
      ctx.strokeStyle = '#F97316';
      ctx.globalAlpha = 0.34 + pulse * 0.2;
      ctx.lineWidth = 14;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx + 11, ry + 9, 0, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = '#FDE047';
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx + 6, ry + 5, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    } else if (hole.boostTimer > 0) {
      ctx.save();
      ctx.strokeStyle = rimColor;
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx + 9, ry + 7, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Outer colored rim
    ctx.save();
    ctx.fillStyle = '#090D16';
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();

    // Inner 3D depth lip (customized by equipped player skin)
    const depthGrad = ctx.createRadialGradient(cx, cy + ry * 0.25, rx * 0.2, cx, cy, rx);
    depthGrad.addColorStop(0, '#020408');
    depthGrad.addColorStop(0.66, '#050811');
    depthGrad.addColorStop(0.9, skin ? skin.innerGlow : '#1E293B');
    depthGrad.addColorStop(1, '#334155');
    ctx.fillStyle = depthGrad;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx * 0.96, ry * 0.95, 0, 0, Math.PI * 2);
    ctx.fill();

    // Galaxy Vortex twinkling stars inside pit
    if (skin?.id === 'galaxy') {
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx * 0.92, ry * 0.92, 0, 0, Math.PI * 2);
      ctx.clip();
      for (let s = 0; s < 14; s++) {
        const ang = elapsedTime * 0.7 + s * 2.17;
        const distRatio = 0.2 + ((s * 37) % 65) / 100;
        const sx = cx + Math.cos(ang) * rx * distRatio;
        const sy = cy + Math.sin(ang) * ry * distRatio;
        ctx.fillStyle = s % 2 === 0 ? '#E0E7FF' : '#C084FC';
        ctx.globalAlpha = 0.45 + 0.45 * Math.sin(elapsedTime * 4 + s);
        ctx.beginPath();
        ctx.arc(sx, sy, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Subtle swirling abyss ring inside pit
    ctx.strokeStyle = skin ? `${skin.secondaryColor}38` : 'rgba(148, 163, 184, 0.14)';
    ctx.lineWidth = 2;
    ctx.setLineDash([rx * 0.45, rx * 0.35]);
    ctx.lineDashOffset = -elapsedTime * 55;
    ctx.beginPath();
    ctx.ellipse(cx, cy + ry * 0.08, rx * 0.65, ry * 0.65, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Clip falling objects to pit interior so they genuinely sink below ground!
    if (fallingItems.length > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx * 0.95, ry * 0.95, 0, 0, Math.PI * 2);
      ctx.clip();

      for (const item of fallingItems) {
        const p = item.swallowProgress;
        const sink = p * Math.min(rx * 1.15, 95);
        const scale = Math.max(0.1, 1 - p * 0.72);
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - Math.pow(p, 2.2));
        this.drawItem25D(ctx, item, sink, item.tiltAngle, scale);
        ctx.restore();
      }
      ctx.restore();
    }

    // Distinct patterned rim stroke (color + pattern + skin theme)
    ctx.strokeStyle = rimColor;
    ctx.lineWidth = Math.max(4, Math.min(9, rx * 0.09));
    if (hole.pattern === 'dashed') {
      ctx.setLineDash([14, 8]);
      ctx.lineDashOffset = elapsedTime * 28;
    } else if (hole.pattern === 'dotted') {
      ctx.setLineDash([4, 8]);
    } else if (hole.pattern === 'segmented') {
      ctx.setLineDash([24, 10]);
    }
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Secondary accent ring for Lava / Cyber / Galaxy skins or patterned rivals
    if (!inFever && skin && skin.id !== 'classic') {
      ctx.setLineDash(skin.id === 'cyber' ? [12, 8] : []);
      ctx.lineDashOffset = -elapsedTime * 32;
      ctx.strokeStyle = skin.secondaryColor;
      ctx.lineWidth = 2.5;
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx + 4, ry + 3.2, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.setLineDash([]);
    } else if (hole.pattern === 'double' || hole.pattern === 'chevron') {
      ctx.setLineDash(hole.pattern === 'chevron' ? [10, 10] : []);
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx + 5, ry + 4, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Circular Fever Energy Bar around the Player Hole
    if (hole.isPlayer) {
      const energyRatio = inFever ? Math.max(0, hole.feverTimer / 5) : Math.max(0, Math.min(1, hole.feverMeter));
      const barRx = rx + 11;
      const barRy = ry + 11 * GROUND_SQUASH;

      ctx.setLineDash([]);
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.45)';
      ctx.beginPath();
      ctx.ellipse(cx, cy, barRx, barRy, 0, 0, Math.PI * 2);
      ctx.stroke();

      if (energyRatio > 0.01) {
        ctx.strokeStyle = inFever ? '#FDE047' : '#F59E0B';
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.ellipse(
          cx,
          cy,
          barRx,
          barRy,
          0,
          -Math.PI * 0.5,
          -Math.PI * 0.5 + Math.PI * 2 * energyRatio
        );
        ctx.stroke();
      }
    }

    // Crown Tag above the largest active hole on the map
    if (isLargest) {
      const crownX = cx;
      const crownY = cy - ry - 22 + Math.sin(elapsedTime * 4) * 2.5;
      ctx.setLineDash([]);
      ctx.fillStyle = '#FACC15';
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(crownX - 12, crownY + 8);
      ctx.lineTo(crownX - 14, crownY - 6);
      ctx.lineTo(crownX - 6, crownY + 1);
      ctx.lineTo(crownX, crownY - 10);
      ctx.lineTo(crownX + 6, crownY + 1);
      ctx.lineTo(crownX + 14, crownY - 6);
      ctx.lineTo(crownX + 12, crownY + 8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    ctx.restore();
  }

  private drawItemShadow(ctx: CanvasRenderingContext2D, item: WorldItem): void {
    const bp = item.blueprint;
    const s = item.spawnScale;
    const gx = item.x;
    const gy = item.y * GROUND_SQUASH;
    const sx = bp.height * 0.36 * s;
    const sy = bp.height * 0.2 * s;

    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.26)';
    ctx.beginPath();
    ctx.ellipse(gx + sx * 0.55, gy + sy * 0.55, bp.footprint * 0.95 * s, bp.footprint * 0.72 * s, 0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawItemAffordance(
    ctx: CanvasRenderingContext2D,
    item: WorldItem,
    playerHole: HoleEntity | null,
    elapsedTime: number
  ): void {
    if (!playerHole || playerHole.respawnTimer > 0) return;

    const dx = item.x - playerHole.x;
    const dy = item.y - playerHole.y;
    const dist = Math.hypot(dx, dy);
    const edible = playerHole.radius >= item.blueprint.requiredRadius;

    if (edible) {
      if (dist < playerHole.radius * 2.3 + 120) {
        const pulse = 0.5 + 0.5 * Math.sin(elapsedTime * 6 + item.id);
        ctx.save();
        ctx.strokeStyle = 'rgba(16, 185, 129, 0.55)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(
          item.x,
          item.y * GROUND_SQUASH,
          (item.blueprint.footprint + 5 + pulse * 2) * item.spawnScale,
          (item.blueprint.footprint + 5 + pulse * 2) * GROUND_SQUASH * item.spawnScale,
          0,
          0,
          Math.PI * 2
        );
        ctx.stroke();
        ctx.restore();
      }
    } else if (item.bumpTimer > 0 || dist < playerHole.radius + item.blueprint.footprint + 44) {
      // Too big indicator when player gets close or bumps
      ctx.save();
      ctx.strokeStyle = item.bumpTimer > 0 ? '#EF4444' : 'rgba(245, 158, 11, 0.72)';
      ctx.lineWidth = item.bumpTimer > 0 ? 3 : 2;
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.ellipse(
        item.x,
        item.y * GROUND_SQUASH,
        (item.blueprint.footprint + 7) * item.spawnScale,
        (item.blueprint.footprint + 7) * GROUND_SQUASH * item.spawnScale,
        0,
        0,
        Math.PI * 2
      );
      ctx.stroke();
      ctx.setLineDash([]);

      const badgeY = item.y * GROUND_SQUASH - item.blueprint.height * item.spawnScale - 14;
      const reqText = `Need ${radiusToMeters(item.blueprint.requiredRadius)}m`;
      ctx.font = '700 11px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      const w = ctx.measureText(reqText).width + 12;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
      this.roundRect(ctx, item.x - w * 0.5, badgeY - 9, w, 18, 5);
      ctx.fill();
      ctx.fillStyle = item.bumpTimer > 0 ? '#FCA5A5' : '#FCD34D';
      ctx.fillText(reqText, item.x, badgeY + 4);
      ctx.restore();
    }
  }

  private drawItem25D(
    ctx: CanvasRenderingContext2D,
    item: WorldItem,
    sinkOffset: number,
    tiltAngle: number,
    extraScale: number
  ): void {
    const bp = item.blueprint;
    const s = item.spawnScale * extraScale;
    const gx = item.x;
    const gy = item.y * GROUND_SQUASH + sinkOffset;

    ctx.save();
    ctx.translate(gx, gy);
    if (tiltAngle !== 0) {
      ctx.rotate(tiltAngle);
    }
    if (item.bumpTimer > 0) {
      const wobble = Math.sin(item.bumpTimer * 40) * 0.08;
      ctx.rotate(wobble);
    }
    ctx.scale(s, s);

    const r = bp.footprint;
    const h = bp.height;

    switch (bp.shape) {
      case 'cone': {
        ctx.fillStyle = bp.sideColor;
        this.roundRect(ctx, -r, -4, r * 2, 7, 2);
        ctx.fill();
        ctx.fillStyle = bp.wallColor;
        ctx.beginPath();
        ctx.moveTo(-r * 0.72, 0);
        ctx.lineTo(0, -h);
        ctx.lineTo(r * 0.72, 0);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = bp.accentColor || '#FFF';
        ctx.fillRect(-r * 0.34, -h * 0.52, r * 0.68, h * 0.18);
        break;
      }

      case 'hydrant': {
        ctx.fillStyle = bp.sideColor;
        ctx.fillRect(-r * 0.45, -h * 0.8, r * 0.9, h * 0.8);
        ctx.fillStyle = bp.wallColor;
        ctx.fillRect(-r * 0.45, -h * 0.8, r * 0.55, h * 0.8);
        ctx.fillStyle = bp.accentColor || '#CBD5E1';
        ctx.fillRect(-r * 0.75, -h * 0.58, r * 1.5, h * 0.18);
        ctx.fillStyle = bp.roofColor;
        ctx.beginPath();
        ctx.arc(0, -h * 0.8, r * 0.45, Math.PI, 0);
        ctx.fill();
        break;
      }

      case 'bin': {
        this.drawBox25D(ctx, r * 1.4, r * 1.1, h, bp.wallColor, bp.sideColor, bp.roofColor);
        ctx.fillStyle = bp.accentColor || '#10B981';
        ctx.fillRect(-r * 0.45, -h * 0.65, r * 0.5, h * 0.25);
        break;
      }

      case 'bench': {
        this.drawBox25D(ctx, r * 1.8, r * 0.8, h * 0.55, bp.wallColor, bp.sideColor, bp.roofColor);
        ctx.fillStyle = bp.sideColor;
        ctx.fillRect(-r * 0.85, -h, r * 1.7, h * 0.38);
        break;
      }

      case 'lamp': {
        ctx.fillStyle = bp.sideColor;
        ctx.fillRect(-3, -h, 6, h);
        ctx.fillStyle = bp.wallColor;
        ctx.fillRect(-3, -h, 16, 4);
        ctx.fillStyle = bp.roofColor;
        ctx.beginPath();
        ctx.arc(11, -h + 4, 6, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'tree': {
        ctx.fillStyle = bp.accentColor || '#78350F';
        ctx.fillRect(-5, -h * 0.42, 10, h * 0.42);
        ctx.fillStyle = bp.sideColor;
        ctx.beginPath();
        ctx.arc(3, -h * 0.58, r * 0.92, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = bp.wallColor;
        ctx.beginPath();
        ctx.arc(-2, -h * 0.66, r * 0.85, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = bp.roofColor;
        ctx.beginPath();
        ctx.arc(-4, -h * 0.78, r * 0.58, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'cart': {
        this.drawBox25D(ctx, r * 1.7, r * 1.1, h * 0.52, bp.wallColor, bp.sideColor, '#E2E8F0');
        ctx.fillStyle = bp.roofColor;
        ctx.beginPath();
        ctx.moveTo(-r * 0.95, -h * 0.68);
        ctx.lineTo(0, -h);
        ctx.lineTo(r * 0.95, -h * 0.68);
        ctx.closePath();
        ctx.fill();
        break;
      }

      case 'car': {
        this.drawBox25D(ctx, r * 1.9, r * 1.05, h * 0.58, bp.wallColor, bp.sideColor, bp.roofColor);
        this.drawBox25D(ctx, r * 1.1, r * 0.85, h * 0.45, bp.accentColor || '#BAE6FD', bp.sideColor, bp.roofColor, h * 0.58);
        break;
      }

      case 'van': {
        this.drawBox25D(ctx, r * 1.9, r * 1.1, h, bp.wallColor, bp.sideColor, bp.roofColor);
        ctx.fillStyle = bp.accentColor || '#0EA5E9';
        ctx.fillRect(-r * 0.85, -h * 0.55, r * 1.15, h * 0.16);
        break;
      }

      case 'bus': {
        this.drawBox25D(ctx, r * 2.1, r * 1.0, h, bp.wallColor, bp.sideColor, bp.roofColor);
        ctx.fillStyle = '#BAE6FD';
        for (let w = -3; w <= 2; w++) {
          ctx.fillRect(w * 14 - 4, -h * 0.75, 10, h * 0.34);
        }
        ctx.fillStyle = bp.accentColor || '#FACC15';
        ctx.fillRect(-r * 0.95, -h * 0.25, r * 1.35, 5);
        break;
      }

      case 'house': {
        this.drawBox25D(ctx, r * 1.7, r * 1.35, h * 0.72, bp.wallColor, bp.sideColor, bp.roofColor);
        // Pitched gable roof
        ctx.fillStyle = bp.roofColor;
        ctx.beginPath();
        ctx.moveTo(-r * 0.92, -h * 0.72);
        ctx.lineTo(0, -h * 1.08);
        ctx.lineTo(r * 0.92, -h * 0.72);
        ctx.closePath();
        ctx.fill();
        // Windows
        ctx.fillStyle = bp.accentColor || '#334155';
        ctx.fillRect(-r * 0.65, -h * 0.52, 12, 14);
        ctx.fillRect(-r * 0.15, -h * 0.52, 12, 14);
        break;
      }

      case 'office': {
        this.drawBox25D(ctx, r * 1.7, r * 1.4, h, bp.wallColor, bp.sideColor, bp.roofColor);
        ctx.fillStyle = bp.accentColor || '#38BDF8';
        const rows = 4;
        for (let row = 0; row < rows; row++) {
          const wy = -h * (0.2 + row * 0.19);
          for (let col = -2; col <= 1; col++) {
            ctx.fillRect(col * 18 - 10, wy, 12, 12);
          }
        }
        break;
      }

      case 'crane': {
        ctx.fillStyle = bp.sideColor;
        ctx.fillRect(-10, -h, 20, h);
        ctx.fillStyle = bp.wallColor;
        ctx.fillRect(-10, -h, 11, h);
        // Boom arm
        ctx.fillStyle = bp.roofColor;
        ctx.fillRect(-r * 0.45, -h, r * 1.55, 12);
        ctx.fillStyle = bp.accentColor || '#1E293B';
        ctx.fillRect(-r * 0.45, -h - 6, 22, 18);
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(r * 0.85, -h + 12);
        ctx.lineTo(r * 0.85, -h * 0.45);
        ctx.stroke();
        break;
      }

      case 'skyscraper': {
        this.drawBox25D(ctx, r * 1.6, r * 1.35, h, bp.wallColor, bp.sideColor, bp.roofColor);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
        for (let row = 0; row < 7; row++) {
          const wy = -h * (0.14 + row * 0.12);
          ctx.fillRect(-r * 0.72, wy, r * 0.88, 9);
        }
        // Spire
        ctx.fillStyle = bp.accentColor || '#0F172A';
        ctx.fillRect(-3, -h - 28, 6, 28);
        break;
      }

      case 'dome': {
        this.drawBox25D(ctx, r * 1.8, r * 1.4, h * 0.48, bp.wallColor, bp.sideColor, bp.roofColor);
        ctx.fillStyle = bp.roofColor;
        ctx.beginPath();
        ctx.arc(0, -h * 0.48, r * 0.72, Math.PI, 0);
        ctx.fill();
        ctx.fillStyle = bp.accentColor || '#065F46';
        ctx.fillRect(-6, -h * 1.18, 12, 16);
        break;
      }
    }

    ctx.restore();
  }

  private drawBox25D(
    ctx: CanvasRenderingContext2D,
    w: number,
    d: number,
    h: number,
    frontColor: string,
    sideColor: string,
    roofColor: string,
    baseOffset = 0
  ): void {
    const hw = w * 0.5;
    const hd = d * 0.32;
    const split = w * 0.16;

    // Front-left lit face
    ctx.fillStyle = frontColor;
    ctx.beginPath();
    ctx.moveTo(-hw, -baseOffset);
    ctx.lineTo(split, -baseOffset + hd * 0.35);
    ctx.lineTo(split, -baseOffset - h + hd * 0.35);
    ctx.lineTo(-hw, -baseOffset - h);
    ctx.closePath();
    ctx.fill();

    // Right shaded face
    ctx.fillStyle = sideColor;
    ctx.beginPath();
    ctx.moveTo(split, -baseOffset + hd * 0.35);
    ctx.lineTo(hw, -baseOffset - hd * 0.25);
    ctx.lineTo(hw, -baseOffset - h - hd * 0.25);
    ctx.lineTo(split, -baseOffset - h + hd * 0.35);
    ctx.closePath();
    ctx.fill();

    // Roof top face
    ctx.fillStyle = roofColor;
    ctx.beginPath();
    ctx.moveTo(-hw, -baseOffset - h);
    ctx.lineTo(split, -baseOffset - h + hd * 0.35);
    ctx.lineTo(hw, -baseOffset - h - hd * 0.25);
    ctx.lineTo(-split, -baseOffset - h - hd * 0.6);
    ctx.closePath();
    ctx.fill();
  }

  private drawMinimap(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    holes: HoleEntity[],
    playerId: string
  ): void {
    const size = Math.min(132, Math.max(96, width * 0.12));
    const pad = 16;
    const mx = width - size - pad;
    const my = height - size - pad;

    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
    this.roundRect(ctx, mx, my, size, size, 10);
    ctx.fill();
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
    ctx.lineWidth = 1;
    ctx.stroke();

    const scale = size / WORLD_SIZE;
    for (const h of holes) {
      if (h.respawnTimer > 0) continue;
      const hx = mx + h.x * scale;
      const hy = my + h.y * scale;
      const hr = Math.max(3, Math.min(11, h.radius * scale * 1.4));

      ctx.fillStyle = h.color;
      ctx.beginPath();
      ctx.arc(hx, hy, hr, 0, Math.PI * 2);
      ctx.fill();

      if (h.id === playerId) {
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  private roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    const radius = Math.min(r, w * 0.5, h * 0.5);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }
}
