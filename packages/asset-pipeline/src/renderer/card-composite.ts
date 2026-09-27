import { createCanvas, loadImage } from '@napi-rs/canvas';
import fs from 'node:fs';
import path from 'node:path';
import { CardEntity } from '@cjverse/game-logic';
import { ELEMENT_COLORS, VARIANT_BORDER_COLORS } from '../constants/theme';

/**
 * Attempt to locate an existing image slice file across common path structures
 */
function resolveAssetPath(assetDirectory: string, category: string, filename: string): string | null {
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

export async function renderCardComposite(
  card: CardEntity,
  assetDirectory = 'apps/web/public/assets'
): Promise<Buffer> {
  const canvas = createCanvas(400, 560);
  const ctx = canvas.getContext('2d');

  // Attempt to resolve image slice paths
  const elementSlicePath = resolveAssetPath(assetDirectory, 'elements', `${card.element}.png`);
  const raceSlicePath = resolveAssetPath(assetDirectory, 'races', `${card.race}.png`);
  const frameSlicePath = resolveAssetPath(assetDirectory, 'frames', `${card.variant}.png`);

  // 1. Render Background & Element Aura (Graceful procedural fallback)
  let elementLoaded = false;
  if (elementSlicePath) {
    try {
      const img = await loadImage(elementSlicePath);
      ctx.drawImage(img, 0, 0, 400, 560);
      elementLoaded = true;
    } catch {
      elementLoaded = false;
    }
  }
  if (!elementLoaded) {
    renderProceduralBackground(ctx, card);
  }

  // 2. Render Race Sprite / Sigil (Graceful procedural fallback)
  let raceLoaded = false;
  if (raceSlicePath) {
    try {
      const img = await loadImage(raceSlicePath);
      ctx.drawImage(img, 50, 100, 300, 300);
      raceLoaded = true;
    } catch {
      raceLoaded = false;
    }
  }
  if (!raceLoaded) {
    renderProceduralRaceSigil(ctx, card);
  }

  // 3. Render Variant Frame Overlay (Graceful procedural fallback)
  let frameLoaded = false;
  if (frameSlicePath) {
    try {
      const img = await loadImage(frameSlicePath);
      ctx.drawImage(img, 0, 0, 400, 560);
      frameLoaded = true;
    } catch {
      frameLoaded = false;
    }
  }
  if (!frameLoaded) {
    renderProceduralFrame(ctx, card);
  }

  // 4. Render Stat HUD & Typographic Labels
  renderCardHeader(ctx, card);

  return canvas.toBuffer('image/png');
}

function renderProceduralBackground(ctx: any, card: CardEntity) {
  const primaryColor = ELEMENT_COLORS[card.element] || '#1a1a2e';
  const grad = ctx.createLinearGradient(0, 0, 400, 560);
  grad.addColorStop(0, primaryColor);
  grad.addColorStop(0.5, '#121224');
  grad.addColorStop(1, '#0a0a14');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 400, 560);

  // Subtle radial aura
  try {
    const aura = ctx.createRadialGradient(200, 250, 20, 200, 250, 180);
    aura.addColorStop(0, 'rgba(255, 255, 255, 0.15)');
    aura.addColorStop(1, 'transparent');
    ctx.fillStyle = aura;
    ctx.fillRect(0, 0, 400, 560);
  } catch {
    // Ignore canvas gradient error if unsupported
  }
}

function renderProceduralRaceSigil(ctx: any, card: CardEntity) {
  ctx.save();
  // Outer decorative halo
  ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.beginPath();
  ctx.arc(200, 250, 95, 0, Math.PI * 2);
  ctx.fill();

  // Inner circular emblem
  ctx.fillStyle = 'rgba(18, 18, 30, 0.9)';
  ctx.beginPath();
  ctx.arc(200, 250, 80, 0, Math.PI * 2);
  ctx.fill();

  // Element ring stroke
  ctx.lineWidth = 3;
  ctx.strokeStyle = ELEMENT_COLORS[card.element] || '#ffffff';
  ctx.stroke();

  // Typography for Race
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(card.race.toUpperCase(), 200, 242);

  // Typography for Element
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.font = '12px sans-serif';
  ctx.fillText(`[ ${card.element.toUpperCase()} ]`, 200, 268);
  ctx.restore();
}

function renderProceduralFrame(ctx: any, card: CardEntity) {
  ctx.save();
  const borderColor = VARIANT_BORDER_COLORS[card.variant] || '#ffffff';

  // Outer border
  ctx.lineWidth = 10;
  ctx.strokeStyle = borderColor;
  ctx.strokeRect(5, 5, 390, 550);

  // Inner accent border
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.strokeRect(14, 14, 372, 532);
  ctx.restore();
}

function renderCardHeader(ctx: any, card: CardEntity) {
  ctx.save();
  // Header background badge
  ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
  ctx.fillRect(16, 16, 368, 48);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${card.variant.toUpperCase()} ${card.race.toUpperCase()}`, 28, 40);

  ctx.textAlign = 'right';
  ctx.fillText(`Lv.${card.level} [${card.elementTier}]`, 372, 40);

  // Footer power score badge
  ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
  ctx.fillRect(16, 496, 368, 48);

  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#00ff99';
  ctx.fillText(`⚡ POWER SCORE: ${card.powerScore}`, 200, 520);
  ctx.restore();
}
