import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createCanvas } from '@napi-rs/canvas';
import {
  renderCardComposite,
  resolveCharacterArtworkPath,
  resolveFramePath,
  applyFrameChromaKey,
  clearKeyedFrameCache,
  CARD_WIDTH,
  CARD_HEIGHT,
} from '../src';
import { CardEntity } from '@cjverse/game-logic';

describe('Canvas Card Composite Renderer with Fallback', () => {
  // Review Focus Check: Missing Asset Slices Fallback
  it('renders procedural card canvas without errors when image slices are absent', async () => {
    const mockCard: CardEntity = {
      seed: 42,
      race: 'dragon',
      variant: 'gold',
      element: 'fire',
      elementTier: 'A',
      evolutionStage: 2,
      level: 5,
      powerScore: 850
    };
    const pngBuffer = await renderCardComposite(mockCard, '/non/existent/path');
    expect(pngBuffer).toBeInstanceOf(Buffer);
    expect(pngBuffer.length).toBeGreaterThan(100);
    // Verify PNG magic bytes: 0x89 0x50 0x4E 0x47
    expect(pngBuffer[0]).toBe(0x89);
    expect(pngBuffer[1]).toBe(0x50);
    expect(pngBuffer[2]).toBe(0x4e);
    expect(pngBuffer[3]).toBe(0x47);
  });

  it('renders procedural card canvas without errors when asset directory is /public/assets or missing', async () => {
    const mockCard: CardEntity = {
      seed: 99,
      race: 'elf',
      variant: 'silver',
      element: 'water',
      elementTier: 'B',
      evolutionStage: 1,
      level: 3,
      powerScore: 620,
      gender: 'female',
    };
    const publicBuffer = await renderCardComposite(mockCard, '/public/assets');
    expect(publicBuffer).toBeInstanceOf(Buffer);
    expect(publicBuffer[0]).toBe(0x89);
    expect(publicBuffer[1]).toBe(0x50);
    expect(publicBuffer[2]).toBe(0x4e);
    expect(publicBuffer[3]).toBe(0x47);

    const defaultBuffer = await renderCardComposite(mockCard);
    expect(defaultBuffer).toBeInstanceOf(Buffer);
    expect(defaultBuffer[0]).toBe(0x89);
  });

  describe('Layered Character Artwork Resolution Fallback Cascade', () => {
    const tmpDir = path.resolve(os.tmpdir(), `cjverse-test-assets-${Date.now()}`);
    const charsDir = path.resolve(tmpDir, 'characters');

    beforeAll(() => {
      fs.mkdirSync(charsDir, { recursive: true });
    });

    afterAll(() => {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch {
        // ignore cleanup error
      }
    });

    it('falls back to procedural silhouette (null) when no images exist', async () => {
      const result = resolveCharacterArtworkPath('orc', 'female', 'fire', tmpDir);
      expect(result).toBeNull();
    });

    it('resolves Tier 3 race-neutral fallback (${race}.png)', async () => {
      const raceFile = path.resolve(charsDir, 'orc.png');
      fs.writeFileSync(raceFile, 'dummy-png-data');

      const result = resolveCharacterArtworkPath('orc', 'female', 'fire', tmpDir);
      expect(result).toBe(raceFile);
    });

    it('resolves Tier 2 element-neutral fallback (${race}_${gender}.png) over race-neutral', async () => {
      const genderFile = path.resolve(charsDir, 'orc_female.png');
      fs.writeFileSync(genderFile, 'dummy-png-data');

      const result = resolveCharacterArtworkPath('orc', 'female', 'fire', tmpDir);
      expect(result).toBe(genderFile);

      // Male still falls back to race-neutral orc.png
      const maleResult = resolveCharacterArtworkPath('orc', 'male', 'fire', tmpDir);
      expect(maleResult).toBe(path.resolve(charsDir, 'orc.png'));
    });

    it('resolves Tier 1 specific character artwork (${race}_${gender}_${element}.png) over neutral', async () => {
      const specificFile = path.resolve(charsDir, 'orc_female_fire.png');
      fs.writeFileSync(specificFile, 'dummy-png-data');

      const result = resolveCharacterArtworkPath('orc', 'female', 'fire', tmpDir);
      expect(result).toBe(specificFile);

      // Water element still falls back to Tier 2 orc_female.png
      const waterResult = resolveCharacterArtworkPath('orc', 'female', 'water', tmpDir);
      expect(waterResult).toBe(path.resolve(charsDir, 'orc_female.png'));
    });

    it('prioritizes race-specific subfolder (${race}/${race}_${gender}_${element}.png) over flat folder', async () => {
      const orcSubDir = path.resolve(charsDir, 'orc');
      fs.mkdirSync(orcSubDir, { recursive: true });

      const subfolderFile = path.resolve(orcSubDir, 'orc_female_fire.png');
      fs.writeFileSync(subfolderFile, 'subfolder-file-data');

      // Now both charsDir/orc_female_fire.png and charsDir/orc/orc_female_fire.png exist
      const result = resolveCharacterArtworkPath('orc', 'female', 'fire', tmpDir);
      expect(result).toBe(subfolderFile);

      // Subfolder neutral fallback
      const subNeutral = path.resolve(orcSubDir, 'orc_female.png');
      fs.writeFileSync(subNeutral, 'subfolder-neutral-data');
      const earthResult = resolveCharacterArtworkPath('orc', 'female', 'earth', tmpDir);
      expect(earthResult).toBe(subNeutral);
    });
  });

  describe('Pre-rendered AI Frame Loader with Chroma Keying', () => {
    const frameTmpDir = path.resolve(os.tmpdir(), `cjverse-frame-test-${Date.now()}`);
    const framesDir = path.resolve(frameTmpDir, 'frames');

    beforeAll(() => {
      fs.mkdirSync(framesDir, { recursive: true });
    });

    afterAll(() => {
      try {
        fs.rmSync(frameTmpDir, { recursive: true, force: true });
      } catch {}
      clearKeyedFrameCache();
    });

    it('resolves frame path checking frame_${rarity}.png and ${rarity}.png', () => {
      const normalFrame = path.resolve(framesDir, 'frame_normal.png');
      fs.writeFileSync(normalFrame, 'dummy-normal-frame');

      const resolved = resolveFramePath('normal', frameTmpDir);
      expect(resolved).toBe(normalFrame);

      // Fallback format: gold.png
      const goldFrame = path.resolve(framesDir, 'gold.png');
      fs.writeFileSync(goldFrame, 'dummy-gold-frame');

      const resolvedGold = resolveFramePath('gold', frameTmpDir);
      expect(resolvedGold).toBe(goldFrame);
    });

    it('masks out neon green #00FF00 inner window while preserving borders and HUD plate', () => {
      // Create a test frame canvas:
      // Border and bottom HUD plate are opaque dark gray #202020
      // Inner window (x: 40, y: 40, w: 520, h: 600) is solid neon green #00FF00
      const testCanvas = createCanvas(CARD_WIDTH, CARD_HEIGHT);
      const testCtx = testCanvas.getContext('2d');

      testCtx.fillStyle = '#202020';
      testCtx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

      testCtx.fillStyle = '#00ff00';
      testCtx.fillRect(40, 40, 520, 600);

      // Apply chroma key
      const keyedCanvas = applyFrameChromaKey(testCanvas, 'test-frame-key', CARD_WIDTH, CARD_HEIGHT);
      const keyedCtx = keyedCanvas.getContext('2d');
      const imgData = keyedCtx.getImageData(0, 0, CARD_WIDTH, CARD_HEIGHT);

      // Verify pixel in inner window (center of green box) is now fully transparent (alpha === 0)
      const centerPixelIdx = ((300 * CARD_WIDTH) + 300) * 4;
      expect(imgData.data[centerPixelIdx + 3]).toBe(0);

      // Verify pixel on outer border (x: 10, y: 10) is still fully opaque (alpha === 255)
      const borderPixelIdx = ((10 * CARD_WIDTH) + 10) * 4;
      expect(imgData.data[borderPixelIdx + 3]).toBe(255);
      expect(imgData.data[borderPixelIdx]).toBe(0x20);

      // Verify pixel on bottom HUD plate (x: 300, y: 750) is still fully opaque
      const hudPlatePixelIdx = ((750 * CARD_WIDTH) + 300) * 4;
      expect(imgData.data[hudPlatePixelIdx + 3]).toBe(255);
    });

    it('renders card composite with pre-rendered chroma-keyed frame overlay and Layer 4 dynamic HUD', async () => {
      // Create a real frame image with green window on disk
      const frameCanvas = createCanvas(CARD_WIDTH, CARD_HEIGHT);
      const frameCtx = frameCanvas.getContext('2d');
      frameCtx.fillStyle = '#111827';
      frameCtx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
      frameCtx.fillStyle = '#00ff00';
      frameCtx.fillRect(40, 40, 520, 600);

      const framePng = frameCanvas.toBuffer('image/png');
      const framePath = path.resolve(framesDir, 'frame_diamond.png');
      fs.writeFileSync(framePath, framePng);

      const mockCard: CardEntity = {
        id: 'CHROMA1',
        seed: 777,
        race: 'dragon',
        variant: 'diamond',
        element: 'cosmic',
        elementTier: 'S',
        evolutionStage: 3,
        level: 10,
        powerScore: 1200,
      };

      const buffer = await renderCardComposite(mockCard, frameTmpDir);
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer[0]).toBe(0x89);
      expect(buffer[1]).toBe(0x50);
      expect(buffer[2]).toBe(0x4e);
      expect(buffer[3]).toBe(0x47);
    });

    it('verifies packages/asset-pipeline/assets/prompts/frames/frames.md contains all 5 rarity specifications', () => {
      const framesMdPath = path.resolve(__dirname, '../assets/prompts/frames/frames.md');
      expect(fs.existsSync(framesMdPath)).toBe(true);

      const content = fs.readFileSync(framesMdPath, 'utf8');
      expect(content).toContain('Normal (Common)');
      expect(content).toContain('Silver (Uncommon)');
      expect(content).toContain('Gold (Rare)');
      expect(content).toContain('Diamond (Epic)');
      expect(content).toContain('Rainbow (Legendary Secret)');
      expect(content).toContain('#00FF00');
    });
  });
});

