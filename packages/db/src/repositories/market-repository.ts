import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '../client';
import { marketListings, MarketListingStatus } from '../schema/market';
import { cards } from '../schema/cards';
import { users } from '../schema/users';
import { findUserById } from './user-repository';
import { findCardById } from './card-repository';

export interface CreateListingParams {
  sellerId: string;
  cardId: string;
  price: number;
}

export interface MarketListingDetail {
  id: string;
  sellerId: string;
  sellerUsername: string;
  cardId: string;
  price: number;
  status: MarketListingStatus;
  createdAt: Date;
  card: {
    id: string;
    race: string;
    variant: string;
    element: string;
    elementTier: string;
    evolutionStage: number;
    level: number;
    powerScore: number;
    seed: number;
    assetPaths: any;
  };
}

export async function createMarketListing(params: CreateListingParams): Promise<{
  success: boolean;
  listing?: typeof marketListings.$inferSelect;
  error?: string;
}> {
  const { sellerId, cardId, price } = params;

  if (price <= 0 || !Number.isInteger(price)) {
    return { success: false, error: 'Price must be a positive integer.' };
  }

  // 1. Fetch user and card
  const user = await findUserById(sellerId);
  if (!user) {
    return { success: false, error: 'Seller user account not found.' };
  }

  const card = await findCardById(cardId);
  if (!card) {
    return { success: false, error: `Card with ID ${cardId} not found.` };
  }

  if (card.userId !== sellerId) {
    return { success: false, error: 'You do not own this card.' };
  }

  // 2. Check if card is currently equipped in active lineup
  const lineup = user.activeLineup;
  if (
    lineup &&
    (lineup.vanguardCardId === cardId ||
      lineup.strikerCardId === cardId ||
      lineup.conduitCardId === cardId)
  ) {
    return {
      success: false,
      error: 'Cannot list a card that is currently equipped in your active lineup.',
    };
  }

  // 3. Check if card is already actively listed
  const [existingListing] = await db
    .select()
    .from(marketListings)
    .where(and(eq(marketListings.cardId, cardId), eq(marketListings.status, 'active')))
    .limit(1);

  if (existingListing) {
    return { success: false, error: 'This card is already listed on the marketplace.' };
  }

  // 4. Insert listing
  const [listing] = await db
    .insert(marketListings)
    .values({
      sellerId,
      cardId,
      price,
      status: 'active',
    })
    .returning();

  return { success: true, listing };
}

export async function findActiveListings(options?: {
  element?: string;
  variant?: string;
  maxPrice?: number;
  limit?: number;
  offset?: number;
}): Promise<MarketListingDetail[]> {
  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;

  const rows = await db
    .select({
      listingId: marketListings.id,
      sellerId: marketListings.sellerId,
      sellerUsername: users.username,
      cardId: marketListings.cardId,
      price: marketListings.price,
      status: marketListings.status,
      createdAt: marketListings.createdAt,
      card: cards,
    })
    .from(marketListings)
    .innerJoin(cards, eq(marketListings.cardId, cards.id))
    .innerJoin(users, eq(marketListings.sellerId, users.id))
    .where(eq(marketListings.status, 'active'))
    .orderBy(desc(marketListings.createdAt))
    .limit(limit)
    .offset(offset);

  let filtered = rows;
  if (options?.element) {
    filtered = filtered.filter(
      (r) => r.card.element.toLowerCase() === options.element!.toLowerCase()
    );
  }
  if (options?.variant) {
    filtered = filtered.filter(
      (r) => r.card.variant.toLowerCase() === options.variant!.toLowerCase()
    );
  }
  if (options?.maxPrice !== undefined) {
    filtered = filtered.filter((r) => r.price <= options.maxPrice!);
  }

  return filtered.map((r) => ({
    id: r.listingId,
    sellerId: r.sellerId,
    sellerUsername: r.sellerUsername,
    cardId: r.cardId,
    price: r.price,
    status: r.status as MarketListingStatus,
    createdAt: r.createdAt,
    card: {
      id: r.card.id,
      race: r.card.race,
      variant: r.card.variant,
      element: r.card.element,
      elementTier: r.card.elementTier,
      evolutionStage: r.card.evolutionStage,
      level: r.card.level,
      powerScore: r.card.powerScore,
      seed: r.card.seed,
      assetPaths: r.card.assetPaths,
    },
  }));
}

