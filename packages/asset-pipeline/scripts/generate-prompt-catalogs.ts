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
 * Tiered element configuration with unique hand poses, controlled micro-expressions,
 * armor upgrades, and background hierarchy.
 */
export interface ElementTieredConfig {
  tier: 'S' | 'A' | 'B' | 'C';
  tierCategory: 'Legendary' | 'Primal' | 'Specialized' | 'Composite';
  bgTierPrefix: string;
  facialExpression: string;
  handAction: string;
  backgroundVfx: string;
  armorUpgrade: string;
  maleCrown?: string;
  femaleCrown?: string;
}

export const ELEMENT_TIERED_CONFIGS: Record<string, ElementTieredConfig> = {
  // --- TIER S (Legendary) ---
  void: {
    tier: 'S',
    tierCategory: 'Legendary',
    bgTierPrefix: 'mythical background with',
    facialExpression: 'calm divine detachment with cold aloof micro-smirk and piercing glowing eyes',
    maleCrown: 'floating heavy spiked imperial ethereal void-energy halo circlet hovering above brow',
    femaleCrown: 'floating sleek high-arched ethereal void-energy tiara halo hovering above brow',
    armorUpgrade: 'sovereign abyssal god-metal plate armor overlays in royal deep purple and void-black velvet with polished platinum trims, floating levitating segmented shoulder pauldrons, and a regal flowing void-silk mantle',
    handAction: 'right hand crushing an imploding void sphere while left hand rests firmly on the hip plate',
    backgroundVfx: 'deep purple event horizons, cosmic gravity distortion, and abyssal black holes filling the entire backdrop',
  },
  time: {
    tier: 'S',
    tierCategory: 'Legendary',
    bgTierPrefix: 'mythical background with',
    facialExpression: 'calm divine detachment with cold aloof micro-smirk and piercing glowing eyes',
    maleCrown: 'floating heavy spiked imperial chronos-energy halo circlet with rotating gear teeth',
    femaleCrown: 'floating sleek high-arched chronos-energy tiara halo with glowing golden pendulum spikes',
    armorUpgrade: 'transcendent chronos-forged astral plate overlays in pristine astral white and celestial blue with gilded brass clockwork gears, floating gear-halo pauldrons, and a shifting molten-gold sash',
    handAction: 'raised right hand manipulating floating golden chronos dials while left hand rests poised on the belt plate',
    backgroundVfx: 'glowing molten gold chronos gear arrays, ticking astral clock faces, and temporal distortion waves filling the entire backdrop',
  },
  cosmic: {
    tier: 'S',
    tierCategory: 'Legendary',
    bgTierPrefix: 'mythical background with',
    facialExpression: 'calm divine detachment with cold aloof micro-smirk and piercing glowing eyes',
    maleCrown: 'floating heavy spiked imperial stellar corona halo circlet with orbiting starlight motes',
    femaleCrown: 'floating sleek high-arched celestial stardust tiara halo glowing with astral light',
    armorUpgrade: 'celestial star-forged platinum armor overlays in deep indigo and shimmering midnight-violet with radiant stardust filigree, levitating galaxy-crested pauldrons, and a nebula-woven astral mantle',
    handAction: 'raised right hand cradling a swirling miniature spiral galaxy while left hand rests firmly on the side hip armor',
    backgroundVfx: 'deep violet spiral galaxies, radiant star clusters, and stellar stardust nebulae filling the entire backdrop',
  },
  arcane: {
    tier: 'S',
    tierCategory: 'Legendary',
    bgTierPrefix: 'mythical background with',
    facialExpression: 'calm divine detachment with cold aloof micro-smirk and piercing glowing eyes',
    maleCrown: 'floating heavy spiked imperial cyan glyph halo circlet radiating concentric spell runes',
    femaleCrown: 'floating sleek high-arched crystalline mana tiara halo glowing with ethereal cyan light',
    armorUpgrade: 'grand magus battle plate overlays in deep sapphire and luminescent cyan with silver runic embroidery, levitating crystalline mana-shard pauldrons, hovering glowing glyph rings, and high-collared ethereal robes',
    handAction: 'outstretched right hand projecting a radiant cyan glyph circle while left hand rests securely on the waist plate',
    backgroundVfx: 'concentric glowing cyan runic spell circles, floating arcane glyph matrices, and ethereal spell tomes filling the entire backdrop',
  },
  chaos: {
    tier: 'S',
    tierCategory: 'Legendary',
    bgTierPrefix: 'mythical background with',
    facialExpression: 'fierce battle glare with clenched jaw, gritted teeth, and burning intense war gaze',
    maleCrown: 'floating heavy spiked imperial jagged rift-energy halo circlet with crackling glitch arcs',
    femaleCrown: 'floating sleek high-arched volatile chaos tiara halo with flickering violet-crimson sparks',
    armorUpgrade: 'reality-warping jagged obsidian god-plate overlays in volatile violet-crimson and fractured black with blood-gold trims, hovering fractured rift-metal pauldrons, and shifting glitch-energy tassels',
    handAction: 'raised right hand gripping a volatile reality-fracturing rift while left hand rests steadily against the hip plate',
    backgroundVfx: 'shattered reality rifts, jagged glitch-energy arcs, and volatile violet-crimson sparks filling the entire backdrop',
  },

  // --- TIER A (Primal) ---
  fire: {
    tier: 'A',
    tierCategory: 'Primal',
    bgTierPrefix: 'legendary background with',
    facialExpression: 'fierce battle glare with clenched jaw, gritted teeth, and burning intense war gaze',
    armorUpgrade: 'high warlord battle regalia in burning crimson and volcanic obsidian with molten brass trims, heavy sculpted dragon-crest pauldrons, layered volcanic scale cuirass, glowing magma-vein runic channels pulsing across the chestplate, and a high-collared scorched war-mantle',
    handAction: 'raised right hand gripping an incandescent magma orb while left hand rests firmly on the side hip plate',
    backgroundVfx: 'raging crimson infernos, molten magma cracks, and swirling blazing ember halos filling the entire backdrop',
  },
  ice: {
    tier: 'A',
    tierCategory: 'Primal',
    bgTierPrefix: 'legendary background with',
    facialExpression: 'calm divine detachment with cold aloof micro-smirk and piercing glowing eyes',
    armorUpgrade: 'grand champion glacial battle plate in frosted cerulean and diamond-white with polished silver trims, sculpted ice-dragon crest pauldrons, layered frost scale mail, glowing sub-zero runes carved into the cuirass, and an arctic fur-lined mantle',
    handAction: 'thrust forward right hand condensing a glacial frost vortex while left hand rests anchored at the hip armor',
    backgroundVfx: 'howling blizzard squalls, diamond frost fractures, and crystalline glacial shards filling the entire backdrop',
  },
  lightning: {
    tier: 'A',
    tierCategory: 'Primal',
    bgTierPrefix: 'legendary background with',
    facialExpression: 'fierce battle glare with clenched jaw, gritted teeth, and burning intense war gaze',
    armorUpgrade: 'high warlord storm battle plate in electric azure and deep thunder-navy with conductive gold trims, aerodynamic electrified crest pauldrons, crackling plasma conduit channels across the cuirass, and a tempest war-mantle',
    handAction: 'raised right claw channeling crackling azure plasma arcs while left hand rests grounded against the hip plate',
    backgroundVfx: 'violent lightning strikes, high-voltage electric arcs, and ionized corona sparks filling the entire backdrop',
  },
  shadow: {
    tier: 'A',
    tierCategory: 'Primal',
    bgTierPrefix: 'legendary background with',
    facialExpression: 'calm divine detachment with cold aloof micro-smirk and piercing glowing eyes',
    armorUpgrade: 'abyssal assassin-lord battle plate in midnight-black and muted violet with dark obsidian trims, sculpted night-beast pauldrons, blackened scale-weave cuirass, pulsing umbral shadow veins, and a tattered shroud of darkness',
    handAction: 'raised right hand weaving ribbons of solid dark abyss while left hand rests motionless against the waist plate',
    backgroundVfx: 'churning abyssal smoke tendrils, suffocating darkness shrouds, and violet phantom glow filling the entire backdrop',
  },
  light: {
    tier: 'A',
    tierCategory: 'Primal',
    bgTierPrefix: 'legendary background with',
    facialExpression: 'stern unbreakable jaw with focused stoic expression and solemn combat focus',
    armorUpgrade: 'solar-crested paladin battle plate in immaculate pearl-white and radiant gold with reflective crystal trims, gleaming winged pauldrons, holy sunburst rune matrices across the breastplate, and a flowing ivory war-mantle',
    handAction: 'uplifted right hand unleashing a blinding solar corona while left hand rests calmly against the side armor',
    backgroundVfx: 'radiant blinding solar rays, celestial light pillars, and holy prismatic halos filling the entire backdrop',
  },
  nature: {
    tier: 'A',
    tierCategory: 'Primal',
    bgTierPrefix: 'legendary background with',
    facialExpression: 'stern unbreakable jaw with focused stoic expression and solemn combat focus',
    armorUpgrade: 'verdant battle regalia in deep forest emerald and living ironwood-brown with amber trims, petrified bark shoulder pauldrons, living thorned vine-wrapped cuirass, glowing emerald runic channels, and a blooming druidic war-cloak',
    handAction: 'curved right hand sprouting bioluminescent thorned vines while left hand rests planted on the hip plate',
    backgroundVfx: 'swirling emerald pollen tempests, glowing bioluminescent vines, and blooming thorny brambles filling the entire backdrop',
  },
  blood: {
    tier: 'A',
    tierCategory: 'Primal',
    bgTierPrefix: 'legendary background with',
    facialExpression: 'fierce battle glare with clenched jaw, gritted teeth, and burning intense war gaze',
    armorUpgrade: 'sanguine champion battle plate in deep vermilion and dark crimson with blackened iron trims, jagged ruby-crested pauldrons, layered chitin scale cuirass, glowing vital essence channels across the chest, and an ornate blood-draped mantle',
    handAction: 'clenched right hand drawing forth orbiting crimson essence ribbons while left hand rests firmly on the waist',
    backgroundVfx: 'swirling sanguine blood ribbons, dark ruby droplet halos, and vital hemorrhage aura filling the entire backdrop',
  },

  // --- TIER B (Specialized) ---
  water: {
    tier: 'B',
    tierCategory: 'Specialized',
    bgTierPrefix: 'epic background with',
    facialExpression: 'stern unbreakable jaw with focused stoic expression and solemn combat focus',
    armorUpgrade: 'heavy forged aquamarine sea-carapace plate armor, ribbed tide-crest shoulder guards, polished ocean-tempered steel trims, and wave-patterned combat fabric',
    handAction: 'extended right hand directing a coiling aquamarine water serpent while left hand rests poised on the hip armor',
    backgroundVfx: 'coiling water serpents, swirling tidal vortex torrents, and bioluminescent ocean spray filling the entire backdrop',
  },
  wind: {
    tier: 'B',
    tierCategory: 'Specialized',
    bgTierPrefix: 'epic background with',
    facialExpression: 'stern unbreakable jaw with focused stoic expression and solemn combat focus',
    armorUpgrade: 'streamlined gale-tempered steel plate armor, swept aerodynamic blade pauldrons, reinforced jade-tinted scale segments, and windward combat sashes',
    handAction: 'swept right hand releasing curved translucent aerokinetic blades while left hand rests grounded against the waist',
    backgroundVfx: 'whistling translucent jade wind blades, razor aerokinetic cutting gales, and tempest vortexes filling the entire backdrop',
  },
  earth: {
    tier: 'B',
    tierCategory: 'Specialized',
    bgTierPrefix: 'epic background with',
    facialExpression: 'stern unbreakable jaw with focused stoic expression and solemn combat focus',
    armorUpgrade: 'heavy forged dark granite slab-plate cuirass, chiseled tectonic pauldron plates, reinforced earthen runic rivets, and tempered iron vambraces',
    handAction: 'upturned right palm levitating jagged granite boulders and geode crystals while left hand rests anchored on the hip plate',
    backgroundVfx: 'levitating granite boulders, granite stone armor plating, and earthen geode crystals filling the entire backdrop',
  },
  poison: {
    tier: 'B',
    tierCategory: 'Specialized',
    bgTierPrefix: 'epic background with',
    facialExpression: 'predatory squint with subtle sinister calculating smirk',
    armorUpgrade: 'hardened venom-treated scale plate armor, ribbed viper-fang shoulder guards, corrosion-resistant dark iron trims, and reinforced emerald miasma bracers',
    handAction: 'raised right hand distilling caustic venom droplets from claw tips while left hand rests steady against the hip plate',
    backgroundVfx: 'noxious emerald miasma plumes, corrosive venom drips, and sickly toxic fume bubbles filling the entire backdrop',
  },
  sound: {
    tier: 'B',
    tierCategory: 'Specialized',
    bgTierPrefix: 'epic background with',
    facialExpression: 'stern unbreakable jaw with focused stoic expression and solemn combat focus',
    armorUpgrade: 'resonant layered bell-bronze and steel plate armor, acoustic tuning-fork crests on the pauldrons, ribbed vibration-absorbing chest channels, and reinforced vambraces',
    handAction: 'open right palm projecting oscillating sonic shockwave rings while left hand rests planted against the side armor',
    backgroundVfx: 'concentric sonic shockwave rings, oscillating vibrational ripples, and pulsing frequency waves filling the entire backdrop',
  },
  metal: {
    tier: 'B',
    tierCategory: 'Specialized',
    bgTierPrefix: 'epic background with',
    facialExpression: 'stern unbreakable jaw with focused stoic expression and solemn combat focus',
    armorUpgrade: 'heavy polished titanium plate armor, overlapping honed steel razor pauldrons, liquid mercury filigree trims, and a solid iron-banded gorget',
    handAction: 'raised right hand levitating honed titanium spikes and liquid mercury filigree while left hand rests firmly on the waist armor',
    backgroundVfx: 'floating razor steel spikes, polished titanium blades, and swirling liquid mercury filigree filling the entire backdrop',
  },

  // --- TIER C (Composite) ---
  sand: {
    tier: 'C',
    tierCategory: 'Composite',
    bgTierPrefix: 'rare background with',
    facialExpression: 'predatory squint with subtle sinister calculating smirk',
    armorUpgrade: 'subtle desert-sand weathering, faint golden sand particulate coating the iron plate, raw bone fasteners, and a desert-worn hood wrap',
    handAction: 'raised right hand dispersing abrasive golden particulate dunes while left hand rests planted against the hip plate',
    backgroundVfx: 'swirling desert sand plumes, abrasive golden particulate dunes, and ancient tomb dust filling the entire backdrop',
  },
  mist: {
    tier: 'C',
    tierCategory: 'Composite',
    bgTierPrefix: 'rare background with',
    facialExpression: 'predatory squint with subtle sinister calculating smirk',
    armorUpgrade: 'subtle damp spectral vapor condensation along the dark iron armor, etched bone clasps, and a thin translucent moisture-weave mantle',
    handAction: 'parted right hand parting spectral damp vapor veils while left hand rests gently against the side plate',
    backgroundVfx: 'rolling damp spectral mist blankets, translucent vapor veils, and ethereal moisture haze filling the entire backdrop',
  },
  smoke: {
    tier: 'C',
    tierCategory: 'Composite',
    bgTierPrefix: 'rare background with',
    facialExpression: 'predatory squint with subtle sinister calculating smirk',
    armorUpgrade: 'subtle scorched soot and volcanic ash residue dusting the dark iron plate, darkened raw bone fasteners, and a weathered ash-stained cowl',
    handAction: 'cupped right hand exhaling dense volcanic ash plumes while left hand rests braced against the hip armor',
    backgroundVfx: 'dense volcanic ash plumes, smoldering gray embers, and pitch-black billow clouds filling the entire backdrop',
  },
  crystal: {
    tier: 'C',
    tierCategory: 'Composite',
    bgTierPrefix: 'rare background with',
    facialExpression: 'predatory squint with subtle sinister calculating smirk',
    armorUpgrade: 'subtle raw amethyst mineral shards jutting from the iron shoulder joints, jagged quartz studs, and simple dark iron fasteners',
    handAction: 'raised right hand forming sharp amethyst quartz facets while left hand rests anchored against the waist plate',
    backgroundVfx: 'glittering quartz crystal spires, prismatic amethyst facets, and sparkling gemstone shards filling the entire backdrop',
  },
  acid: {
    tier: 'C',
    tierCategory: 'Composite',
    bgTierPrefix: 'rare background with',
    facialExpression: 'predatory squint with subtle sinister calculating smirk',
    armorUpgrade: 'subtle caustic etching and bubbling green slime drips across the dark iron plate edges, reinforced ceramic fasteners, and a weathered scout collar',
    handAction: 'pointed right hand spraying dissolving fluorescent green slime vapors while left hand rests firmly on the hip plate',
    backgroundVfx: 'rising corrosive fluorescent green acid vapors, bubbling puddle mist, and dissolving chemical fumes filling the entire backdrop',
  },
};

