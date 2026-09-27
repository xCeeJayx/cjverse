export function buildAssetPrompt(type: 'race' | 'element' | 'frame', value: string): string {
  switch (type) {
    case 'race':
      return `Pixel-art character sprite of a fantasy ${value}, front-facing combat stance, 64-bit clean vector edges, isolated on pure black #000000 background, high contrast, video game asset`;
    case 'element':
      return `Stylized 2D elemental VFX aura texture of swirling ${value} magic, translucent particle effects, centered, dark background, mobile game UI asset`;
    case 'frame':
      return `Ornate card game frame border, ${value} material, metallic trim, fantasy filigree, hollow transparent center, rectangular card ratio 5:7`;
  }
}