export async function findListingById(listingId: string): Promise<MarketListingDetail | null> {
  const [row] = await db
    .select({
      listingId: marketListings.id,
      sellerId: marketListings.sellerId,
      sellerUsername: users.username,
      cardId: marketListings.cardId,
      price: marketListings.price,
      status: marketListings.status,
      createdAt: marketListings.createdAt,
      card: cards,
    })
    .from(marketListings)
    .innerJoin(cards, eq(marketListings.cardId, cards.id))
    .innerJoin(users, eq(marketListings.sellerId, users.id))
    .where(eq(marketListings.id, listingId))
    .limit(1);

  if (!row) return null;

  return {
    id: row.listingId,
    sellerId: row.sellerId,
    sellerUsername: row.sellerUsername,
    cardId: row.cardId,
    price: row.price,
    status: row.status as MarketListingStatus,
    createdAt: row.createdAt,
    card: {
      id: row.card.id,
      race: row.card.race,
      variant: row.card.variant,
      element: row.card.element,
      elementTier: row.card.elementTier,
      evolutionStage: row.card.evolutionStage,
      level: row.card.level,
      powerScore: row.card.powerScore,
      seed: row.card.seed,
      assetPaths: row.card.assetPaths,
    },
  };
}

export async function buyMarketListing(params: {
  listingId: string;
  buyerId: string;
}): Promise<{
  success: boolean;
  error?: string;
  cardName?: string;
  price?: number;
  sellerId?: string;
  buyerCrystalsRemaining?: number;
}> {
  const { listingId, buyerId } = params;

  // 1. Fetch listing
  const [listing] = await db
    .select()
    .from(marketListings)
    .where(eq(marketListings.id, listingId))
    .limit(1);

  if (!listing) {
    return { success: false, error: 'Listing not found.' };
  }

  if (listing.status !== 'active') {
    return { success: false, error: `Listing is already ${listing.status}.` };
  }

  if (listing.sellerId === buyerId) {
    return { success: false, error: 'You cannot buy your own market listing.' };
  }

  // 2. Fetch buyer
  const buyer = await findUserById(buyerId);
  if (!buyer) {
    return { success: false, error: 'Buyer account not found.' };
  }

  if (buyer.crystals < listing.price) {
    return {
      success: false,
      error: `Insufficient crystals. You need ${listing.price} crystals but only have ${buyer.crystals}.`,
    };
  }

  // 3. Fetch card
  const card = await findCardById(listing.cardId);
  if (!card) {
    return { success: false, error: 'Listed card not found.' };
  }

  // 4. Atomic settlement
  const newBuyerCrystals = buyer.crystals - listing.price;

  await db.transaction(async (tx) => {
    // Deduct crystals from buyer
    await tx
      .update(users)
      .set({ crystals: newBuyerCrystals })
      .where(eq(users.id, buyerId));

    // Credit crystals to seller
    await tx
      .update(users)
      .set({ crystals: sql`${users.crystals} + ${listing.price}` })
      .where(eq(users.id, listing.sellerId));

    // Transfer card ownership to buyer
    await tx
      .update(cards)
      .set({ userId: buyerId })
      .where(eq(cards.id, listing.cardId));

    // Mark listing as sold
    await tx
      .update(marketListings)
      .set({ status: 'sold' })
      .where(eq(marketListings.id, listingId));
  });

  const cardName = `${card.variant.toUpperCase()} ${card.race.toUpperCase()}`;

  return {
    success: true,
    cardName,
    price: listing.price,
    sellerId: listing.sellerId,
    buyerCrystalsRemaining: newBuyerCrystals,
  };
}

export async function cancelMarketListing(params: {
  listingId: string;
  sellerId: string;
}): Promise<{ success: boolean; error?: string }> {
  const { listingId, sellerId } = params;

  const [listing] = await db
    .select()
    .from(marketListings)
    .where(eq(marketListings.id, listingId))
    .limit(1);

  if (!listing) {
    return { success: false, error: 'Listing not found.' };
  }

  if (listing.sellerId !== sellerId) {
    return { success: false, error: 'You are not the seller of this listing.' };
  }

  if (listing.status !== 'active') {
    return { success: false, error: `Cannot cancel a listing that is ${listing.status}.` };
  }

  await db
    .update(marketListings)
    .set({ status: 'cancelled' })
    .where(eq(marketListings.id, listingId));

  return { success: true };
}
