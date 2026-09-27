// packages/asset-pipeline/tests/prompts.test.ts
import { describe, it, expect } from 'vitest';
import { buildAssetPrompt } from '../src';

describe('Generative Asset Prompt Builder', () => {
  it('builds high-contrast pixel-art prompt for race sprites', () => {
    const prompt = buildAssetPrompt('race', 'dragon');
    expect(prompt).toContain('Pixel-art character sprite of a fantasy dragon');
    expect(prompt).toContain('isolated on pure black #000000 background');
  });

  it('builds 2D VFX aura prompt for elements', () => {
    const prompt = buildAssetPrompt('element', 'fire');
    expect(prompt).toContain('Stylized 2D elemental VFX aura texture of swirling fire magic');
  });

  it('builds ornate metallic card frame prompt', () => {
    const prompt = buildAssetPrompt('frame', 'rainbow');
    expect(prompt).toContain('Ornate card game frame border, rainbow material');
    expect(prompt).toContain('rectangular card ratio 5:7');
  });
});
