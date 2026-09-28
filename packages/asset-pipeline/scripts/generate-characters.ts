import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createCanvas } from '@napi-rs/canvas';
import { ELEMENT_TO_TIER, ElementTier, Race, Gender } from '@cjverse/game-logic';
export { ELEMENT_TO_TIER, ElementTier, Race, Gender };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Rich atmospheric and lighting descriptors for each of the 23 elements.
 */
export const ELEMENT_VISUAL_THEMES: Record<string, string> = {
  void: 'Abyssal black holes, cosmic gravity distortion, deep purple event horizons',
  time: 'Molten gold clockwork runes, temporal distortion waves, ticking chronos rings',
  cosmic: 'Stellar stardust nebulae, deep violet astral constellations, radiant galaxy glow',
  arcane: 'Crystalline runic circles, cyan mana glyphs, hovering ethereal spell tomes',
  chaos: 'Reality-warping crimson rifts, jagged glitch-energy arcs, volatile violet sparks',
  fire: 'Molten magma cracks, blazing ember halos, raging crimson inferno tendrils',
  ice: 'Diamond frost fractures, glacial mist plumes, sharp crystalline ice shards',
  lightning: 'High-voltage electric arcs, azure plasma flares, ionized corona sparks',
  shadow: 'Abyssal smoke tendrils, ink-like darkness shrouds, violet phantom glow',
  light: 'Solar flare coronas, holy prismatic halos, radiant blinding sunbeams',
  nature: 'Verdant bioluminescent vines, glowing emerald pollen, blooming thorny brambles',
  blood: 'Sanguine crimson essence ribbons, dark ruby droplet halos, vital hemorrhage aura',
  water: 'Swirling tidal vortex torrents, bioluminescent ocean spray, aquamarine water whips',
  wind: 'Razor aerokinetic cutting gales, spiraling tempest vortex, translucent jade wind blades',
  earth: 'Granite stone armor plating, floating tectonic rock fragments, earthen geode crystals',
  poison: 'Noxious emerald miasma plumes, corrosive venom drips, sickly toxic fume bubbles',
  sound: 'Sonic shockwave rings, oscillating vibrational ripples, pulsing frequency waves',
  metal: 'Liquid mercury filigree, floating razor steel blades, polished titanium spikes',
  sand: 'Swirling desert duststorms, abrasive golden sand dunes, ancient tomb particulate',
  mist: 'Translucent vapor veils, damp spectral fog blankets, ethereal moisture haze',
  smoke: 'Dense volcanic ash plumes, smoldering gray embers, pitch-black billow clouds',
  crystal: 'Prismatic quartz spire reflections, amethyst refraction facets, sparkling gemstone shards',
  acid: 'Corrosive fluorescent green slime drips, bubbling acidic puddle mist, dissolving chemical vapors',
};

export const RACES = ['dragon', 'elf', 'human', 'dwarf', 'orc', 'troll', 'goblin'] as const;
export const GENDERS = ['male', 'female'] as const;
export const ELEMENTS = Object.keys(ELEMENT_VISUAL_THEMES) as (keyof typeof ELEMENT_VISUAL_THEMES)[];

export const NEGATIVE_PROMPT =
  'text, watermark, signature, letters, numbers, words, font, label, card, trading card, card border, border, frame, ornate frame, outer box, UI, HUD, banner, template, margin, outline, white border, cropped';

export interface ArtMatrixItem {
  race: string;
  gender: string;
  element: string;
  tier: ElementTier;
  prompt: string;
  negativePrompt: string;
  fileName: string;
  relativePath: string;
  targetPath: string;
}

export interface ArtMatrixOptions {
  dryRun?: boolean;
  sample?: boolean;
  race?: string;
  element?: string;
  filterTier?: 'S' | 'A' | 'B' | 'C';
  force?: boolean;
  outputDir?: string;
  pacingDelayMs?: number;
  generator?: (item: ArtMatrixItem) => Promise<Buffer | void>;
}

/**
 * Constructs the structured masterpiece character prompt & negative prompt.
 */
