import { generateCardFromSeed, CardEntity } from '@cjverse/game-logic';
import { renderCardComposite } from '@cjverse/asset-pipeline';
import { checkAndSetCooldown, resetCooldowns } from '../services/cooldown';

export { resetCooldowns };

export interface HuntResult {
  success: boolean;
  card?: CardEntity;
  imageBuffer?: Buffer;
  cooldownRemainingMs?: number;
}

export async function handleHuntCommand(userId: string, _username: string): Promise<HuntResult> {
  const cd = checkAndSetCooldown(userId);
  if (!cd.allowed) {
    return {
      success: false,
      cooldownRemainingMs: cd.remainingMs
    };
  }

  // Generate card from pseudo-random seed
  const seed = Math.floor(Math.random() * 1_000_000_000);
  const card = generateCardFromSeed(seed);

  // Render card image buffer
  const imageBuffer = await renderCardComposite(card);

  return {
    success: true,
    card,
    imageBuffer
  };
}
