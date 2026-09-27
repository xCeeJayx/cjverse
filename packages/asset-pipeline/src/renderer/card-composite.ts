import { createCanvas, loadImage } from '@napi-rs/canvas';
import fs from 'node:fs';
import path from 'node:path';
import { CardEntity } from '@cjverse/game-logic';
import { ELEMENT_COLORS, VARIANT_BORDER_COLORS } from '../constants/theme';

export async function renderCardComposite(card: CardEntity, assetDirectory = 'apps/web/public/assets'): Promise<Buffer> {
  const canvas = createCanvas(400, 560);
  const ctx = canvas.getContext('2d');

  // Slices paths
  const elementSlicePath = path.join(assetDirectory, 'elements', `${card.element}.png`);
  const raceSlicePath = path.join(assetDirectory, 'races', `${card.race}.png`);
  const frameSlicePath = path.join(assetDirectory, 'frames', `${card.variant}.png`);

  // 1. Render Background & Element Aura
  if (fs.existsSync(elementSlicePath)) {
    try {
      const img = await loadImage(elementSlicePath);
      ctx.drawImage(img, 0, 0, 400, 560);
    } catch {
      renderProceduralBackground(ctx, card);
    }
  } else {
    renderProceduralBackground(ctx, card);
  }

  // 2. Render Race Sprite
  if (fs.existsSync(raceSlicePath)) {
    try {
      const img = await loadImage(raceSlicePath);
      ctx.drawImage(img, 50, 100, 300, 300);
    } catch {
      renderProceduralRaceSigil(ctx, card);
    }
  } else {
    renderProceduralRaceSigil(ctx, card);
  }

  // 3. Render Variant Frame Overlay
  if (fs.existsSync(frameSlicePath)) {
    try {
      const img = await loadImage(frameSlicePath);
      ctx.drawImage(img, 0, 0, 400, 560);
    } catch {
      renderProceduralFrame(ctx, card);
    }
  } else {
    renderProceduralFrame(ctx, card);
  }

  // 4. Render Stat HUD & Typographic Labels
  renderCardHeader(ctx, card);

  return canvas.toBuffer('image/png');
}

function renderProceduralBackground(ctx: any, card: CardEntity) {
  const grad = ctx.createLinearGradient(0, 0, 0, 560);
  grad.addColorStop(0, ELEMENT_COLORS[card.element] || '#1a1a2e');
  grad.addColorStop(1, '#0f0f1a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 400, 560);
}

function renderProceduralRaceSigil(ctx: any, card: CardEntity) {
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(200, 250, 80, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#000000';
  ctx.font = 'bold 20px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(card.race.toUpperCase(), 200, 255);
}

function renderProceduralFrame(ctx: any, card: CardEntity) {
  ctx.lineWidth = 12;
  ctx.strokeStyle = VARIANT_BORDER_COLORS[card.variant] || '#ffffff';
  ctx.strokeRect(6, 6, 388, 548);
}

function renderCardHeader(ctx: any, card: CardEntity) {
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`${card.variant.toUpperCase()} ${card.race.toUpperCase()}`, 24, 40);

  ctx.textAlign = 'right';
  ctx.fillText(`Lv.${card.level} [${card.elementTier}]`, 376, 40);

  ctx.font = '14px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`Power Score: ${card.powerScore}`, 200, 520);
}