export function buildCharacterPrompt(
  race: string,
  gender: string,
  element: string
): { prompt: string; negativePrompt: string } {
  const elemLower = element.toLowerCase();
  const elementDescription =
    ELEMENT_VISUAL_THEMES[elemLower] || `${element} magic energy aura`;

  const prompt = `Masterpiece character concept art portrait, ${gender} ${race} warrior channeling ${element} magic, ${elementDescription}, dark fantasy manhwa style, sharp detailed ink linework, dynamic lighting, glowing ${element} energy particles, intense gaze, cinematic anime illustration, centered bust portrait, borderless, frameless, seamless solid dark background, edge-to-edge illustration, 8k resolution, trending on ArtStation`;

  return {
    prompt,
    negativePrompt: NEGATIVE_PROMPT,
  };
}

/**
 * Resolves the target directory for character asset storage.
 */
export function resolveCharactersDirectory(customDir?: string): string {
  if (customDir) return path.resolve(customDir);

  const candidates = [
    path.resolve(process.cwd(), 'packages/asset-pipeline/assets/characters'),
    path.resolve(process.cwd(), 'assets/characters'),
    path.resolve(__dirname, '../assets/characters'),
  ];

  for (const cand of candidates) {
    if (fs.existsSync(cand)) {
      return cand;
    }
  }

  return path.resolve(process.cwd(), 'packages/asset-pipeline/assets/characters');
}

/**
 * Generates the permutation matrix across races, genders, and elements with optional filtering.
 */
export function buildArtMatrix(
  options: {
    sample?: boolean;
    race?: string;
    element?: string;
    filterTier?: 'S' | 'A' | 'B' | 'C';
    outputDir?: string;
  } = {}
): ArtMatrixItem[] {
  const targetDir = resolveCharactersDirectory(options.outputDir);

  // Sample mode generates only 2 items
  if (options.sample) {
    const sampleItems: [string, string, string][] = [
      ['dragon', 'male', 'fire'],
      ['human', 'female', 'arcane'],
    ];

    return sampleItems.map(([race, gender, element]) => {
      const tier = ELEMENT_TO_TIER[element] || 'A';
      const { prompt, negativePrompt } = buildCharacterPrompt(race, gender, element);
      const fileName = `${race}_${gender}_${element}.png`;
      const relativePath = `assets/characters/${fileName}`;
      const targetPath = path.resolve(targetDir, fileName);

      return {
        race,
        gender,
        element,
        tier,
        prompt,
        negativePrompt,
        fileName,
        relativePath,
        targetPath,
      };
    });
  }

  const targetRaces = options.race
    ? RACES.filter((r) => r.toLowerCase() === options.race!.toLowerCase())
    : RACES;

  const targetElements = options.element
    ? ELEMENTS.filter((e) => e.toLowerCase() === options.element!.toLowerCase())
    : ELEMENTS;

  const matrix: ArtMatrixItem[] = [];

  for (const race of targetRaces) {
    for (const gender of GENDERS) {
      for (const element of targetElements) {
        const tier = ELEMENT_TO_TIER[element] || 'C';
        if (options.filterTier && tier !== options.filterTier) {
          continue;
        }

        const { prompt, negativePrompt } = buildCharacterPrompt(race, gender, element);
        const fileName = `${race}_${gender}_${element}.png`;
        const relativePath = `assets/characters/${fileName}`;
        const targetPath = path.resolve(targetDir, fileName);

        matrix.push({
          race,
          gender,
          element,
          tier,
          prompt,
          negativePrompt,
          fileName,
          relativePath,
          targetPath,
        });
      }
    }
  }

  return matrix;
}

/**
 * Procedural fallback renderer if Nano Banana CLI/API is not installed on the system.
 */