/**
 * Non-humanoid facial anatomy and physiological anchors per race and gender.
 */
export const RACIAL_ANATOMY_ANCHORS: Record<string, Record<string, string>> = {
  dragon: {
    male: 'Noble draconic reptilian visage, pristine interlocking scales fully covering face and neck, sharp brow ridge, twin backward-swept horns, pointed dragon ears, reptilian slit eyes, chin spike, zero smooth human skin',
    female: 'Sleeker noble draconic reptilian visage, pristine interlocking scales fully covering face and neck, fine faceted scales over entire face and cheeks, sharp brow ridge, twin backward-swept horns, finned dragon ears, reptilian slit eyes, chin spike, zero smooth human skin',
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
    male: 'Noble dwarven warrior face, massive braided beard, chiseled wide jaw, furrowed brow, fierce stoic gaze',
    female: 'Battle-hardened dwarven warrior, chiseled wide jaw, thick braided hair with metallic beads, sturdy stoic expression',
  },
  elf: {
    male: 'Ethereal noble elf visage, long slender backward-swept ears, sharp angular cheekbones, pupil-less luminous eyes, flawless porcelain skin',
    female: 'Otherworldly elegant elf visage, long slender backward-swept ears, sharp angular cheekbones, pupil-less luminous eyes, ethereal sharp features, flawless porcelain skin',
  },
  human: {
    male: 'Noble human warrior, chiseled jawline, intense focused gaze, short textured hair, pristine smooth skin, flawless complexion',
    female: 'Noble human warrior, sharp jawline, intense combat gaze, tied-back war hair, pristine smooth skin, flawless complexion',
  },
};

