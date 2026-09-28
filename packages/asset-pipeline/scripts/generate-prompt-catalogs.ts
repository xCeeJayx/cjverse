import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  RACES,
  GENDERS,
  ELEMENTS,
  ELEMENT_VISUAL_THEMES,
} from './generate-characters';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const GLOBAL_NEGATIVE_PROMPT =
  'smooth human skin, human face, human ears, cosplay, costume, full body, wide angle, card, border, frame, ornate frame, text, watermark, signature, UI, cropped';

export const STRICT_NEGATIVE_PROMPT = GLOBAL_NEGATIVE_PROMPT;

/**
 * Non-humanoid facial anatomy and physiological anchors per race and gender.
 */
export const RACIAL_ANATOMY_ANCHORS: Record<string, Record<string, string>> = {
  dragon: {
    male: 'True draconic reptilian visage, interlocking scales fully covering face and neck, sharp brow ridge, twin backward-swept horns, pointed dragon ears, reptilian slit eyes, chin spike, zero smooth human skin',
    female: 'Sleeker draconic reptilian visage, fine faceted scales over entire face and cheeks, swept horns, finned draconic ears, piercing slit eyes, zero smooth human skin',
  },
  orc: {
    male: 'Brutal bestial orc visage, heavy protruding lower jaw with twin upward lower tusks, broad flat nose, heavy brow, scarred coarse skin, feral eyes, zero human face',
    female: 'Fierce bestial orc visage, prominent lower fangs, sharp defined jaw, broad bridge nose, rugged green-gray skin, intense feral gaze',
  },
  troll: {
    male: 'Craggy monstrous troll visage, long curved lower tusks, elongated pointed ears, jagged stone-textured skin, gaunt bestial features, wild mane',
    female: 'Menacing craggy troll visage, sharp lower tusks, long swept ears, mossy stone-textured skin, predatory features',
  },
  goblin: {
    male: 'Sinister monstrous goblin visage, oversized bat-like pointed ears, elongated hooked nose, sharp needle teeth, large reflective predator eyes, leathery skin',
    female: 'Cunning monstrous goblin visage, wide pointed bat ears, sharp angular nose, needle fangs, large luminous eyes, wiry leathery skin',
  },
  dwarf: {
    male: 'Heavy weathered dwarven features, prominent craggy brow, massive ornate braided beard, stern hardened warrior face',
    female: 'Stout battle-hardened dwarven warrior, wide chiseled jaw, thick braided hair, sturdy stoic expression',
  },
  elf: {
    male: 'Ethereal alien elf visage, exaggerated long slender pointed ears extending backward, sharp angular cheekbones, pupil-less luminous eyes',
    female: 'Otherworldly elegant elf visage, long slender pointed ears, high angular bone structure, blinding luminous eyes, ethereal sharp features',
  },
  human: {
    male: 'Battle-scarred rugged human warrior, chiseled jaw, fierce intense gaze, short textured hair',
    female: 'Hardened fierce human warrior, sharp jawline, intense combat gaze, tied-back war hair',
  },
};

/**
 * Strict racial facial anatomy anchors matching base reference specifications.
 */
