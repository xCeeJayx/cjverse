import fs from 'node:fs';
import path from 'node:path';
import {
  RACES,
  GENDERS,
  ELEMENTS,
  ELEMENT_VISUAL_THEMES,
} from './generate-characters';

export const GLOBAL_NEGATIVE_PROMPT =
  'extra arms, three arms, extra hands, three hands, duplicate arms, duplicate hands, floating limbs, mutated hands, bad anatomy, deformed fingers, extra limbs, smooth human skin, human face, human ears, cosplay, card, border, frame, ornate frame, outer box, UI, HUD, text, watermark, signature';

export const STRICT_NEGATIVE_PROMPT = GLOBAL_NEGATIVE_PROMPT;

export const POSITIVE_ARM_ANATOMY_ENFORCER =
  'anatomically correct, exactly two arms, two hands only, one hand active, other hand resting at side or hip';

/**
 * Tiered element configuration with unique hand poses and background hierarchy:
 * - Tier S (Legendary): Complex dimensional backgrounds
 * - Tier A (Primal): Dynamic elemental tempests
 * - Tier B (Specialized): Focused physical elements
 * - Tier C (Composite): Subtle atmospheric effects
 */
export interface ElementTieredConfig {
  tier: 'S' | 'A' | 'B' | 'C';
  tierCategory: 'Legendary' | 'Primal' | 'Specialized' | 'Composite';
  handAction: string;
  backgroundVfx: string;
  armorUpgrade: string;
}

