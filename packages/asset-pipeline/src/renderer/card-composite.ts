import { createCanvas, loadImage, SKRSContext2D } from '@napi-rs/canvas';
import fs from 'node:fs';
import path from 'node:path';
import {
  CardEntity,
  calculateStats,
  calculatePowerScore,
  Variant,
  ELEMENT_TO_TIER,
} from '@cjverse/game-logic';
import { ELEMENT_COLORS, VARIANT_BORDER_COLORS } from '../constants/theme';

export interface CardCompositeInput {
  id?: string;
  name?: string;
  race: string;
  gender?: 'male' | 'female' | string;
  variant: string;
  element: string;
  elementTier?: string;
  evolutionStage?: number;
  level?: number;
  powerScore?: number;
  role?: 'vanguard' | 'striker' | 'conduit';
  seed?: number;
}

export const CARD_WIDTH = 600;
export const CARD_HEIGHT = 850;
export const CANVAS_WIDTH = CARD_WIDTH;
export const CANVAS_HEIGHT = CARD_HEIGHT;
export const UNIFIED_HUD_X = 34;
export const UNIFIED_HUD_Y = 672;
export const UNIFIED_HUD_WIDTH = CARD_WIDTH - UNIFIED_HUD_X * 2; // 532
export const UNIFIED_HUD_HEIGHT = 136;

// Backward-compatibility aliases
export const STATS_BOX_Y = UNIFIED_HUD_Y;
export const STATS_BOX_HEIGHT = UNIFIED_HUD_HEIGHT;
export const NAME_BAR_HEIGHT = UNIFIED_HUD_HEIGHT;
export const NAME_BAR_GAP = 0;
export const NAME_BAR_Y = UNIFIED_HUD_Y;
export const HEADER_MARGIN_TOP = UNIFIED_HUD_Y;
export const HEADER_HEIGHT = UNIFIED_HUD_HEIGHT;

const loadedImageCache = new Map<string, any>();

// Warm up Skia engine and DirectWrite font rasterizer at module load time
try {
  const _warmup = createCanvas(1, 1);
  const _wctx = _warmup.getContext('2d');
  _wctx.font = '10px sans-serif';
  _wctx.fillText('cjverse', 0, 0);
  _warmup.toBuffer('image/png');
} catch {}

export async function getOrLoadImage(filePath: string): Promise<any> {
  const cached = loadedImageCache.get(filePath);
  if (cached) return cached;
  const img = await loadImage(filePath);
  loadedImageCache.set(filePath, img);
  return img;
}

/**
 * Attempt to locate an existing image slice file across common path structures
 */