function renderFallbackCharacter(item: ArtMatrixItem): Buffer {
  const canvas = createCanvas(600, 850);
  const ctx = canvas.getContext('2d');

  // Dark fantasy background
  ctx.fillStyle = '#0b0f19';
  ctx.fillRect(0, 0, 600, 850);

  // Radial elemental aura glow
  const aura = ctx.createRadialGradient(300, 425, 40, 300, 425, 380);
  aura.addColorStop(0, 'rgba(56, 189, 248, 0.45)');
  aura.addColorStop(0.5, 'rgba(30, 41, 59, 0.25)');
  aura.addColorStop(1, 'transparent');
  ctx.fillStyle = aura;
  ctx.fillRect(0, 0, 600, 850);

  // Character Torso Silhouette
  ctx.fillStyle = '#1e293b';
  ctx.beginPath();
  ctx.moveTo(150, 850);
  ctx.lineTo(200, 520);
  ctx.lineTo(250, 440);
  ctx.lineTo(350, 440);
  ctx.lineTo(400, 520);
  ctx.lineTo(450, 850);
  ctx.closePath();
  ctx.fill();

  // Head / Crest Silhouette
  ctx.beginPath();
  ctx.arc(300, 340, 90, 0, Math.PI * 2);
  ctx.fill();

  // Typography labels
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 36px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${item.race.toUpperCase()} (${item.gender.toUpperCase()})`, 300, 330);

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText(`[ ${item.element.toUpperCase()} • TIER ${item.tier} ]`, 300, 385);

  return canvas.toBuffer('image/png');
}

/**
 * Invokes the Nano Banana API or CLI to generate a character illustration.
 */
async function invokeNanoBananaRunner(item: ArtMatrixItem): Promise<Buffer> {
  // 1. API Call (if API Key provided)
  const apiKey = process.env.NANO_BANANA_API_KEY || process.env.BANANA_API_KEY;
  if (apiKey) {
    const endpoint = process.env.NANO_BANANA_ENDPOINT || 'https://api.banana.dev/start/v4';
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          prompt: item.prompt,
          negativePrompt: item.negativePrompt,
          aspectRatio: '600x850',
          width: 600,
          height: 850,
          outputPath: item.targetPath,
          model: 'nano-banana-v1',
        }),
      });

      if (response.ok) {
        const json = await response.json() as any;
        const b64 = json.imageBuffer || json.modelOutputs?.[0]?.image_base64;
        if (b64) {
          return Buffer.from(b64, 'base64');
        }
      }
    } catch (err) {
      console.warn(`[Nano Banana API] Network call failed for ${item.fileName}:`, err);
    }
  }

  // 2. CLI Execution (if nano-banana CLI installed)
  try {
    const cliBin = process.env.NANO_BANANA_CLI || 'nano-banana';
    execFileSync(
      cliBin,
      [
        'generate',
        '--prompt', item.prompt,
        '--negative-prompt', item.negativePrompt,
        '--aspect-ratio', '600x850',
        '--output', item.targetPath,
      ],
      { stdio: 'pipe' }
    );
    if (fs.existsSync(item.targetPath)) {
      return fs.readFileSync(item.targetPath);
    }
  } catch {
    // CLI is not available on host system
  }

  // 3. Fallback procedural canvas rendering
  return renderFallbackCharacter(item);
}

/**
 * Parses command-line arguments into structured generation options.
 */
export function parseCliArgs(argv: string[]): ArtMatrixOptions {
  let dryRun = false;
  let sample = false;
  let force = false;
  let race: string | undefined;
  let element: string | undefined;
  let filterTier: 'S' | 'A' | 'B' | 'C' | undefined;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run') {
      dryRun = true;
    } else if (arg === '--sample') {
      sample = true;
    } else if (arg === '--force') {
      force = true;
    } else if (arg.startsWith('--race=')) {
      race = arg.split('=')[1]?.trim();
    } else if (arg === '--race' && i + 1 < argv.length) {
      race = argv[++i].trim();
    } else if (arg.startsWith('--element=')) {
      element = arg.split('=')[1]?.trim();
    } else if (arg === '--element' && i + 1 < argv.length) {
      element = argv[++i].trim();
    } else if (arg.startsWith('--tier=')) {
      filterTier = arg.split('=')[1]?.trim().toUpperCase() as any;
    } else if (arg === '--tier' && i + 1 < argv.length) {
      filterTier = argv[++i].trim().toUpperCase() as any;
    }
  }

  return { dryRun, sample, force, race, element, filterTier };
}

/**
 * Batch art generation runner with resumption, rate-limiting, and tier filtering.
 */
export async function generateArtMatrix(options: ArtMatrixOptions = {}): Promise<ArtMatrixItem[]> {
  const isDryRun = Boolean(options.dryRun);
  const items = buildArtMatrix({
    sample: options.sample,
    race: options.race,
    element: options.element,
    filterTier: options.filterTier,
    outputDir: options.outputDir,
  });

  const targetDir = resolveCharactersDirectory(options.outputDir);
  if (!fs.existsSync(targetDir) && !isDryRun) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  console.log(`[Art Matrix] Initializing batch generator with ${items.length} items (dryRun: ${isDryRun})`);

  const raceTotals = new Map<string, number>();
  for (const it of items) {
    raceTotals.set(it.race, (raceTotals.get(it.race) || 0) + 1);
  }
  const raceCompleted = new Map<string, number>();

  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    if (isDryRun) {
      const currentCompleted = (raceCompleted.get(item.race) || 0) + 1;
      raceCompleted.set(item.race, currentCompleted);
      const raceTotal = raceTotals.get(item.race) || items.length;

      if (fs.existsSync(item.targetPath) && !options.force) {
        console.log(`[SKIP] ${item.fileName} exists, skipping.`);
      } else {
        console.log(`[DRY RUN] ${item.relativePath}`);
        console.log(`  Prompt: ${item.prompt}`);
        console.log(`  Negative: ${item.negativePrompt}`);
      }
      console.log(`[Race: ${item.race}] Progress: ${currentCompleted}/${raceTotal} completed`);
      continue;
    }

    // 1. Resumption check before generating any image (checks both race subfolder and flat directory)
    const subfolderPath = path.resolve(targetDir, item.race, item.fileName);
    const destinationPath = fs.existsSync(subfolderPath)
      ? subfolderPath
      : fs.existsSync(item.targetPath)
      ? item.targetPath
      : (fs.existsSync(path.resolve(targetDir, item.race)) ? subfolderPath : item.targetPath);

    if (fs.existsSync(destinationPath) && !options.force) {
      const currentCompleted = (raceCompleted.get(item.race) || 0) + 1;
      raceCompleted.set(item.race, currentCompleted);
      const raceTotal = raceTotals.get(item.race) || items.length;

      console.log(`[SKIP] ${item.fileName} exists, skipping.`);
      console.log(`[Race: ${item.race}] Progress: ${currentCompleted}/${raceTotal} completed`);
      continue;
    }

    try {
      console.log(`[GENERATING] ${item.fileName}...`);
      let buffer: Buffer | void;
      if (options.generator) {
        buffer = await options.generator(item);
      } else {
        buffer = await invokeNanoBananaRunner(item);
      }

      if (buffer && Buffer.isBuffer(buffer)) {
        const writePath = destinationPath;
        fs.mkdirSync(path.dirname(writePath), { recursive: true });
        fs.writeFileSync(writePath, buffer);
        console.log(`[SAVED] -> ${writePath}`);
      }
    } catch (err) {
      console.error(`[ERROR] Failed to generate ${item.fileName}:`, err);
    }

    const currentCompleted = (raceCompleted.get(item.race) || 0) + 1;
    raceCompleted.set(item.race, currentCompleted);
    const raceTotal = raceTotals.get(item.race) || items.length;
    console.log(`[Race: ${item.race}] Progress: ${currentCompleted}/${raceTotal} completed`);

    // Add 1.5-second pacing delay between consecutive generation calls to prevent API rate limiting
    const delay = options.pacingDelayMs !== undefined ? options.pacingDelayMs : 1500;
    if (delay > 0 && i < items.length - 1) {
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  return items;
}

// Direct CLI invocation hook
if (
  process.argv[1] &&
  (process.argv[1].endsWith('generate-characters.ts') || process.argv[1].endsWith('generate-characters.js'))
) {
  const cliOptions = parseCliArgs(process.argv.slice(2));

  generateArtMatrix(cliOptions)
    .then((processed) => {
      console.log(`[Art Matrix Batch] Complete. Processed ${processed.length} character art items.`);
    })
    .catch((err) => {
      console.error('[Art Matrix Error]:', err);
      process.exit(1);
    });
}