export const BASE_RACIAL_ANATOMY_ANCHORS: Record<string, Record<string, string>> = {
  dragon: {
    male: 'True draconic reptilian visage, interlocking scales fully covering face and neck, sharp brow ridge, twin backward-swept horns, pointed dragon ears, reptilian slit eyes, chin spike, zero smooth human skin',
    female: 'Sleeker draconic reptilian visage, interlocking scales fully covering face and neck, fine faceted scales over entire face and cheeks, sharp brow ridge, twin backward-swept horns, finned dragon ears, reptilian slit eyes, chin spike, zero smooth human skin',
  },
  orc: {
    male: 'Brutal bestial orc visage, protruding lower jaw with twin lower tusks, broad flat nose, heavy brow, scarred coarse skin, feral eyes, zero human facial features',
    female: 'Fierce bestial orc visage, protruding lower jaw with twin lower tusks, broad flat nose, heavy brow, scarred coarse skin, sharp defined jaw, intense feral gaze, zero human facial features',
  },
  troll: {
    male: 'Craggy monstrous troll visage, craggy stone-textured skin, long curved tusks, elongated pointed ears, gaunt bestial features, wild mane, zero human facial features',
    female: 'Menacing craggy troll visage, craggy stone-textured skin, long curved tusks, elongated pointed ears, sharp predatory features, zero human facial features',
  },
  goblin: {
    male: 'Sinister monstrous goblin visage, large pointed bat ears, hooked nose, needle teeth, large predator eyes, mottled green skin, zero human facial features',
    female: 'Cunning predatory goblin visage, large pointed bat ears, hooked nose, needle teeth, large predator eyes, wiry leathery green skin, zero human facial features',
  },
  dwarf: {
    male: 'Weathered warrior face, massive braided beard (male), chiseled wide jaw, furrowed brow, fierce stoic gaze',
    female: 'Battle-hardened dwarven warrior, weathered warrior face, chiseled wide jaw, thick braided hair with metallic beads, sturdy stoic expression',
  },
  elf: {
    male: 'Ethereal noble elf visage, long slender backward-swept ears, sharp angular cheekbones, pupil-less luminous eyes',
    female: 'Otherworldly elegant elf visage, long slender backward-swept ears, sharp angular cheekbones, pupil-less luminous eyes, ethereal sharp features',
  },
  human: {
    male: 'Battle-scarred rugged warrior, chiseled jawline, fierce intense gaze, short textured hair',
    female: 'Hardened fierce human warrior, battle-scarred rugged warrior, chiseled jawline, intense combat gaze, tied-back war hair',
  },
};

/**
 * Capitalizes a word (e.g. dragon -> Dragon).
 */
