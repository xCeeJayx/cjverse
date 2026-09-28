import { createCanvas, loadImage, SKRSContext2D } from '@napi-rs/canvas';
import fs from 'node:fs';
import path from 'node:path';
import {
  CardEntity,
  calculateStats,
  calculatePowerScore,
  Variant,
} from '@cjverse/game-logic';
import { ELEMENT_COLORS, VARIANT_BORDER_COLORS } from './constants/theme';

export interface CardCompositeInput {
  id?: string;
  name?: string;
  race: string;
  variant: string;
  element: string;
  elementTier?: string;
  evolutionStage?: number;
  level?: number;
  powerScore?: number;
  role?: 'vanguard' | 'striker' | 'conduit';
  seed?: number;
}

const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 850;

/**
 * Resolves optional pre-rendered asset slices from disk if available.
 */
export function resolveAssetPath(
  assetDirectory: string,
  category: string,
  filename: string
): string | null {
  try {
    if (!assetDirectory) return null;

    const candidates = [
      path.resolve(assetDirectory, category, filename),
      path.resolve(process.cwd(), assetDirectory, category, filename),
      path.resolve(process.cwd(), 'apps/web/public/assets', category, filename),
      path.resolve(__dirname, '../../../../apps/web/public/assets', category, filename),
    ];

    for (const cand of candidates) {
      if (fs.existsSync(cand) && fs.statSync(cand).isFile() && fs.statSync(cand).size > 0) {
        return cand;
      }
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Determines card role from explicit parameter, or assigns based on race archetype.
 */
export function getCardRole(card: { role?: string; race?: string }): {
  role: string;
  icon: string;
  color: string;
} {
  const explicit = (card.role || '').toLowerCase();
  if (explicit === 'vanguard') return { role: 'Vanguard', icon: '🛡️', color: '#38bdf8' };
  if (explicit === 'striker') return { role: 'Striker', icon: '⚔️', color: '#f43f5e' };
  if (explicit === 'conduit') return { role: 'Conduit', icon: '🔮', color: '#c084fc' };

  const race = (card.race || '').toLowerCase();
  if (['orc', 'dragon', 'dwarf'].includes(race)) {
    return { role: 'Vanguard', icon: '🛡️', color: '#38bdf8' };
  }
  if (['human', 'troll', 'goblin'].includes(race)) {
    return { role: 'Striker', icon: '⚔️', color: '#f43f5e' };
  }
  return { role: 'Conduit', icon: '🔮', color: '#c084fc' };
}

/**
 * Renders a high-resolution, multi-layered card composite PNG.
 * Standard Resolution: 600 x 850 px
 */
export async function renderCardComposite(
  cardInput: CardCompositeInput,
  assetDirectory = 'apps/web/public/assets'
): Promise<Buffer> {
  const canvas = createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
  const ctx = canvas.getContext('2d');

  // Standardize card attributes
  const card: CardEntity = {
    id: cardInput.id || 'C00000',
    race: (cardInput.race || 'human') as any,
    variant: (cardInput.variant || 'normal') as any,
    element: cardInput.element || 'fire',
    elementTier: (cardInput.elementTier || 'C') as any,
    evolutionStage: Math.max(1, cardInput.evolutionStage ?? 1),
    level: Math.max(1, cardInput.level ?? 1),
    powerScore: cardInput.powerScore ?? 0,
    seed: cardInput.seed ?? 100,
  };

  // Compute calculated stats if powerScore was 0
  if (!card.powerScore) {
    card.powerScore = calculatePowerScore({
      race: card.race,
      variant: card.variant,
      elementTier: card.elementTier,
      evolutionStage: card.evolutionStage,
      level: card.level,
    });
  }

  const stats = calculateStats(card);
  const roleInfo = getCardRole(cardInput);

  // Check for pre-rendered slice assets
  const elementSlicePath = resolveAssetPath(
    assetDirectory,
    'elements',
    `${card.element.toLowerCase()}.png`
  );
  const raceSlicePath = resolveAssetPath(
    assetDirectory,
    'races',
    `${card.race.toLowerCase()}.png`
  );
  const frameSlicePath = resolveAssetPath(
    assetDirectory,
    'frames',
    `${card.variant.toLowerCase()}.png`
  );

  // ==========================================
  // LAYER 1: Background & Atmosphere
  // ==========================================
  let bgLoaded = false;
  if (elementSlicePath) {
    try {
      const img = await loadImage(elementSlicePath);
      ctx.drawImage(img, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      bgLoaded = true;
    } catch {
      bgLoaded = false;
    }
  }
  if (!bgLoaded) {
    renderProceduralAtmosphere(ctx, card);
  }

  // ==========================================
  // LAYER 3: Elemental Sigil & Runes (Behind Character)
  // ==========================================
  renderElementalSigil(ctx, card);

  // ==========================================
  // LAYER 2: Character Archetype Visual
  // ==========================================
  let charLoaded = false;
  if (raceSlicePath) {
    try {
      const img = await loadImage(raceSlicePath);
      ctx.drawImage(img, 100, 180, 400, 420);
      charLoaded = true;
    } catch {
      charLoaded = false;
    }
  }
  if (!charLoaded) {
    renderCharacterArchetype(ctx, card);
  }

  // ==========================================
  // LAYER 4: Ornate Border & Frame
  // ==========================================
  let frameLoaded = false;
  if (frameSlicePath) {
    try {
      const img = await loadImage(frameSlicePath);
      ctx.drawImage(img, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      frameLoaded = true;
    } catch {
      frameLoaded = false;
    }
  }
  if (!frameLoaded) {
    renderOrnateFrame(ctx, card);
  }

  // ==========================================
  // LAYER 5: Typography, Badges & Stats
  // ==========================================
  renderHeaderAndHUD(ctx, card, roleInfo);
  renderBottomStatRibbon(ctx, card, stats);

  return canvas.toBuffer('image/png');
}

// -------------------------------------------------------------
// Layer 1: Procedural Atmosphere
// -------------------------------------------------------------
function renderProceduralAtmosphere(
  ctx: SKRSContext2D,
  card: CardEntity
) {
  const elem = card.element.toLowerCase();
  const themeHex = ELEMENT_COLORS[elem] || '#3b82f6';

  // Base deep background gradient
  const bgGrad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
  bgGrad.addColorStop(0, '#030712');
  bgGrad.addColorStop(0.35, themeHex);
  bgGrad.addColorStop(0.7, '#0b0f19');
  bgGrad.addColorStop(1, '#020617');

  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Elemental texture specifics
  ctx.save();
  if (elem === 'fire' || elem === 'chaos') {
    // Magma textures & rising sparks
    for (let i = 0; i < 40; i++) {
      const x = ((card.seed * 37 + i * 97) % CANVAS_WIDTH);
      const y = ((card.seed * 19 + i * 113) % CANVAS_HEIGHT);
      const radius = 2 + (i % 5);
      ctx.fillStyle = i % 2 === 0 ? 'rgba(251, 146, 60, 0.4)' : 'rgba(239, 68, 68, 0.3)';
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (elem === 'ice' || elem === 'water') {
    // Frost crystal fractures
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 15; i++) {
      const x1 = (card.seed * 23 + i * 83) % CANVAS_WIDTH;
      const y1 = (card.seed * 41 + i * 127) % CANVAS_HEIGHT;
      const x2 = x1 + ((i * 17) % 80) - 40;
      const y2 = y1 + ((i * 31) % 80) - 40;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
  } else if (elem === 'void' || elem === 'cosmic' || elem === 'shadow') {
    // Cosmic dust nebula
    for (let i = 0; i < 50; i++) {
      const x = (card.seed * 53 + i * 67) % CANVAS_WIDTH;
      const y = (card.seed * 29 + i * 79) % CANVAS_HEIGHT;
      const r = (i % 4) + 1;
      ctx.fillStyle = 'rgba(224, 231, 255, 0.35)';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (elem === 'lightning') {
    // High-voltage electric branching
    ctx.strokeStyle = 'rgba(254, 240, 138, 0.25)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(300, 100);
    ctx.lineTo(260, 220);
    ctx.lineTo(340, 320);
    ctx.lineTo(280, 480);
    ctx.lineTo(320, 600);
    ctx.stroke();
  }
  ctx.restore();

  // Vignette overlay
  const vignette = ctx.createRadialGradient(
    CANVAS_WIDTH / 2,
    CANVAS_HEIGHT / 2,
    180,
    CANVAS_WIDTH / 2,
    CANVAS_HEIGHT / 2,
    450
  );
  vignette.addColorStop(0, 'transparent');
  vignette.addColorStop(1, 'rgba(0, 0, 0, 0.7)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
}

// -------------------------------------------------------------
// Layer 3: Elemental Sigil & Runes
// -------------------------------------------------------------
function renderElementalSigil(ctx: SKRSContext2D, card: CardEntity) {
  const centerX = CANVAS_WIDTH / 2;
  const centerY = 370;
  const elem = card.element.toLowerCase();
  const themeHex = ELEMENT_COLORS[elem] || '#38bdf8';

  ctx.save();

  // Floating radial aura
  const aura = ctx.createRadialGradient(centerX, centerY, 30, centerX, centerY, 210);
  aura.addColorStop(0, `${themeHex}66`);
  aura.addColorStop(0.5, `${themeHex}22`);
  aura.addColorStop(1, 'transparent');
  ctx.fillStyle = aura;
  ctx.beginPath();
  ctx.arc(centerX, centerY, 210, 0, Math.PI * 2);
  ctx.fill();

  // Outer runic ring
  ctx.strokeStyle = `${themeHex}88`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(centerX, centerY, 160, 0, Math.PI * 2);
  ctx.stroke();

  // Tick marks on runic ring
  for (let i = 0; i < 16; i++) {
    const angle = (i * Math.PI) / 8;
    const x1 = centerX + Math.cos(angle) * 155;
    const y1 = centerY + Math.sin(angle) * 155;
    const x2 = centerX + Math.cos(angle) * 165;
    const y2 = centerY + Math.sin(angle) * 165;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  // Inner circular emblem
  ctx.fillStyle = 'rgba(10, 15, 29, 0.75)';
  ctx.beginPath();
  ctx.arc(centerX, centerY, 135, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = themeHex;
  ctx.lineWidth = 3;
  ctx.stroke();

  // Central Elemental Glyph Icon
  const glyphs: Record<string, string> = {
    fire: '🔥',
    ice: '❄️',
    water: '💧',
    lightning: '⚡',
    earth: '🌿',
    nature: '🌿',
    arcane: '🔮',
    shadow: '🌑',
    void: '🌌',
    blood: '🩸',
    light: '✨',
    time: '⏳',
    cosmic: '🌠',
    chaos: '💥',
  };

  const symbol = glyphs[elem] || '✨';
  ctx.font = '84px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(symbol, centerX, centerY);

  ctx.restore();
}

// -------------------------------------------------------------
// Layer 2: Character Archetype Visual
// -------------------------------------------------------------
function renderCharacterArchetype(ctx: SKRSContext2D, card: CardEntity) {
  const centerX = CANVAS_WIDTH / 2;
  const baseY = 550;
  const race = (card.race || 'human').toLowerCase();
  const elem = card.element.toLowerCase();
  const elemColor = ELEMENT_COLORS[elem] || '#38bdf8';

  ctx.save();

  // Silhouette Drop Shadow
  ctx.shadowColor = elemColor;
  ctx.shadowBlur = 30;

  // Base Torso & Shoulders
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.moveTo(centerX - 130, baseY);
  ctx.lineTo(centerX - 100, baseY - 120);
  ctx.lineTo(centerX - 60, baseY - 150);
  ctx.lineTo(centerX + 60, baseY - 150);
  ctx.lineTo(centerX + 100, baseY - 120);
  ctx.lineTo(centerX + 130, baseY);
  ctx.closePath();
  ctx.fill();

  // Race-Specific Head & Crest
  ctx.fillStyle = '#1e293b';
  ctx.strokeStyle = elemColor;
  ctx.lineWidth = 3;

  if (race === 'dragon') {
    // Draconic Horns & Crest
    ctx.beginPath();
    ctx.moveTo(centerX - 40, baseY - 150);
    ctx.lineTo(centerX - 90, baseY - 240); // Left Horn
    ctx.lineTo(centerX - 40, baseY - 200);
    ctx.lineTo(centerX, baseY - 260); // Crown spike
    ctx.lineTo(centerX + 40, baseY - 200);
    ctx.lineTo(centerX + 90, baseY - 240); // Right Horn
    ctx.lineTo(centerX + 40, baseY - 150);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (race === 'elf') {
    // Elven Cowl & Pointed Ears
    ctx.beginPath();
    ctx.moveTo(centerX - 35, baseY - 150);
    ctx.lineTo(centerX - 75, baseY - 210); // Left Ear
    ctx.lineTo(centerX - 30, baseY - 200);
    ctx.lineTo(centerX, baseY - 235); // Cowl Tip
    ctx.lineTo(centerX + 30, baseY - 200);
    ctx.lineTo(centerX + 75, baseY - 210); // Right Ear
    ctx.lineTo(centerX + 35, baseY - 150);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (race === 'orc') {
    // Orcish Heavy Horned War-Helm
    ctx.beginPath();
    ctx.moveTo(centerX - 50, baseY - 150);
    ctx.lineTo(centerX - 80, baseY - 210);
    ctx.lineTo(centerX - 35, baseY - 220);
    ctx.lineTo(centerX, baseY - 235);
    ctx.lineTo(centerX + 35, baseY - 220);
    ctx.lineTo(centerX + 80, baseY - 210);
    ctx.lineTo(centerX + 50, baseY - 150);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (race === 'dwarf') {
    // Dwarven Angular Helm & Braided Guard
    ctx.beginPath();
    ctx.moveTo(centerX - 45, baseY - 150);
    ctx.lineTo(centerX - 60, baseY - 200);
    ctx.lineTo(centerX, baseY - 225);
    ctx.lineTo(centerX + 60, baseY - 200);
    ctx.lineTo(centerX + 45, baseY - 150);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else {
    // Standard Human / Knight Visage
    ctx.beginPath();
    ctx.moveTo(centerX - 35, baseY - 150);
    ctx.lineTo(centerX - 45, baseY - 200);
    ctx.lineTo(centerX, baseY - 230);
    ctx.lineTo(centerX + 45, baseY - 200);
    ctx.lineTo(centerX + 35, baseY - 150);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // Glowing Elemental Eye Slits
  ctx.fillStyle = elemColor;
  ctx.shadowColor = elemColor;
  ctx.shadowBlur = 15;

  ctx.beginPath();
  ctx.ellipse(centerX - 16, baseY - 185, 8, 3, -0.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse(centerX + 16, baseY - 185, 8, 3, 0.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// -------------------------------------------------------------
// Layer 4: Ornate Border & Frame
// -------------------------------------------------------------
function renderOrnateFrame(ctx: SKRSContext2D, card: CardEntity) {
  const variant = (card.variant || 'normal').toLowerCase();
  const margin = 18;
  const innerMargin = 30;

  ctx.save();

  if (variant === 'silver') {
    // Polished runic silver filigree with cyan highlights
    ctx.lineWidth = 14;
    ctx.strokeStyle = '#cbd5e1';
    ctx.strokeRect(margin, margin, CANVAS_WIDTH - margin * 2, CANVAS_HEIGHT - margin * 2);

    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#38bdf8';
    ctx.strokeRect(innerMargin, innerMargin, CANVAS_WIDTH - innerMargin * 2, CANVAS_HEIGHT - innerMargin * 2);

    // Silver Corner Gems
    drawCornerGem(ctx, margin + 4, margin + 4, '#38bdf8');
    drawCornerGem(ctx, CANVAS_WIDTH - margin - 4, margin + 4, '#38bdf8');
    drawCornerGem(ctx, margin + 4, CANVAS_HEIGHT - margin - 4, '#38bdf8');
    drawCornerGem(ctx, CANVAS_WIDTH - margin - 4, CANVAS_HEIGHT - margin - 4, '#38bdf8');
  } else if (variant === 'gold') {
    // Ornate gilded royal gold trim with ruby accents
    const goldGrad = ctx.createLinearGradient(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    goldGrad.addColorStop(0, '#fef08a');
    goldGrad.addColorStop(0.3, '#f59e0b');
    goldGrad.addColorStop(0.7, '#d97706');
    goldGrad.addColorStop(1, '#fbbf24');

    ctx.lineWidth = 16;
    ctx.strokeStyle = goldGrad;
    ctx.strokeRect(margin, margin, CANVAS_WIDTH - margin * 2, CANVAS_HEIGHT - margin * 2);

    ctx.lineWidth = 3;
    ctx.strokeStyle = '#fef08a';
    ctx.strokeRect(innerMargin, innerMargin, CANVAS_WIDTH - innerMargin * 2, CANVAS_HEIGHT - innerMargin * 2);

    // Ruby Corner Gems
    drawCornerGem(ctx, margin + 4, margin + 4, '#ef4444');
    drawCornerGem(ctx, CANVAS_WIDTH - margin - 4, margin + 4, '#ef4444');
    drawCornerGem(ctx, margin + 4, CANVAS_HEIGHT - margin - 4, '#ef4444');
    drawCornerGem(ctx, CANVAS_WIDTH - margin - 4, CANVAS_HEIGHT - margin - 4, '#ef4444');
  } else if (variant === 'diamond') {
    // Brilliant faceted prismatic crystal border
    const crystalGrad = ctx.createLinearGradient(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    crystalGrad.addColorStop(0, '#67e8f9');
    crystalGrad.addColorStop(0.5, '#a5f3fc');
    crystalGrad.addColorStop(1, '#06b6d4');

    ctx.lineWidth = 18;
    ctx.strokeStyle = crystalGrad;
    ctx.strokeRect(margin, margin, CANVAS_WIDTH - margin * 2, CANVAS_HEIGHT - margin * 2);

    ctx.lineWidth = 4;
    ctx.strokeStyle = '#ffffff';
    ctx.strokeRect(innerMargin, innerMargin, CANVAS_WIDTH - innerMargin * 2, CANVAS_HEIGHT - innerMargin * 2);

    // Prismatic Diamond Gems
    drawCornerGem(ctx, margin + 4, margin + 4, '#22d3ee');
    drawCornerGem(ctx, CANVAS_WIDTH - margin - 4, margin + 4, '#22d3ee');
    drawCornerGem(ctx, margin + 4, CANVAS_HEIGHT - margin - 4, '#22d3ee');
    drawCornerGem(ctx, CANVAS_WIDTH - margin - 4, CANVAS_HEIGHT - margin - 4, '#22d3ee');
  } else {
    // Normal: Weathered iron / slate border
    ctx.lineWidth = 14;
    ctx.strokeStyle = '#475569';
    ctx.strokeRect(margin, margin, CANVAS_WIDTH - margin * 2, CANVAS_HEIGHT - margin * 2);

    ctx.lineWidth = 2;
    ctx.strokeStyle = '#94a3b8';
    ctx.strokeRect(innerMargin, innerMargin, CANVAS_WIDTH - innerMargin * 2, CANVAS_HEIGHT - innerMargin * 2);

    // Iron Rivets in corners
    drawCornerRivet(ctx, margin + 6, margin + 6);
    drawCornerRivet(ctx, CANVAS_WIDTH - margin - 6, margin + 6);
    drawCornerRivet(ctx, margin + 6, CANVAS_HEIGHT - margin - 6);
    drawCornerRivet(ctx, CANVAS_WIDTH - margin - 6, CANVAS_HEIGHT - margin - 6);
  }

  ctx.restore();
}

function drawCornerGem(ctx: SKRSContext2D, x: number, y: number, color: string) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.moveTo(x, y - 8);
  ctx.lineTo(x + 8, y);
  ctx.lineTo(x, y + 8);
  ctx.lineTo(x - 8, y);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawCornerRivet(ctx: SKRSContext2D, x: number, y: number) {
  ctx.save();
  ctx.fillStyle = '#64748b';
  ctx.beginPath();
  ctx.arc(x, y, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// -------------------------------------------------------------
// Layer 5: Typography, Badges & Stats
// -------------------------------------------------------------
function renderHeaderAndHUD(
  ctx: SKRSContext2D,
  card: CardEntity,
  roleInfo: { role: string; icon: string; color: string }
) {
  ctx.save();

  // Top Bar Glass Plate
  ctx.fillStyle = 'rgba(10, 15, 29, 0.88)';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.lineWidth = 1.5;

  roundRect(ctx, 42, 42, 516, 68, 14);
  ctx.fill();
  ctx.stroke();

  // Role Badge (Left)
  ctx.fillStyle = `${roleInfo.color}33`;
  ctx.strokeStyle = roleInfo.color;
  ctx.lineWidth = 1.5;
  roundRect(ctx, 52, 52, 125, 48, 10);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${roleInfo.icon} ${roleInfo.role}`, 114, 76);

  // Card Name & Level (Center)
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 20px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`${card.variant.toUpperCase()} ${card.race.toUpperCase()}`, 190, 66);

  // Evolution Star Pips
  const stars = '⭐'.repeat(Math.min(3, card.evolutionStage));
  ctx.font = '13px sans-serif';
  ctx.fillStyle = '#facc15';
  ctx.fillText(`${stars} Lv. ${card.level}`, 190, 92);

  // High-Tech Card ID Pill (Top-Right)
  ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 1.5;
  roundRect(ctx, 450, 56, 96, 40, 8);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 14px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`#${card.id}`, 498, 76);

  ctx.restore();
}

function renderBottomStatRibbon(
  ctx: SKRSContext2D,
  card: CardEntity,
  stats: { maxHp: number; atk: number; def: number }
) {
  ctx.save();

  // Bottom Stat Ribbon Glass Plate
  ctx.fillStyle = 'rgba(10, 15, 29, 0.92)';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.lineWidth = 1.5;

  roundRect(ctx, 42, 690, 516, 115, 16);
  ctx.fill();
  ctx.stroke();

  // 4 Stat Columns (HP, ATK, DEF, PWR)
  const colWidth = 516 / 4;
  const startX = 42;
  const statY = 740;

  const statItems = [
    { label: 'HP', val: stats.maxHp, icon: '❤️', color: '#ef4444' },
    { label: 'ATK', val: stats.atk, icon: '⚔️', color: '#f59e0b' },
    { label: 'DEF', val: stats.def, icon: '🛡️', color: '#38bdf8' },
    { label: 'PWR', val: card.powerScore, icon: '⚡', color: '#10b981' },
  ];

  statItems.forEach((item, idx) => {
    const colCenterX = startX + colWidth * idx + colWidth / 2;

    // Stat Label with icon
    ctx.fillStyle = item.color;
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${item.icon} ${item.label}`, colCenterX, statY - 14);

    // Stat Value
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText(item.val.toLocaleString(), colCenterX, statY + 16);

    // Vertical Divider
    if (idx < 3) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(startX + colWidth * (idx + 1), statY - 25);
      ctx.lineTo(startX + colWidth * (idx + 1), statY + 35);
      ctx.stroke();
    }
  });

  // Element Sub-bar at very bottom
  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(
    `[ ELEMENT: ${card.element.toUpperCase()} • TIER ${card.elementTier} ]`,
    CANVAS_WIDTH / 2,
    790
  );

  ctx.restore();
}

/**
 * Utility to draw rounded rectangles
 */
function roundRect(
  ctx: SKRSContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}