/**
 * Strict racial facial anatomy anchors matching base reference specifications.
 */
export const BASE_RACIAL_ANATOMY_ANCHORS: Record<string, Record<string, string>> = {
  dragon: {
    male: 'Noble draconic reptilian visage, pristine interlocking scales fully covering face and neck, sharp brow ridge, twin backward-swept horns, pointed dragon ears, reptilian slit eyes, chin spike, zero smooth human skin',
    female: 'Sleeker noble draconic reptilian visage, pristine interlocking scales fully covering face and neck, fine faceted scales over entire face and cheeks, sharp brow ridge, twin backward-swept horns, finned dragon ears, reptilian slit eyes, chin spike, zero smooth human skin',
  },
  human: {
    male: 'Noble human warrior, chiseled jawline, intense focused gaze, short textured hair, pristine smooth skin, flawless complexion',
    female: 'Noble human warrior, sharp jawline, intense combat gaze, tied-back war hair, pristine smooth skin, flawless complexion',
  },
  elf: {
    male: 'Ethereal noble elf visage, long slender backward-swept ears, sharp angular cheekbones, pupil-less luminous eyes, flawless porcelain skin',
    female: 'Otherworldly elegant elf visage, long slender backward-swept ears, sharp angular cheekbones, pupil-less luminous eyes, ethereal sharp features, flawless porcelain skin',
  },
  dwarf: {
    male: 'Noble dwarven warrior face, massive braided beard, chiseled wide jaw, furrowed brow, fierce stoic gaze',
    female: 'Battle-hardened dwarven warrior, chiseled wide jaw, thick braided hair with metallic beads, sturdy stoic expression',
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
      BASE_RACIAL_ANATOMY_ANCHORS[raceLower]?.[genderLower] ||
      `${genderLower} ${raceLower} warrior`;

    for (const element of ELEMENTS) {
      const elemLower = element.toLowerCase();
      const config = ELEMENT_TIERED_CONFIGS[elemLower];
      const handAction = config.handAction;
      const crownPart = config.tier === 'S'
        ? `${genderLower === 'male' ? config.maleCrown : config.femaleCrown}, `
        : '';

      const key = `${raceLower}_${genderLower}_${elemLower}`;
      const targetFile = `packages/asset-pipeline/assets/characters/${raceLower}/${key}.png`;
      const prompt = `Masterpiece character concept art portrait, ${genderLower} ${raceLower} warrior channeling ${elemLower} magic, ${anatomyAnchor}, ${config.facialExpression}, ${crownPart}upgraded with ${config.armorUpgrade}, ${handAction}, ${config.bgTierPrefix} ${config.backgroundVfx}, ${POSITIVE_ARM_ANATOMY_ENFORCER}, centered half-body waist-up portrait, facing camera, no full-body shots, dark fantasy manhwa illustration, bold heavy ink outlines, sharp cel-shading, vibrant rim-lighting, borderless, frameless, edge-to-edge illustration, 8k resolution, trending on ArtStation`;

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
    const prompt = `Masterpiece base character concept art portrait, ${genderLower} ${raceLower} warrior, ${anatomy}, neutral glowing white/pale-gray eyes, pristine polished dark slate-iron plate armor with unlit, uncharged runic engravings, neutral hands resting forward at mid-chest (no elemental orbs, no fire, no lightning), anatomically correct, exactly two arms, two hands only, centered half-body waist-up portrait, directly facing camera, no full-body shots, high-contrast dark fantasy manhwa style, bold heavy ink outlines, sharp cel-shading, vibrant rim-lighting, seamless pitch-black solid dark background, borderless, frameless, edge-to-edge illustration, 8k resolution, trending on ArtStation`;

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
      const crownPart = config.tier === 'S'
        ? `${genderLower === 'male' ? config.maleCrown : config.femaleCrown}, `
        : '';

      const key = `${raceLower}_${genderLower}_${elemLower}`;
      const destination = `packages/asset-pipeline/assets/characters/${raceLower}/${key}.png`;
      const modificationTask = `Keep the exact facial features, horns, hair, skin/scale texture, framing, and armor silhouette of the reference image. Ignite the dark slate iron armor runes with ${elemLower} energy, ${crownPart}upgraded with ${config.armorUpgrade}. Display a ${config.facialExpression}. Pose with ${config.handAction}, channeling ${elemLower} magic (${config.bgTierPrefix} ${config.backgroundVfx}).`;
      const prompt = `Masterpiece character concept art portrait, ${genderLower} ${raceLower} warrior channeling ${elemLower} magic, based on reference portrait packages/asset-pipeline/assets/normal/${raceLower}/${raceLower}_${genderLower}_base.png, keep exact facial features, horns, hair, skin/scale texture, framing, and armor silhouette of reference image, ${config.facialExpression}, ignite dark slate iron armor runes with ${elemLower} energy, ${crownPart}upgraded with ${config.armorUpgrade}, ${config.handAction}, ${config.bgTierPrefix} ${config.backgroundVfx}, ${POSITIVE_ARM_ANATOMY_ENFORCER}, centered half-body waist-up portrait, facing camera, high-contrast dark fantasy manhwa style, bold heavy ink outlines, sharp cel-shading, vibrant rim-lighting, borderless, frameless, edge-to-edge illustration, 8k resolution, trending on ArtStation`;

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