export function capitalize(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Builds the Markdown catalog content for a specific race (prompts.md).
 */
export function buildRacePromptMarkdown(race: string): { content: string; count: number } {
  const raceLower = race.toLowerCase();
  const raceTitle = capitalize(race);

  const lines: string[] = [];
  lines.push(`# Character Art Prompts: ${raceTitle}`);
  lines.push('');
  lines.push('## Global Configuration');
  lines.push('- **Model Tool**: Nano Banana Pro');
  lines.push('- **Aspect Ratio**: 3:4 (Portrait)');
  lines.push(`- **Output Directory**: \`packages/asset-pipeline/assets/characters/${raceLower}/\``);
  lines.push(`- **Negative Prompt**: \`${GLOBAL_NEGATIVE_PROMPT}\``);
  lines.push('');

  let counter = 1;

  for (const gender of GENDERS) {
    const genderLower = gender.toLowerCase();
    const anatomyAnchor =
      RACIAL_ANATOMY_ANCHORS[raceLower]?.[genderLower] ||
      `${genderLower} ${raceLower} warrior`;

    for (const element of ELEMENTS) {
      const elemLower = element.toLowerCase();
      const elementDescription =
        ELEMENT_VISUAL_THEMES[elemLower] || `${element} magic energy aura`;

      const key = `${raceLower}_${genderLower}_${elemLower}`;
      const targetFile = `packages/asset-pipeline/assets/characters/${raceLower}/${key}.png`;
      const prompt = `Masterpiece character concept art portrait, ${genderLower} ${raceLower} warrior channeling ${elemLower} magic, ${anatomyAnchor}, ${elementDescription}, centered half-body waist-up portrait, facing camera, one raised hand channeling swirling ${elemLower} energy, no full-body shots, dark fantasy manhwa illustration, bold heavy ink outlines, sharp cel-shading, vibrant rim-lighting, seamless pitch-black background, 8k resolution, trending on ArtStation`;

      lines.push(`### ${counter}. ${key}`);
      lines.push(`- **Target File**: \`${targetFile}\``);
      lines.push(`- **Prompt**: \`${prompt}\``);
      lines.push('');

      counter++;
    }
  }

  return { content: lines.join('\n'), count: counter - 1 };
}

/**
 * Builds the Base reference Markdown catalog (base.md) for a race defining the 2 master anchor prompts.
 */
export function buildRaceBaseMarkdown(race: string): { content: string; count: number } {
  const raceLower = race.toLowerCase();
  const raceTitle = capitalize(race);

  const lines: string[] = [];
  lines.push(`# Base Character Art Prompts: ${raceTitle}`);
  lines.push('');
  lines.push('## Global Configuration');
  lines.push('- **Model Tool**: Nano Banana Pro');
  lines.push('- **Aspect Ratio**: 3:4 (Portrait)');
  lines.push(`- **Output Directory**: \`packages/asset-pipeline/assets/normal/${raceLower}/\``);
  lines.push(`- **Negative Prompt**: \`${STRICT_NEGATIVE_PROMPT}\``);
  lines.push('');

  let counter = 1;

  for (const gender of GENDERS) {
    const genderLower = gender.toLowerCase();
    const anatomy =
      BASE_RACIAL_ANATOMY_ANCHORS[raceLower]?.[genderLower] ||
      `${genderLower} ${raceLower} warrior`;

    const key = `${raceLower}_${genderLower}_base`;
    const targetFile = `packages/asset-pipeline/assets/normal/${raceLower}/${key}.png`;
    const prompt = `Masterpiece base character concept art portrait, ${genderLower} ${raceLower} warrior, ${anatomy}, neutral glowing white/pale-gray eyes, neutral dark slate/iron armor with unlit, uncharged runic engravings, neutral hands resting forward at mid-chest (no elemental orbs, no fire, no lightning), centered half-body waist-up portrait, directly facing camera, no full-body shots, high-contrast dark fantasy manhwa style, bold heavy ink outlines, sharp cel-shading, vibrant rim-lighting, seamless pitch-black solid dark background, borderless, frameless, edge-to-edge illustration, 8k resolution, trending on ArtStation`;

    lines.push(`### ${counter}. ${key}`);
    lines.push(`- **Target File**: \`${targetFile}\``);
    lines.push(`- **Prompt**: \`${prompt}\``);
    lines.push('');

    counter++;
  }

  return { content: lines.join('\n'), count: counter - 1 };
}

/**
 * Builds the Elemental Modification tasks catalog (elements.md) for a race containing 46 modification tasks.
 */
export function buildRaceElementsMarkdown(race: string): { content: string; count: number } {
  const raceLower = race.toLowerCase();
  const raceTitle = capitalize(race);

  const lines: string[] = [];
  lines.push(`# Elemental Modification Tasks: ${raceTitle}`);
  lines.push('');
  lines.push('## Global Configuration');
  lines.push('- **Model Tool**: Nano Banana Pro');
  lines.push('- **Aspect Ratio**: 3:4 (Portrait)');
  lines.push(`- **Base References Directory**: \`packages/asset-pipeline/assets/normal/${raceLower}/\``);
  lines.push(`- **Output Directory**: \`packages/asset-pipeline/assets/characters/${raceLower}/\``);
  lines.push(`- **Negative Prompt**: \`${STRICT_NEGATIVE_PROMPT}\``);
  lines.push('');

  let counter = 1;

  for (const gender of GENDERS) {
    const genderLower = gender.toLowerCase();
    const refImage = `packages/asset-pipeline/assets/normal/${raceLower}/${raceLower}_${genderLower}_base.png`;

    for (const element of ELEMENTS) {
      const elemLower = element.toLowerCase();
      const elementDescription =
        ELEMENT_VISUAL_THEMES[elemLower] || `${element} magic energy aura`;

      const key = `${raceLower}_${genderLower}_${elemLower}`;
      const destination = `packages/asset-pipeline/assets/characters/${raceLower}/${key}.png`;
      const modificationTask = `Keep the exact facial features, horns, hair, skin/scale texture, framing, and armor silhouette of the reference image. Ignite the armor runes and the raised hand with ${elemLower} magic (${elementDescription}).`;
      const prompt = `Masterpiece character concept art portrait, ${genderLower} ${raceLower} warrior channeling ${elemLower} magic, based on reference portrait packages/asset-pipeline/assets/normal/${raceLower}/${raceLower}_${genderLower}_base.png, keep exact facial features, horns, hair, skin/scale texture, framing, and armor silhouette of reference image, ignite armor runes and raised hand with ${elemLower} magic (${elementDescription}), centered half-body waist-up portrait, facing camera, high-contrast dark fantasy manhwa style, bold heavy ink outlines, sharp cel-shading, vibrant rim-lighting, seamless pitch-black solid dark background, borderless, frameless, edge-to-edge illustration, 8k resolution, trending on ArtStation`;

      lines.push(`### ${counter}. ${key}`);
      lines.push(`- **Reference Image**: \`${refImage}\``);
      lines.push(`- **Modification Task**: ${modificationTask}`);
      lines.push(`- **Destination**: \`${destination}\``);
      lines.push(`- **Prompt**: \`${prompt}\``);
      lines.push('');

      counter++;
    }
  }

  return { content: lines.join('\n'), count: counter - 1 };
}

export interface CatalogGenerationResult {
  race: string;
  catalogPath: string;
  basePath: string;
  elementsPath: string;
  count: number;
  baseCount: number;
  elementsCount: number;
}

/**
 * Generates all prompt catalogs and directories for all 7 races.
 */
export function generateAllPromptCatalogs(baseDir?: string): CatalogGenerationResult[] {
  const root = baseDir || path.resolve(__dirname, '..');
  const normalDir = path.resolve(root, 'assets/normal');
  const promptsDir = path.resolve(root, 'assets/prompts');
  const charactersDir = path.resolve(root, 'assets/characters');

  const results: CatalogGenerationResult[] = [];

  for (const race of RACES) {
    const raceLower = race.toLowerCase();
    const raceNormalDir = path.resolve(normalDir, raceLower);
    const racePromptsDir = path.resolve(promptsDir, raceLower);
    const raceCharactersDir = path.resolve(charactersDir, raceLower);

    fs.mkdirSync(raceNormalDir, { recursive: true });
    fs.mkdirSync(racePromptsDir, { recursive: true });
    fs.mkdirSync(raceCharactersDir, { recursive: true });

    // 1. Direct prompt catalog (prompts.md)
    const { content: promptContent, count: promptCount } = buildRacePromptMarkdown(raceLower);
    const catalogPath = path.resolve(racePromptsDir, 'prompts.md');
    fs.writeFileSync(catalogPath, promptContent, 'utf-8');

    // 2. Base reference catalog (base.md)
    const { content: baseContent, count: baseCount } = buildRaceBaseMarkdown(raceLower);
    const basePath = path.resolve(racePromptsDir, 'base.md');
    fs.writeFileSync(basePath, baseContent, 'utf-8');

    // 3. Elemental modification catalog (elements.md)
    const { content: elementsContent, count: elementsCount } = buildRaceElementsMarkdown(raceLower);
    const elementsPath = path.resolve(racePromptsDir, 'elements.md');
    fs.writeFileSync(elementsPath, elementsContent, 'utf-8');

    results.push({
      race: raceLower,
      catalogPath,
      basePath,
      elementsPath,
      count: promptCount,
      baseCount,
      elementsCount,
    });
    console.log(
      `[Prompt Catalog] Generated ${raceLower}: prompts.md (${promptCount}), base.md (${baseCount}), elements.md (${elementsCount})`
    );
  }

  // Also sync existing flat dragon images into assets/characters/dragon/ if any
  if (fs.existsSync(charactersDir)) {
    const flatDragonFiles = fs
      .readdirSync(charactersDir)
      .filter((f) => f.startsWith('dragon_') && f.endsWith('.png'));

    const dragonSubDir = path.resolve(charactersDir, 'dragon');
    let copiedCount = 0;
    for (const f of flatDragonFiles) {
      const src = path.resolve(charactersDir, f);
      const dst = path.resolve(dragonSubDir, f);
      if (!fs.existsSync(dst)) {
        fs.copyFileSync(src, dst);
        copiedCount++;
      }
    }
    if (copiedCount > 0) {
      console.log(`[Asset Sync] Copied ${copiedCount} dragon assets into ${dragonSubDir}`);
    }
  }

  return results;
}

// Direct execution
if (
  process.argv[1] &&
  (process.argv[1].endsWith('generate-prompt-catalogs.ts') ||
    process.argv[1].endsWith('generate-prompt-catalogs.js'))
) {
  generateAllPromptCatalogs();
}