export function resolveAssetPath(
  assetDirectory: string,
  category: string,
  filename: string
): string | null {
  try {
    const candidates: string[] = [];

    if (assetDirectory) {
      candidates.push(
        path.resolve(assetDirectory, category, filename),
        path.resolve(process.cwd(), assetDirectory, category, filename)
      );
    }

    candidates.push(
      path.resolve(__dirname, '../../assets', category, filename),
      path.resolve(process.cwd(), 'packages/asset-pipeline/assets', category, filename),
      path.resolve(process.cwd(), '../packages/asset-pipeline/assets', category, filename),
      path.resolve(process.cwd(), '../../packages/asset-pipeline/assets', category, filename),
      path.resolve(process.cwd(), 'public/assets', category, filename),
      path.resolve(process.cwd(), 'apps/web/public/assets', category, filename),
      path.resolve(__dirname, '../../../../apps/web/public/assets', category, filename)
    );

    const unique = [...new Set(candidates)];

    for (const cand of unique) {
      if (fs.existsSync(cand)) {
        try {
          const stat = fs.statSync(cand);
          if (stat.isFile() && stat.size > 0) {
            return cand;
          }
        } catch {}
      }
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Resolves pre-rendered card frame overlay path based on rarity variant:
 * 1. packages/asset-pipeline/assets/frames/frame_${rarity.toLowerCase()}.png
 * 2. Fallback to ${rarity.toLowerCase()}.png
 */
export function resolveFramePath(
  variant: string,
  assetDirectory = 'apps/web/public/assets'
): string | null {
  const v = (variant || 'normal').toLowerCase();
  return (
    resolveAssetPath(assetDirectory, 'frames', `frame_${v}.png`) ||
    resolveAssetPath(assetDirectory, 'frames', `${v}.png`)
  );
}

/**
 * In-memory cache for processed (chroma-keyed) frame canvases
 */
const keyedFrameCache = new Map<string, any>();

export function clearKeyedFrameCache(): void {
  keyedFrameCache.clear();
}

/**
 * Masks out the inner neon green (#00FF00) chroma key window from an AI-generated frame overlay.
 * Uses tolerance check so variations in compression, lighting, or antialiasing near #00FF00
 * are cleanly keyed out while preserving non-green border and HUD plate artwork.
 */
export function applyFrameChromaKey(
  frameImg: any,
  cacheKey?: string,
  targetWidth: number = CARD_WIDTH,
  targetHeight: number = CARD_HEIGHT
): any {
  if (cacheKey && keyedFrameCache.has(cacheKey)) {
    return keyedFrameCache.get(cacheKey);
  }

  const offscreen = createCanvas(targetWidth, targetHeight);
  const offCtx = offscreen.getContext('2d');
  offCtx.drawImage(frameImg, 0, 0, targetWidth, targetHeight);

  const imgData = offCtx.getImageData(0, 0, targetWidth, targetHeight);
  const data = imgData.data;
  let hasGreen = false;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];

    if (a === 0) continue;

    // Detect neon green (#00FF00) window pixels:
    // Pure green is (0, 255, 0).
    // Allow slight compression/antialiasing: g is high, significantly exceeds r and b
    if (g > 150 && r < 120 && b < 120 && g > r * 1.5 && g > b * 1.5) {
      data[i + 3] = 0; // Set alpha to 0 (fully transparent)
      hasGreen = true;
    }
  }

  if (hasGreen) {
    offCtx.putImageData(imgData, 0, 0);
  }

  if (cacheKey) {
    keyedFrameCache.set(cacheKey, offscreen);
  }

  return offscreen;
}

/**
 * Resolves character artwork path based on the exact fallback cascade:
 * 1. packages/asset-pipeline/assets/characters/${card.race}/${card.race}_${card.gender}_${card.element}.png
 * 2. packages/asset-pipeline/assets/characters/${card.race}_${card.gender}_${card.element}.png
 * 3. Neutral element fallback: packages/asset-pipeline/assets/characters/${card.race}/${card.race}_${card.gender}.png
 * 4. Base race fallback: packages/asset-pipeline/assets/characters/${card.race}.png
 * 5. Procedural canvas fallback if no file exists (returns null).
 */
export function resolveCharacterArtworkPath(
  race: string,
  gender: string = 'male',
  element: string,
  assetDirectory?: string
): string | null {
  const r = (race || 'human').toLowerCase();
  const g = (gender || 'male').toLowerCase();
  const e = (element || 'fire').toLowerCase();

  // Cascade list in order of priority:
  const relativeCascade: string[] = [
    `${r}/${r}_${g}_${e}.png`,
    `${r}_${g}_${e}.png`,
    `${r}/${r}_${g}.png`,
    `${r}_${g}.png`,
    `${r}.png`,
    `${r}/${r}.png`,
  ];

  for (const relPath of relativeCascade) {
    const candidates: string[] = [];

    if (assetDirectory) {
      candidates.push(
        path.resolve(assetDirectory, 'characters', relPath),
        path.resolve(process.cwd(), assetDirectory, 'characters', relPath),
        path.resolve(assetDirectory, relPath),
        path.resolve(process.cwd(), assetDirectory, relPath)
      );
    }

    candidates.push(
      path.resolve(__dirname, '../../assets/characters', relPath),
      path.resolve(process.cwd(), 'packages/asset-pipeline/assets/characters', relPath),
      path.resolve(process.cwd(), '../packages/asset-pipeline/assets/characters', relPath),
      path.resolve(process.cwd(), '../../packages/asset-pipeline/assets/characters', relPath),
      path.resolve(__dirname, '../assets/characters', relPath),
      path.resolve(process.cwd(), 'assets/characters', relPath),
      path.resolve(process.cwd(), 'public/assets/characters', relPath),
      path.resolve(process.cwd(), 'apps/web/public/assets/characters', relPath)
    );

    const uniqueCandidates = [...new Set(candidates)];

    for (const cand of uniqueCandidates) {
      if (fs.existsSync(cand)) {
        try {
          const stat = fs.statSync(cand);
          if (stat.isFile() && stat.size > 0) {
            return cand;
          }
        } catch {}
      }
    }
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
  if (explicit === 'vanguard') return { role: 'Vanguard', icon: '◈', color: '#38bdf8' };
  if (explicit === 'striker') return { role: 'Striker', icon: '◆', color: '#f43f5e' };
  if (explicit === 'conduit') return { role: 'Conduit', icon: '❖', color: '#c084fc' };

  const race = (card.race || '').toLowerCase();
  if (['orc', 'dragon', 'dwarf'].includes(race)) {
    return { role: 'Vanguard', icon: '◈', color: '#38bdf8' };
  }
  if (['human', 'troll', 'goblin'].includes(race)) {
    return { role: 'Striker', icon: '◆', color: '#f43f5e' };
  }
  return { role: 'Conduit', icon: '❖', color: '#c084fc' };
}

/**
 * Renders a full-bleed, multi-layered card composite PNG.
 * Standard Resolution: 600 x 850 px
 *
 * Layer order:
 * 1. Solid dark base background (#0a0c10).
 * 2. Character Art (drawn with full-bleed cover covering 0, 0, width, height).
 * 3. Subtle top/bottom dark gradient overlays (to ensure text legibility).
 * 4. Card Rarity Border / Frame overlay (Normal, Silver, Gold, Diamond).
 * 5. Header UI (Card Name, Sub-type badge, Level, Card ID).
 * 6. Footer UI (HP, ATK, DEF, PWR stats box, Element & Tier tag).
 */
export async function renderCard(
  cardInput: CardCompositeInput | CardEntity,
  assetDirectory = 'apps/web/public/assets'
): Promise<Buffer> {
  const canvas = createCanvas(CARD_WIDTH, CARD_HEIGHT);
  const ctx = canvas.getContext('2d');

  // Standardize card attributes
  const cardId = cardInput.id || 'C00000';
  const evolutionStage = Math.max(1, cardInput.evolutionStage ?? 1);
  const level = Math.max(1, cardInput.level ?? 1);
  const variant = (cardInput.variant || 'normal').toLowerCase();
  const race = (cardInput.race || 'human').toLowerCase();
  const element = (cardInput.element || 'fire').toLowerCase();
  const rawTier = (cardInput.elementTier || '').toUpperCase();
  let elementTier: 'S' | 'A' | 'B' | 'C' = 'C';
  if (rawTier === 'S' || rawTier === 'LEGENDARY') elementTier = 'S';
  else if (rawTier === 'A' || rawTier === 'EPIC') elementTier = 'A';
  else if (rawTier === 'B' || rawTier === 'RARE') elementTier = 'B';
  else if (rawTier === 'C' || rawTier === 'COMMON' || rawTier === 'NORMAL') elementTier = 'C';
  else if (ELEMENT_TO_TIER[element]) {
    elementTier = ELEMENT_TO_TIER[element];
  }

  let powerScore = cardInput.powerScore ?? 0;
  if (!powerScore) {
    powerScore = calculatePowerScore({
      race: race as any,
      variant: variant as any,
      elementTier: elementTier as any,
      evolutionStage,
      level,
    });
  }

  const card: CardEntity & { name?: string } = {
    id: cardId,
    name: (cardInput as any).name,
    race: race as any,
    gender: (cardInput.gender as any) || 'male',
    variant: variant as any,
    element,
    elementTier: elementTier as any,
    evolutionStage,
    level,
    powerScore,
    seed: cardInput.seed ?? 100,
  };

  const stats = calculateStats(card);

  // Check for pre-rendered slice assets
  const elementSlicePath = resolveAssetPath(
    assetDirectory,
    'elements',
    `${element}.png`
  );
  const characterSlicePath =
    resolveCharacterArtworkPath(
      card.race,
      card.gender || 'male',
      card.element,
      assetDirectory
    ) ||
    resolveAssetPath(
      assetDirectory,
      'races',
      `${card.race.toLowerCase()}.png`
    );
  const frameSlicePath = resolveFramePath(card.variant, assetDirectory);

  // =========================================================================
  // LAYER 1: Solid dark base background (#0a0c10)
  // =========================================================================
  ctx.fillStyle = '#0a0c10';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // =========================================================================
  // LAYER 2: Character Art (Full-Bleed Cover Scaling)
  // =========================================================================
  let characterLoaded = false;
  if (characterSlicePath) {
    try {
      const characterImg = await getOrLoadImage(characterSlicePath);

      // Full-bleed cover algorithm
      const canvasRatio = canvas.width / canvas.height;
      const imgRatio = characterImg.width / characterImg.height;

      let sX = 0;
      let sY = 0;
      let sWidth = characterImg.width;
      let sHeight = characterImg.height;

      if (imgRatio > canvasRatio) {
        // Image is wider than canvas: crop sides
        sWidth = Math.round(characterImg.height * canvasRatio);
        sX = Math.round((characterImg.width - sWidth) / 2);
      } else {
        // Image is taller than canvas: crop bottom/top slightly
        sHeight = Math.round(characterImg.width / canvasRatio);
        sY = Math.round((characterImg.height - sHeight) / 2);
      }

      // Draw character across the entire card
      ctx.drawImage(
        characterImg,
        sX, sY, sWidth, sHeight,
        0, 0, canvas.width, canvas.height
      );
      characterLoaded = true;
    } catch {
      characterLoaded = false;
    }
  }

  // Graceful fallback when character sprite slice is absent
  if (!characterLoaded) {
    let bgLoaded = false;
    if (elementSlicePath) {
      try {
        const img = await getOrLoadImage(elementSlicePath);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        bgLoaded = true;
      } catch {
        bgLoaded = false;
      }
    }
    if (!bgLoaded) {
      renderProceduralAtmosphere(ctx, card);
    }
    renderElementalSigil(ctx, card);
    renderCharacterArchetype(ctx, card);
  }

  // =========================================================================
  // LAYER 3: AI 1-Piece Frame Overlay (Border + Bottom Bezel Plate)
  // Or Procedural Ornate Frame Fallback
  // =========================================================================
  let frameLoaded = false;
  if (frameSlicePath) {
    try {
      const rawFrameImg = await getOrLoadImage(frameSlicePath);
      // Mask out the inner #00FF00 box before blitting
      const keyedFrame = applyFrameChromaKey(
        rawFrameImg,
        frameSlicePath,
        canvas.width,
        canvas.height
      );
      ctx.drawImage(keyedFrame, 0, 0, canvas.width, canvas.height);
      frameLoaded = true;
    } catch {
      frameLoaded = false;
    }
  }

  if (!frameLoaded) {
    // When no pre-rendered frame is present, render legibility gradient & procedural frame
    renderTextLegibilityGradients(ctx, canvas.width, canvas.height);
    renderOrnateFrame(ctx, card);
  }

  // =========================================================================
  // LAYER 4: Dynamic Text & Numbers Stamped into HUD plate
  // (Element badge, Title, Level, Card ID, Stats)
  // =========================================================================
  renderUnifiedBottomHUD(ctx, card, stats, { hasFrameOverlay: frameLoaded });

  return canvas.toBuffer('image/png');
}

/**
 * Backward-compatible alias for renderCard
 */
export async function renderCardComposite(
  cardInput: CardCompositeInput | CardEntity,
  assetDirectory = 'apps/web/public/assets'
): Promise<Buffer> {
  return renderCard(cardInput, assetDirectory);
}

// -------------------------------------------------------------
// Layer 3 Helper: Subtle Bottom Legibility Gradient
// -------------------------------------------------------------
function renderTextLegibilityGradients(
  ctx: SKRSContext2D,
  width: number,
  height: number
) {
  ctx.save();

  // Bottom dark gradient overlay for docked Unified Bottom HUD
  // Leaves the entire top and mid canvas completely clear for character art
  const botGrad = ctx.createLinearGradient(0, height - 250, 0, height);
  botGrad.addColorStop(0, 'transparent');
  botGrad.addColorStop(0.3, 'rgba(10, 12, 16, 0.45)');
  botGrad.addColorStop(0.7, 'rgba(10, 12, 16, 0.82)');
  botGrad.addColorStop(1, 'rgba(10, 12, 16, 0.95)');
  ctx.fillStyle = botGrad;
  ctx.fillRect(0, height - 250, width, 250);

  ctx.restore();
}

// -------------------------------------------------------------
// Procedural Atmosphere Fallback
// -------------------------------------------------------------
function renderProceduralAtmosphere(ctx: SKRSContext2D, card: CardEntity) {
  const elem = card.element.toLowerCase();
  const themeHex = ELEMENT_COLORS[elem] || '#3b82f6';

  const bgGrad = ctx.createLinearGradient(0, 0, 0, CARD_HEIGHT);
  bgGrad.addColorStop(0, '#030712');
  bgGrad.addColorStop(0.35, themeHex);
  bgGrad.addColorStop(0.7, '#0b0f19');
  bgGrad.addColorStop(1, '#020617');

  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  // Elemental texture specifics
  ctx.save();
  if (elem === 'fire' || elem === 'chaos') {
    for (let i = 0; i < 40; i++) {
      const x = (card.seed * 37 + i * 97) % CARD_WIDTH;
      const y = (card.seed * 19 + i * 113) % CARD_HEIGHT;
      const radius = 2 + (i % 5);
      ctx.fillStyle = i % 2 === 0 ? 'rgba(251, 146, 60, 0.4)' : 'rgba(239, 68, 68, 0.3)';
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (elem === 'ice' || elem === 'water') {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 15; i++) {
      const x1 = (card.seed * 23 + i * 83) % CARD_WIDTH;
      const y1 = (card.seed * 41 + i * 127) % CARD_HEIGHT;
      const x2 = x1 + ((i * 17) % 80) - 40;
      const y2 = y1 + ((i * 31) % 80) - 40;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
  } else if (elem === 'void' || elem === 'cosmic' || elem === 'shadow') {
    for (let i = 0; i < 50; i++) {
      const x = (card.seed * 53 + i * 67) % CARD_WIDTH;
      const y = (card.seed * 29 + i * 79) % CARD_HEIGHT;
      const r = (i % 4) + 1;
      ctx.fillStyle = 'rgba(224, 231, 255, 0.35)';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (elem === 'lightning') {
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

  const vignette = ctx.createRadialGradient(
    CARD_WIDTH / 2,
    CARD_HEIGHT / 2,
    180,
    CARD_WIDTH / 2,
    CARD_HEIGHT / 2,
    450
  );
  vignette.addColorStop(0, 'transparent');
  vignette.addColorStop(1, 'rgba(0, 0, 0, 0.7)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
}

// -------------------------------------------------------------
// Elemental Sigil & Runes Fallback
// -------------------------------------------------------------
function renderElementalSigil(ctx: SKRSContext2D, card: CardEntity) {
  const centerX = CARD_WIDTH / 2;
  const centerY = 370;
  const elem = card.element.toLowerCase();
  const themeHex = ELEMENT_COLORS[elem] || '#38bdf8';

  ctx.save();

  const aura = ctx.createRadialGradient(centerX, centerY, 30, centerX, centerY, 210);
  aura.addColorStop(0, `${themeHex}66`);
  aura.addColorStop(0.5, `${themeHex}22`);
  aura.addColorStop(1, 'transparent');
  ctx.fillStyle = aura;
  ctx.beginPath();
  ctx.arc(centerX, centerY, 210, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = `${themeHex}88`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(centerX, centerY, 160, 0, Math.PI * 2);
  ctx.stroke();

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

  ctx.fillStyle = 'rgba(10, 15, 29, 0.75)';
  ctx.beginPath();
  ctx.arc(centerX, centerY, 135, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = themeHex;
  ctx.lineWidth = 3;
  ctx.stroke();

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
    metal: '⚔️',
    sound: '🔔',
    poison: '☠️',
    sand: '⏳',
    mist: '🌫️',
    smoke: '💨',
    crystal: '💎',
    acid: '🧪',
  };

  const symbol = glyphs[elem] || '✨';
  ctx.font = '84px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(symbol, centerX, centerY);

  ctx.restore();
}

// -------------------------------------------------------------
// Procedural Character Silhouette Fallback
// -------------------------------------------------------------
function renderCharacterArchetype(ctx: SKRSContext2D, card: CardEntity) {
  const centerX = CARD_WIDTH / 2;
  const baseY = 550;
  const race = (card.race || 'human').toLowerCase();
  const elem = card.element.toLowerCase();
  const elemColor = ELEMENT_COLORS[elem] || '#38bdf8';

  ctx.save();
  ctx.shadowColor = elemColor;
  ctx.shadowBlur = 30;

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

  ctx.fillStyle = '#1e293b';
  ctx.strokeStyle = elemColor;
  ctx.lineWidth = 3;

  if (race === 'dragon') {
    ctx.beginPath();
    ctx.moveTo(centerX - 40, baseY - 150);
    ctx.lineTo(centerX - 90, baseY - 240);
    ctx.lineTo(centerX - 40, baseY - 200);
    ctx.lineTo(centerX, baseY - 260);
    ctx.lineTo(centerX + 40, baseY - 200);
    ctx.lineTo(centerX + 90, baseY - 240);
    ctx.lineTo(centerX + 40, baseY - 150);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (race === 'elf') {
    ctx.beginPath();
    ctx.moveTo(centerX - 35, baseY - 150);
    ctx.lineTo(centerX - 75, baseY - 210);
    ctx.lineTo(centerX - 30, baseY - 200);
    ctx.lineTo(centerX, baseY - 235);
    ctx.lineTo(centerX + 30, baseY - 200);
    ctx.lineTo(centerX + 75, baseY - 210);
    ctx.lineTo(centerX + 35, baseY - 150);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (race === 'orc') {
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
// Layer 4: Card Rarity Border / Frame overlay
// -------------------------------------------------------------
function renderOrnateFrame(ctx: SKRSContext2D, card: CardEntity) {
  const variant = (card.variant || 'normal').toLowerCase();
  const margin = 18;
  const innerMargin = 30;

  ctx.save();

  if (variant === 'silver') {
    ctx.lineWidth = 14;
    ctx.strokeStyle = '#cbd5e1';
    ctx.strokeRect(margin, margin, CARD_WIDTH - margin * 2, CARD_HEIGHT - margin * 2);

    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#38bdf8';
    ctx.strokeRect(innerMargin, innerMargin, CARD_WIDTH - innerMargin * 2, CARD_HEIGHT - innerMargin * 2);

    drawCornerGem(ctx, margin + 4, margin + 4, '#38bdf8');
    drawCornerGem(ctx, CARD_WIDTH - margin - 4, margin + 4, '#38bdf8');
    drawCornerGem(ctx, margin + 4, CARD_HEIGHT - margin - 4, '#38bdf8');
    drawCornerGem(ctx, CARD_WIDTH - margin - 4, CARD_HEIGHT - margin - 4, '#38bdf8');
  } else if (variant === 'gold') {
    const goldGrad = ctx.createLinearGradient(0, 0, CARD_WIDTH, CARD_HEIGHT);
    goldGrad.addColorStop(0, '#fef08a');
    goldGrad.addColorStop(0.3, '#f59e0b');
    goldGrad.addColorStop(0.7, '#d97706');
    goldGrad.addColorStop(1, '#fbbf24');

    ctx.lineWidth = 16;
    ctx.strokeStyle = goldGrad;
    ctx.strokeRect(margin, margin, CARD_WIDTH - margin * 2, CARD_HEIGHT - margin * 2);

    ctx.lineWidth = 3;
    ctx.strokeStyle = '#fef08a';
    ctx.strokeRect(innerMargin, innerMargin, CARD_WIDTH - innerMargin * 2, CARD_HEIGHT - innerMargin * 2);

    drawCornerGem(ctx, margin + 4, margin + 4, '#ef4444');
    drawCornerGem(ctx, CARD_WIDTH - margin - 4, margin + 4, '#ef4444');
    drawCornerGem(ctx, margin + 4, CARD_HEIGHT - margin - 4, '#ef4444');
    drawCornerGem(ctx, CARD_WIDTH - margin - 4, CARD_HEIGHT - margin - 4, '#ef4444');
  } else if (variant === 'diamond') {
    const crystalGrad = ctx.createLinearGradient(0, 0, CARD_WIDTH, CARD_HEIGHT);
    crystalGrad.addColorStop(0, '#67e8f9');
    crystalGrad.addColorStop(0.5, '#a5f3fc');
    crystalGrad.addColorStop(1, '#06b6d4');

    ctx.lineWidth = 18;
    ctx.strokeStyle = crystalGrad;
    ctx.strokeRect(margin, margin, CARD_WIDTH - margin * 2, CARD_HEIGHT - margin * 2);

    ctx.lineWidth = 4;
    ctx.strokeStyle = '#ffffff';
    ctx.strokeRect(innerMargin, innerMargin, CARD_WIDTH - innerMargin * 2, CARD_HEIGHT - innerMargin * 2);

    drawCornerGem(ctx, margin + 4, margin + 4, '#22d3ee');
    drawCornerGem(ctx, CARD_WIDTH - margin - 4, margin + 4, '#22d3ee');
    drawCornerGem(ctx, margin + 4, CARD_HEIGHT - margin - 4, '#22d3ee');
    drawCornerGem(ctx, CARD_WIDTH - margin - 4, CARD_HEIGHT - margin - 4, '#22d3ee');
  } else if (variant === 'rainbow') {
    const rainbowGrad = ctx.createLinearGradient(0, 0, CARD_WIDTH, CARD_HEIGHT);
    rainbowGrad.addColorStop(0, '#f43f5e');
    rainbowGrad.addColorStop(0.2, '#fb923c');
    rainbowGrad.addColorStop(0.4, '#facc15');
    rainbowGrad.addColorStop(0.6, '#4ade80');
    rainbowGrad.addColorStop(0.8, '#38bdf8');
    rainbowGrad.addColorStop(1, '#c084fc');

    ctx.lineWidth = 18;
    ctx.strokeStyle = rainbowGrad;
    ctx.strokeRect(margin, margin, CARD_WIDTH - margin * 2, CARD_HEIGHT - margin * 2);

    ctx.lineWidth = 3.5;
    ctx.strokeStyle = '#ffffff';
    ctx.strokeRect(innerMargin, innerMargin, CARD_WIDTH - innerMargin * 2, CARD_HEIGHT - innerMargin * 2);

    drawCornerGem(ctx, margin + 4, margin + 4, '#e879f9');
    drawCornerGem(ctx, CARD_WIDTH - margin - 4, margin + 4, '#38bdf8');
    drawCornerGem(ctx, margin + 4, CARD_HEIGHT - margin - 4, '#facc15');
    drawCornerGem(ctx, CARD_WIDTH - margin - 4, CARD_HEIGHT - margin - 4, '#4ade80');
  } else {
    // Normal: Weathered iron / slate border
    ctx.lineWidth = 14;
    ctx.strokeStyle = '#475569';
    ctx.strokeRect(margin, margin, CARD_WIDTH - margin * 2, CARD_HEIGHT - margin * 2);

    ctx.lineWidth = 2;
    ctx.strokeStyle = '#94a3b8';
    ctx.strokeRect(innerMargin, innerMargin, CARD_WIDTH - innerMargin * 2, CARD_HEIGHT - innerMargin * 2);

    drawCornerRivet(ctx, margin + 6, margin + 6);
    drawCornerRivet(ctx, CARD_WIDTH - margin - 6, margin + 6);
    drawCornerRivet(ctx, margin + 6, CARD_HEIGHT - margin - 6);
    drawCornerRivet(ctx, CARD_WIDTH - margin - 6, CARD_HEIGHT - margin - 6);
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
// Layer 4/5: Unified Bottom HUD (Card Identity, Element Tier, Level, Card ID & 4 Combat Stats)
// Docked at the bottom inside the frame padding
// -------------------------------------------------------------
export function renderUnifiedBottomHUD(
  ctx: SKRSContext2D,
  card: CardEntity & { name?: string },
  stats: { maxHp: number; atk: number; def: number },
  options: { hasFrameOverlay?: boolean } = {}
) {
  ctx.save();

  const hudX = UNIFIED_HUD_X;
  const hudY = UNIFIED_HUD_Y;
  const hudW = UNIFIED_HUD_WIDTH;
  const hudH = UNIFIED_HUD_HEIGHT;

  // A. Main Container (Rendered when no pre-rendered frame overlay is present)
  // When an AI 1-piece frame overlay is present, the frame already includes the bottom HUD plate,
  // so we skip the procedural dark box to reveal the AI frame plate styling.
  if (!options.hasFrameOverlay) {
    let borderColor = 'rgba(70, 95, 130, 0.4)';
    const variant = (card.variant || '').toLowerCase();
    if (variant === 'diamond') {
      borderColor = 'rgba(6, 182, 212, 0.45)';
    } else if (variant === 'gold') {
      borderColor = 'rgba(234, 179, 8, 0.45)';
    } else if (variant === 'silver') {
      borderColor = 'rgba(203, 213, 225, 0.45)';
    } else if (variant === 'rainbow') {
      borderColor = 'rgba(168, 85, 247, 0.5)';
    }

    ctx.fillStyle = 'rgba(10, 16, 26, 0.90)';
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1;
    roundRect(ctx, hudX, hudY, hudW, hudH, 12);
    ctx.fill();
    ctx.stroke();

    // Subtle horizontal divider line across the container at y = containerY + 50 (rgba(255, 255, 255, 0.1))
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(hudX, hudY + 50);
    ctx.lineTo(hudX + hudW, hudY + 50);
    ctx.stroke();
  }

  // B. Top Row: Identity & Metadata (y = containerY + 28 / vertical midpoint containerY + 25)
  // Left Badge (Element & Tier):
  // Pill badge anchored at the left inner padding (x = containerX + 14).
  // Content: [ELEMENT] • TIER [TIER] (e.g., TIME • TIER S).
  // Background: Dark pill with an accent border colored by element tier (S: Deep Violet/Gold, A: Crimson/Cyan, B: Azure, C: Slate).
  // Font: Bold 11px uppercase monospace or sans-serif.
  // Normalize element tier to standard single letter (S, A, B, C)
  let elementTier = (card.elementTier || '').toUpperCase();
  if (elementTier === 'LEGENDARY') elementTier = 'S';
  else if (elementTier === 'EPIC') elementTier = 'A';
  else if (elementTier === 'RARE') elementTier = 'B';
  else if (elementTier === 'COMMON' || elementTier === 'NORMAL') elementTier = 'C';
  else if (!['S', 'A', 'B', 'C'].includes(elementTier)) {
    const elemKey = (card.element || '').toLowerCase();
    elementTier = (ELEMENT_TO_TIER as Record<string, string>)[elemKey] || (elementTier.length === 1 ? elementTier : 'C');
  }

  let tierBorder = 'rgba(148, 163, 184, 0.6)';
  let tierBg = 'rgba(148, 163, 184, 0.15)';
  let tierText = '#E2E8F0';

  if (elementTier === 'S') {
    tierBorder = 'rgba(234, 179, 8, 0.75)';
    tierBg = 'rgba(234, 179, 8, 0.15)';
    tierText = '#FEF08A';
  } else if (elementTier === 'A') {
    tierBorder = 'rgba(239, 68, 68, 0.75)';
    tierBg = 'rgba(239, 68, 68, 0.15)';
    tierText = '#FCA5A5';
  } else if (elementTier === 'B') {
    tierBorder = 'rgba(56, 189, 248, 0.75)';
    tierBg = 'rgba(56, 189, 248, 0.15)';
    tierText = '#BAE6FD';
  }

  const elementStr = (card.element || 'fire').toUpperCase();
  const elementBadgeText = `${elementStr} • TIER ${elementTier}`;

  ctx.font = 'bold 11px "Rajdhani", "Segoe UI", sans-serif';
  const elementMetrics = ctx.measureText(elementBadgeText);
  const elementBadgeHeight = 24;
  const elementBadgePadX = 10;
  const elementBadgeWidth = Math.ceil(elementMetrics.width) + elementBadgePadX * 2;
  const elementBadgeX = hudX + 14;
  const elementBadgeY = hudY + Math.round((50 - elementBadgeHeight) / 2);

  roundRect(ctx, elementBadgeX, elementBadgeY, elementBadgeWidth, elementBadgeHeight, 6);
  ctx.fillStyle = tierBg;
  ctx.fill();
  ctx.strokeStyle = tierBorder;
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = tierText;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(
    elementBadgeText,
    elementBadgeX + elementBadgeWidth / 2,
    elementBadgeY + elementBadgeHeight / 2
  );

  // Right Badge (Collector ID):
  // Pill badge aligned to the right inner margin (x = containerRight - badgeWidth - 14).
  // Content: card.id (e.g., #NTTXVD).
  // Styling: Retain the cyan-bordered pill badge with bold 12px #38BDF8 text.
  const rawId = card.id || 'C00000';
  const idText = rawId.startsWith('#') ? rawId : `#${rawId}`;

  ctx.font = 'bold 12px monospace';
  const idMetrics = ctx.measureText(idText);
  const idBadgeHeight = 24;
  const idPadX = 10;
  const idBadgeWidth = Math.ceil(idMetrics.width) + idPadX * 2;
  const idBadgeX = hudX + hudW - 14 - idBadgeWidth;
  const idBadgeY = hudY + Math.round((50 - idBadgeHeight) / 2);

  roundRect(ctx, idBadgeX, idBadgeY, idBadgeWidth, idBadgeHeight, 6);
  ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
  ctx.fill();
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#38bdf8';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(idText, idBadgeX + idBadgeWidth / 2, idBadgeY + idBadgeHeight / 2);

  // Center Section (Title & Level):
  // Centered horizontally in the container.
  // Card Title: GOLD DRAGON in bold 20px white sans-serif.
  // Level Pill: Directly to the right of the title (LV. 1) in a compact gold badge:
  //   Background: rgba(229, 193, 88, 0.15)
  //   Border: 1px solid rgba(229, 193, 88, 0.6)
  //   Text: Bold 12px #E5C158 gold.
  const cardTitle = (card.name || `${card.variant} ${card.race}`).toUpperCase();
  const levelText = `LV. ${card.level ?? 1}`;

  ctx.font = 'bold 12px "Rajdhani", "Segoe UI", sans-serif';
  const levelMetrics = ctx.measureText(levelText);
  const levelPillPadX = 7;
  const levelPillWidth = Math.ceil(levelMetrics.width) + levelPillPadX * 2;
  const levelPillHeight = 20;

  const titleGap = 8;
  const minLeft = elementBadgeX + elementBadgeWidth + 12;
  const maxRight = idBadgeX - 12;
  const maxCenterWidth = Math.max(80, maxRight - minLeft);

  let titleFontSize = 20;
  ctx.font = `bold ${titleFontSize}px "Rajdhani", "Segoe UI", sans-serif`;
  let titleWidth = Math.ceil(ctx.measureText(cardTitle).width);

  // Ensure title never collides with side badges even on long names
  while (titleWidth + titleGap + levelPillWidth > maxCenterWidth && titleFontSize > 13) {
    titleFontSize -= 1;
    ctx.font = `bold ${titleFontSize}px "Rajdhani", "Segoe UI", sans-serif`;
    titleWidth = Math.ceil(ctx.measureText(cardTitle).width);
  }

  const totalGroupWidth = titleWidth + titleGap + levelPillWidth;
  let groupStartX = hudX + Math.round((hudW - totalGroupWidth) / 2);
  if (groupStartX < minLeft) groupStartX = minLeft;
  if (groupStartX + totalGroupWidth > maxRight) groupStartX = maxRight - totalGroupWidth;

  // Card Title
  ctx.font = `bold ${titleFontSize}px "Rajdhani", "Segoe UI", sans-serif`;
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(cardTitle, groupStartX, hudY + 25);

  // Level Pill
  const levelPillX = groupStartX + titleWidth + titleGap;
  const levelPillY = hudY + Math.round((50 - levelPillHeight) / 2);

  roundRect(ctx, levelPillX, levelPillY, levelPillWidth, levelPillHeight, 5);
  ctx.fillStyle = 'rgba(229, 193, 88, 0.15)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(229, 193, 88, 0.6)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#E5C158';
  ctx.font = 'bold 12px "Rajdhani", "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(
    levelText,
    levelPillX + levelPillWidth / 2,
    levelPillY + levelPillHeight / 2
  );

  // C. Bottom Row: 4 Combat Stats (y = containerY + 75 to + 120)
  // Distribute the 4 stat columns evenly across the container width:
  // Labels (Row Y1): HP (Red #EF4444), ATK (Amber #F59E0B), DEF (Cyan #06B6D4), PWR (Emerald #10B981)
  // Values (Row Y2): Formatted numbers in bold 22px white
  const colWidth = hudW / 4;
  const statItems = [
    { label: 'HP', val: stats.maxHp, color: '#EF4444' },
    { label: 'ATK', val: stats.atk, color: '#F59E0B' },
    { label: 'DEF', val: stats.def, color: '#06B6D4' },
    { label: 'PWR', val: card.powerScore ?? 0, color: '#10B981' },
  ];

  statItems.forEach((item, idx) => {
    const colCenterX = hudX + colWidth * idx + colWidth / 2;

    // Stat Label (Row Y1 at containerY + 75)
    ctx.font = 'bold 13px sans-serif';
    ctx.fillStyle = item.color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(item.label, colCenterX, hudY + 75);

    // Stat Value (Row Y2 at containerY + 104)
    ctx.font = 'bold 22px "Rajdhani", "Segoe UI", sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(item.val.toLocaleString(), colCenterX, hudY + 104);

    // Vertical Divider
    if (idx < 3) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(hudX + colWidth * (idx + 1), hudY + 62);
      ctx.lineTo(hudX + colWidth * (idx + 1), hudY + 120);
      ctx.stroke();
    }
  });

  ctx.restore();
}

// Backward-compatibility aliases
export const renderNameCapsule = (
  ctx: SKRSContext2D,
  card: CardEntity & { name?: string },
  _roleInfo?: any
) => {
  const stats = calculateStats(card);
  renderUnifiedBottomHUD(ctx, card, stats);
};
export const renderHeaderAndHUD = renderNameCapsule;
export const renderBottomStatRibbon = (
  ctx: SKRSContext2D,
  card: CardEntity,
  stats: { maxHp: number; atk: number; def: number }
) => {
  renderUnifiedBottomHUD(ctx, card, stats);
};

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