export const ELEMENT_TIERED_CONFIGS: Record<string, ElementTieredConfig> = {
  // Tier S (Legendary) - Complex dimensional backgrounds
  void: {
    tier: 'S',
    tierCategory: 'Legendary',
    handAction: 'right hand crushing an imploding void sphere while left hand rests firmly on the hip plate',
    backgroundVfx: 'complex dimensional background with deep purple event horizons, cosmic gravity distortion, and abyssal black holes',
    armorUpgrade: 'sovereign abyssal god-metal plate armor overlays, floating levitating dragon-crest shoulder pauldrons, an ornate crowned draconic horn diadem, and a regal flowing void-silk mantle',
  },
  time: {
    tier: 'S',
    tierCategory: 'Legendary',
    handAction: 'raised right hand manipulating floating golden chronos dials while left hand rests poised on the belt plate',
    backgroundVfx: 'complex dimensional background with glowing molten gold chronos gear arrays, ticking astral clock faces, and temporal distortion waves',
    armorUpgrade: 'transcendent chronos-forged astral plate overlays, floating gilded gear-halo pauldrons, an intricate temporal clockwork diadem, and a shifting molten-gold sash',
  },
  cosmic: {
    tier: 'S',
    tierCategory: 'Legendary',
    handAction: 'raised right hand cradling a swirling miniature spiral galaxy while left hand rests firmly on the side hip armor',
    backgroundVfx: 'complex dimensional background with deep violet spiral galaxies, radiant star clusters, and stellar stardust nebulae',
    armorUpgrade: 'celestial star-forged platinum armor overlays, levitating galaxy-crested pauldrons, glowing astral stardust filigree, and a deep violet nebula-woven mantle',
  },
  arcane: {
    tier: 'S',
    tierCategory: 'Legendary',
    handAction: 'outstretched right hand projecting a radiant cyan glyph circle while left hand rests securely on the waist plate',
    backgroundVfx: 'complex dimensional background with concentric glowing cyan runic spell circles, floating arcane glyph matrices, and ethereal spell tomes',
    armorUpgrade: 'grand magus runic battle plate overlays, levitating crystalline mana-shard pauldrons, hovering glowing glyph rings, and high-collared cyan ethereal robes',
  },
  chaos: {
    tier: 'S',
    tierCategory: 'Legendary',
    handAction: 'raised right hand gripping a volatile reality-fracturing rift while left hand rests steadily against the hip plate',
    backgroundVfx: 'complex dimensional background with shattered reality rifts, jagged glitch-energy arcs, and volatile violet-crimson sparks',
    armorUpgrade: 'reality-warping jagged obsidian god-plate overlays, hovering fractured rift-metal pauldrons, crowned barbed spikes, and shifting volatile glitch-energy tassels',
  },

  // Tier A (Primal) - Dynamic elemental tempests
  fire: {
    tier: 'A',
    tierCategory: 'Primal',
    handAction: 'raised right hand gripping an incandescent magma orb while left hand rests firmly on the side hip plate',
    backgroundVfx: 'dynamic elemental tempest background with raging crimson infernos, molten magma cracks, and swirling blazing ember halos',
    armorUpgrade: 'heavy sculpted crimson-gold dragon-crest pauldrons, layered overlapping volcanic drake-scale cuirass, glowing magma-vein runic channels pulsing across the chestplate, and a high-collared scorched war-mantle',
  },
  ice: {
    tier: 'A',
    tierCategory: 'Primal',
    handAction: 'thrust forward right hand condensing a glacial frost vortex while left hand rests anchored at the hip armor',
    backgroundVfx: 'dynamic elemental tempest background with howling blizzard squalls, diamond frost fractures, and crystalline glacial shards',
    armorUpgrade: 'sculpted glacial dragon-plate, jagged diamond-ice shoulder spires, layered frosted scale mail, glowing sub-zero frost runes carved into the cuirass, and an arctic fur-lined mantle',
  },
  lightning: {
    tier: 'A',
    tierCategory: 'Primal',
    handAction: 'raised right claw channeling crackling azure plasma arcs while left hand rests grounded against the hip plate',
    backgroundVfx: 'dynamic elemental tempest background with violent lightning strikes, high-voltage electric arcs, and ionized corona sparks',
    armorUpgrade: 'aerodynamic electrified dragon-crest armor, jutting storm-fang pauldrons, conductive azure-gold scale plate, crackling plasma conduit channels, and a high-collared tempest cloak',
  },
  shadow: {
    tier: 'A',
    tierCategory: 'Primal',
    handAction: 'raised right hand weaving ribbons of solid dark abyss while left hand rests motionless against the waist plate',
    backgroundVfx: 'dynamic elemental tempest background with churning abyssal smoke tendrils, suffocating darkness shrouds, and violet phantom glow',
    armorUpgrade: 'ornate abyssal assassin-lord battle plate, sculpted night-drake pauldrons, blackened scale-weave cuirass, pulsing umbral shadow veins, and a tattered shroud of darkness',
  },
  light: {
    tier: 'A',
    tierCategory: 'Primal',
    handAction: 'uplifted right hand unleashing a blinding solar corona while left hand rests calmly against the side armor',
    backgroundVfx: 'dynamic elemental tempest background with radiant blinding solar rays, celestial light pillars, and holy prismatic halos',
    armorUpgrade: 'radiant solar-crested paladin dragon armor, gleaming gilded wing pauldrons, holy reflective breastplate, glowing sunburst rune matrices, and an immaculate ivory war-mantle',
  },
  nature: {
    tier: 'A',
    tierCategory: 'Primal',
    handAction: 'curved right hand sprouting bioluminescent thorned vines while left hand rests planted on the hip plate',
    backgroundVfx: 'dynamic elemental tempest background with swirling emerald pollen tempests, glowing bioluminescent vines, and blooming thorny brambles',
    armorUpgrade: 'verdant dragon-scale battle regalia, petrified ironwood pauldrons, living thorned vine-wrapped cuirass, glowing emerald runic carvings, and a blossoming druidic war-cloak',
  },
  blood: {
    tier: 'A',
    tierCategory: 'Primal',
    handAction: 'clenched right hand drawing forth orbiting crimson essence ribbons while left hand rests firmly on the waist',
    backgroundVfx: 'dynamic elemental tempest background with swirling sanguine blood ribbons, dark ruby droplet halos, and vital hemorrhage aura',
    armorUpgrade: 'barbed sanguis dragon armor, jagged ruby-crested pauldrons, layered crimson chitin scale plate, glowing vital essence channels across the chest, and an ornate blood-draped mantle',
  },

  // Tier B (Specialized) - Focused physical elements
  water: {
    tier: 'B',
    tierCategory: 'Specialized',
    handAction: 'extended right hand directing a coiling aquamarine water serpent while left hand rests poised on the hip armor',
    backgroundVfx: 'focused physical element background with coiling water serpents, swirling tidal vortex torrents, and bioluminescent ocean spray',
    armorUpgrade: 'heavy forged aquamarine sea-drake carapace plate, ribbed tide-crest shoulder guards, polished ocean-tempered steel trims, and flowing wave-patterned combat fabric',
  },
  wind: {
    tier: 'B',
    tierCategory: 'Specialized',
    handAction: 'swept right hand releasing curved translucent aerokinetic blades while left hand rests grounded against the waist',
    backgroundVfx: 'focused physical element background with whistling translucent jade wind blades, razor aerokinetic cutting gales, and tempest vortexes',
    armorUpgrade: 'streamlined gale-tempered steel cuirass, swept aerodynamic blade pauldrons, reinforced jade-tinted scale segments, and flowing windward combat sashes',
  },
  earth: {
    tier: 'B',
    tierCategory: 'Specialized',
    handAction: 'upturned right palm levitating jagged granite boulders and geode crystals while left hand rests anchored on the hip plate',
    backgroundVfx: 'focused physical element background with levitating granite boulders, granite stone armor plating, and earthen geode crystals',
    armorUpgrade: 'heavy forged dark granite slab-plate cuirass, chiseled tectonic pauldron plates, reinforced earthen runic rivets, and tempered dragon-iron vambraces',
  },
  poison: {
    tier: 'B',
    tierCategory: 'Specialized',
    handAction: 'raised right hand distilling caustic venom droplets from claw tips while left hand rests steady against the hip plate',
    backgroundVfx: 'focused physical element background with noxious emerald miasma plumes, corrosive venom drips, and sickly toxic fume bubbles',
    armorUpgrade: 'hardened venom-dipped dragon-scale plate, ribbed viper-fang shoulder guards, corrosion-resistant dark iron trims, and reinforced emerald miasma bracers',
  },
  sound: {
    tier: 'B',
    tierCategory: 'Specialized',
    handAction: 'open right palm projecting oscillating sonic shockwave rings while left hand rests planted against the side armor',
    backgroundVfx: 'focused physical element background with concentric sonic shockwave rings, oscillating vibrational ripples, and pulsing frequency waves',
    armorUpgrade: 'resonant layered bell-bronze and steel plate armor, acoustic tuning-fork crests on the pauldrons, ribbed vibration-absorbing chest channels, and reinforced vambraces',
  },
  metal: {
    tier: 'B',
    tierCategory: 'Specialized',
    handAction: 'raised right hand levitating honed titanium spikes and liquid mercury filigree while left hand rests firmly on the waist armor',
    backgroundVfx: 'focused physical element background with floating razor steel spikes, polished titanium blades, and swirling liquid mercury filigree',
    armorUpgrade: 'heavy polished titanium dragon-plate, overlapping honed steel razor pauldrons, liquid mercury filigree trims, and a solid iron-banded gorget',
  },

  // Tier C (Composite) - Subtle atmospheric effects
  sand: {
    tier: 'C',
    tierCategory: 'Composite',
    handAction: 'raised right hand dispersing abrasive golden particulate dunes while left hand rests planted against the hip plate',
    backgroundVfx: 'subtle atmospheric background with swirling desert sand plumes, abrasive golden particulate dunes, and ancient tomb dust',
    armorUpgrade: 'light utilitarian sand-drake leather cuirass, reinforced bone fasteners, darkened brass trim, and a desert-worn sandstorm hooded mantle',
  },
  mist: {
    tier: 'C',
    tierCategory: 'Composite',
    handAction: 'parted right hand parting spectral damp vapor veils while left hand rests gently against the side plate',
    backgroundVfx: 'subtle atmospheric background with rolling damp spectral mist blankets, translucent vapor veils, and ethereal moisture haze',
    armorUpgrade: 'lightweight slate-gray drake-hide armor, bone clasps, blackened iron accents, and damp spectral vapor-weave wrapping around the shoulders',
  },
  smoke: {
    tier: 'C',
    tierCategory: 'Composite',
    handAction: 'cupped right hand exhaling dense volcanic ash plumes while left hand rests braced against the hip armor',
    backgroundVfx: 'subtle atmospheric background with dense volcanic ash plumes, smoldering gray embers, and pitch-black billow clouds',
    armorUpgrade: 'lightweight blackened drake-hide scale-leather cuirass, darkened raw bone fasteners, charred iron trim accents, and a weathered ash-stained hooded mantle',
  },
  crystal: {
    tier: 'C',
    tierCategory: 'Composite',
    handAction: 'raised right hand forming sharp amethyst quartz facets while left hand rests anchored against the waist plate',
    backgroundVfx: 'subtle atmospheric background with glittering quartz crystal spires, prismatic amethyst facets, and sparkling gemstone shards',
    armorUpgrade: 'utilitarian dark leather armor reinforced with raw unpolished quartz shard plates, jagged mineral-studded bracers, and simple dark iron fasteners',
  },
  acid: {
    tier: 'C',
    tierCategory: 'Composite',
    handAction: 'pointed right hand spraying dissolving fluorescent green slime vapors while left hand rests firmly on the hip plate',
    backgroundVfx: 'subtle atmospheric background with rising corrosive fluorescent green acid vapors, bubbling puddle mist, and dissolving chemical fumes',
    armorUpgrade: 'corrosion-treated scorched drake-leather brigandine, reinforced ceramic-coated iron fasteners, and an acid-resistant weathered scout wrap',
  },
};

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
      const config = ELEMENT_TIERED_CONFIGS[elemLower];
      const handAction = config.handAction;
      const bgVfx = config.backgroundVfx;

      const key = `${raceLower}_${genderLower}_${elemLower}`;
      const targetFile = `packages/asset-pipeline/assets/characters/${raceLower}/${key}.png`;
      const prompt = `Masterpiece character concept art portrait, ${genderLower} ${raceLower} warrior channeling ${elemLower} magic, ${anatomyAnchor}, upgraded with ${config.armorUpgrade}, ${handAction}, ${bgVfx}, ${POSITIVE_ARM_ANATOMY_ENFORCER}, centered half-body waist-up portrait, facing camera, no full-body shots, dark fantasy manhwa illustration, bold heavy ink outlines, sharp cel-shading, vibrant rim-lighting, seamless pitch-black background, 8k resolution, trending on ArtStation`;

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
    const prompt = `Masterpiece base character concept art portrait, ${genderLower} ${raceLower} warrior, ${anatomy}, neutral glowing white/pale-gray eyes, neutral dark slate/iron armor with unlit, uncharged runic engravings, neutral hands resting forward at mid-chest (no elemental orbs, no fire, no lightning), anatomically correct, exactly two arms, two hands only, centered half-body waist-up portrait, directly facing camera, no full-body shots, high-contrast dark fantasy manhwa style, bold heavy ink outlines, sharp cel-shading, vibrant rim-lighting, seamless pitch-black solid dark background, borderless, frameless, edge-to-edge illustration, 8k resolution, trending on ArtStation`;

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
      const config = ELEMENT_TIERED_CONFIGS[elemLower];
      const handAction = config.handAction;
      const bgVfx = config.backgroundVfx;

      const key = `${raceLower}_${genderLower}_${elemLower}`;
      const destination = `packages/asset-pipeline/assets/characters/${raceLower}/${key}.png`;
      const modificationTask = `Keep the exact facial features, horns, hair, skin/scale texture, framing, and armor silhouette of the reference image. Ignite the armor runes with ${elemLower} energy, upgraded with ${config.armorUpgrade}. Pose with ${handAction}, channeling ${elemLower} magic (${bgVfx}).`;
      const prompt = `Masterpiece character concept art portrait, ${genderLower} ${raceLower} warrior channeling ${elemLower} magic, based on reference portrait packages/asset-pipeline/assets/normal/${raceLower}/${raceLower}_${genderLower}_base.png, keep exact facial features, horns, hair, skin/scale texture, framing, and armor silhouette of reference image, ignite dark slate iron armor runes with ${elemLower} energy, upgraded with ${config.armorUpgrade}, ${handAction}, ${bgVfx}, ${POSITIVE_ARM_ANATOMY_ENFORCER}, centered half-body waist-up portrait, facing camera, high-contrast dark fantasy manhwa style, bold heavy ink outlines, sharp cel-shading, vibrant rim-lighting, seamless pitch-black solid dark background, borderless, frameless, edge-to-edge illustration, 8k resolution, trending on ArtStation`;

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

