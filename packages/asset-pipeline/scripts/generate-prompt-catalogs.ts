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

export const STRICT_NEGATIVE_PROMPT =
  'text, watermark, signature, letters, numbers, words, font, label, card, trading card, card border, border, frame, ornate frame, outer box, UI, HUD, banner, template, margin, outline, white border, cropped, low quality, blurry, deformed anatomy';

/**
 * Capitalizes a word (e.g. dragon -> Dragon).
 */
export function capitalize(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Builds the Markdown catalog content for a specific race.
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
  lines.push(`- **Negative Prompt**: \`${STRICT_NEGATIVE_PROMPT}\``);
  lines.push('');

  let counter = 1;

  for (const gender of GENDERS) {
    for (const element of ELEMENTS) {
      const elemLower = element.toLowerCase();
      const elementDescription =
        ELEMENT_VISUAL_THEMES[elemLower] || `${element} magic energy aura`;

      const key = `${raceLower}_${gender}_${elemLower}`;
      const targetFile = `packages/asset-pipeline/assets/characters/${raceLower}/${key}.png`;
      const prompt = `Masterpiece character concept art portrait, ${gender} ${raceLower} warrior channeling ${elemLower} magic, ${elementDescription}, dark fantasy manhwa style, sharp detailed ink linework, dynamic lighting, glowing ${elemLower} energy particles, intense gaze, cinematic anime illustration, centered bust portrait, borderless, frameless, seamless solid dark background, edge-to-edge illustration, 8k resolution, trending on ArtStation`;

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
 * Generates all prompt catalogs and directories for all 7 races.
 */
export function generateAllPromptCatalogs(baseDir?: string): { race: string; catalogPath: string; count: number }[] {
  const root = baseDir || path.resolve(__dirname, '..');
  const promptsDir = path.resolve(root, 'assets/prompts');
  const charactersDir = path.resolve(root, 'assets/characters');

  const results: { race: string; catalogPath: string; count: number }[] = [];

  for (const race of RACES) {
    const raceLower = race.toLowerCase();
    const racePromptsDir = path.resolve(promptsDir, raceLower);
    const raceCharactersDir = path.resolve(charactersDir, raceLower);

    fs.mkdirSync(racePromptsDir, { recursive: true });
    fs.mkdirSync(raceCharactersDir, { recursive: true });

    const { content, count } = buildRacePromptMarkdown(raceLower);
    const catalogPath = path.resolve(racePromptsDir, 'prompts.md');
    fs.writeFileSync(catalogPath, content, 'utf-8');

    results.push({ race: raceLower, catalogPath, count });
    console.log(`[Prompt Catalog] Generated ${catalogPath} (${count} prompts)`);
  }

  // Also sync existing flat dragon images into assets/characters/dragon/
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
