# Project Specification: CJVerse (`cjverse.me`)

**Multi-Platform Fantasy Card Collection & Real-Time Skirmish Arena**

---

## 1. Executive Summary & Architecture

### 1.1 High-Level Architecture

CJVerse is a unified TypeScript monorepo combining a Discord social/collection frontend, a real-time authoritative WebSocket combat server, and a Next.js web application hosted on `cjverse.me`.

```
cjverse/
├── apps/
│   ├── bot/                 # Discord.js v14 Gateway & Slash Commands
│   ├── web/                 # Next.js 14+ (App Router) + Tailwind + HTML5 Canvas
│   └── game-server/         # Authoritative WebSocket Node.js Server (ws)
├── packages/
│   ├── game-logic/          # Shared formulas, RNG seeds, turn loop, stat engines
│   ├── db/                  # Supabase / PostgreSQL Drizzle ORM schema & queries
│   └── asset-pipeline/      # Nano Banana prompt generator & composite renderer
├── turbo.json
└── package.json

```

### 1.2 Technology Stack

* **Language & Runtime:** TypeScript (Strict Mode), Node.js v20+.
* **Monorepo Engine:** Turborepo with `pnpm` workspaces.
* **Database & Auth:** PostgreSQL (Supabase) + Drizzle ORM. Discord OAuth2 for web authentication.
* **Discord Bot:** `discord.js` v14, `@napi-rs/canvas` for fast dynamic image drops.
* **Web Frontend:** Next.js (App Router), Tailwind CSS, Canvas API.
* **Game Server:** Node.js HTTP/WebSocket server (`ws`) with deterministic state machine.
* **Asset Pipeline:** Structured prompt generator targeting Nano Banana / Imagen with local disk cache and Canvas procedural fallback.

---

## 2. Core Game Systems & Math Engine (`packages/game-logic`)

### 2.1 The Identity Formula

Every card has an identity derived deterministically from an integer seed:

$$\text{Card} = \text{Variant} \times \text{Race} \times \text{Element} \times \text{Evolution Stage} + \text{Level}$$

### 2.2 Entity Classifications

#### Races (7 Types)

| Race | Role Bias | Base HP | Base ATK | Base DEF | Base SPD | Base Mana |
| --- | --- | --- | --- | --- | --- | --- |
| **Dragon** | Powerhouse / Versatile | 1,200 | 180 | 110 | 85 | 120 |
| **Elf** | Magic DPS / Ramp | 800 | 160 | 70 | 125 | 160 |
| **Human** | Adaptive All-Rounder | 950 | 130 | 95 | 100 | 100 |
| **Dwarf** | Physical Tank / Forge | 1,400 | 120 | 150 | 70 | 80 |
| **Orc** | Berserker Bruiser | 1,350 | 170 | 85 | 90 | 60 |
| **Troll** | Sustain Tank | 1,600 | 110 | 90 | 60 | 70 |
| **Goblin** | Agility / Trap Specialist | 750 | 140 | 60 | 140 | 110 |

#### Variants & Multipliers

Variants scale base racial stats multiplicatively:

* **Normal:** $1.00\times$
* **Silver:** $1.25\times$
* **Gold:** $1.60\times$
* **Diamond:** $2.20\times$
* **Rainbow:** $3.00\times$

#### Elements & Evolution Stages

Elements have 4 Tiers:

* **S-Tier (Legendary):** Void, Time, Cosmic, Arcane, Chaos (Base ATK/Mana bonus: $+200$)
* **A-Tier:** Fire, Ice, Lightning, Shadow, Light, Nature, Blood (Base bonus: $+120$)
* **B-Tier:** Water, Wind, Earth, Poison, Sound, Metal (Base bonus: $+80$)
* **C-Tier:** Sand, Mist, Smoke, Crystal, Acid (Base bonus: $+50$)

**Evolution Stages (Stages 1 through 5):**

$$\text{Evolution Multiplier} = 1.0 + (\text{Stage} - 1) \times 0.6$$

*(Stage 1 = $1.0\times$, Stage 2 = $1.6\times$, Stage 3 = $2.2\times$, Stage 4 = $2.8\times$, Stage 5 = $3.4\times$ applied to Elemental bonus damage).*

### 2.3 Calculated Combat Stats

```typescript
interface CardStats {
  maxHp: number;
  currentHp: number;
  atk: number;
  def: number;
  spd: number;
  maxMana: number;
  currentMana: number;
}

export function calculateStats(card: CardEntity): CardStats {
  const variantMult = VARIANT_MULTIPLIERS[card.variant];
  const evoMult = 1.0 + (card.evolutionStage - 1) * 0.6;
  const elemBonus = ELEMENT_TIER_BONUS[card.elementTier] * evoMult;
  const lvlBonus = card.level * 15;

  return {
    maxHp: Math.floor((RACE_BASE[card.race].hp * variantMult) + (lvlBonus * 5)),
    currentHp: Math.floor((RACE_BASE[card.race].hp * variantMult) + (lvlBonus * 5)),
    atk: Math.floor((RACE_BASE[card.race].atk * variantMult) + elemBonus + lvlBonus),
    def: Math.floor((RACE_BASE[card.race].def * variantMult) + (lvlBonus * 0.5)),
    spd: Math.floor(RACE_BASE[card.race].spd + (variantMult * 10)),
    maxMana: Math.floor((RACE_BASE[card.race].mana * variantMult) + elemBonus * 0.5),
    currentMana: 50 // starting combat mana
  };
}

```

### 2.4 Damage Calculation Formula

$$\text{Mitigation} = \frac{1000}{1000 + \text{Target DEF}}$$

$$\text{Raw Damage} = (\text{Attacker ATK} \times \text{Skill Multiplier}) \times \text{Elemental Modifier}$$

$$\text{Final Damage} = \max(1, \lfloor\text{Raw Damage} \times \text{Mitigation}\rfloor)$$

---

## 3. Database Schema (`packages/db`)

Implemented via **Drizzle ORM** with PostgreSQL / Supabase:

```typescript
import { pgTable, text, integer, timestamp, uuid, jsonb, boolean } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: text('id').primaryKey(), // Discord Snowflake ID
  username: text('username').notNull(),
  avatarUrl: text('avatar_url'),
  crystals: integer('crystals').default(100).notNull(),
  activeLineup: jsonb('active_lineup').$type<{
    vanguardCardId: string | null;
    strikerCardId: string | null;
    conduitCardId: string | null;
  }>().default({ vanguardCardId: null, strikerCardId: null, conduitCardId: null }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

export const cards = pgTable('cards', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  race: text('race').notNull(),
  variant: text('variant').notNull(),
  element: text('element').notNull(),
  elementTier: text('element_tier').notNull(),
  evolutionStage: integer('evolution_stage').default(1).notNull(),
  level: integer('level').default(1).notNull(),
  powerScore: integer('power_score').notNull(),
  seed: integer('seed').notNull(),
  assetPaths: jsonb('asset_paths').$type<{
    raceSlice: string;
    elementSlice: string;
    frameSlice: string;
  }>(),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

export const matchRooms = pgTable('match_rooms', {
  id: text('id').primaryKey(), // e.g. nanoid(10)
  player1Id: text('player1_id').references(() => users.id).notNull(),
  player2Id: text('player2_id').references(() => users.id).notNull(),
  status: text('status', { enum: ['WAITING', 'IN_PROGRESS', 'COMPLETED', 'ABORTED'] }).default('WAITING').notNull(),
  winnerId: text('winner_id').references(() => users.id),
  gameStateSnapshot: jsonb('game_state_snapshot'),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

```

---

## 4. Discord Bot Implementation (`apps/bot`)

The bot handles rapid acquisition, lineup organization, and match generation.

### 4.1 Slash Command Specifications

* **`/hunt`**
* **Cooldown:** 30 minutes.
* **Flow:** Rolls RNG seed $\rightarrow$ calculates Variant/Race/Element $\rightarrow$ calls `asset-pipeline` to render dynamic composite PNG card $\rightarrow$ inserts card record into Supabase $\rightarrow$ sends embedded image with card stats and quick-equip button.


* **`/inventory [page]`**
* **Flow:** Returns paginated embeds displaying user's cards with IDs, tiers, and current lineup tags (`[VANGUARD]`, `[STRIKER]`, `[CONDUIT]`). Includes Discord Dropdown / Button menus allowing the user to slot any card into an active role.


* **`/duel target:@user`**
* **Validation:**
1. Caller and target must be distinct and non-bot users.
2. Both caller and target must have all 3 lineup slots filled in `users.activeLineup`.


* **Flow:** Generates a unique `roomId` $\rightarrow$ inserts `matchRooms` record with `WAITING` status $\rightarrow$ posts an embed into the Discord channel:
> ⚔️ **Duel Challenge Issued!**
> <@player1> vs <@player2>
> 🔗 **Enter the Arena:** `[https://cjverse.me/duel/](https://cjverse.me/duel/){roomId}`





---

## 5. Web Duel Engine & WebSocket Server (`apps/game-server` & `apps/web`)

### 5.1 Match Arena Rules

* **Format:** 3v3 Lineup:
* **Slot 1 (Vanguard):** Takes front row damage.
* **Slot 2 (Striker):** High damage dealer.
* **Slot 3 (Conduit):** Passive stat buffs/regeneration to slots 1 & 2.


* **Win Condition:** First player to eliminate all 3 enemy cards wins.
* **Turn Order:** Determined by individual card `SPD` stat (Initiative Gauge: 0 to 100). When a card hits 100 initiative, it acts.
* **Action Phase (15-Second Timer):**
* Active player selects an action: `Basic Attack` (costs 0 mana), `Elemental Burst` (costs 30 mana), or `Ultimate` (costs 70 mana).
* Selects target enemy card.


* **Auto-Battle Toggle & Fallback:**
* Toggleable client-side switch.
* If timer hits 0 or Auto is ON:
1. Check for lowest HP enemy that can be executed.
2. If element has counter advantage on any enemy, attack that enemy.
3. Default to Vanguard.





### 5.2 WebSocket Protocol Specification

* **Client Handshake (`/duel/{roomId}`):**
```json
{ "type": "JOIN_ROOM", "payload": { "token": "DISCORD_SESSION_JWT", "roomId": "x8Kf19a" } }

```


* **Server State Broadcast (`ROOM_STATE`):**
```json
{
  "type": "ROOM_STATE",
  "payload": {
    "status": "IN_PROGRESS",
    "activeCardId": "card-uuid",
    "timeRemaining": 15,
    "p1": { "name": "Player1", "cards": [...] },
    "p2": { "name": "Player2", "cards": [...] }
  }
}

```


* **Client Action Command:**
```json
{
  "type": "EXECUTE_ACTION",
  "payload": { "actionType": "ELEMENTAL_BURST", "targetCardId": "target-uuid" }
}

```


* **Server Resolution Broadcast:**
```json
{
  "type": "ACTION_RESOLVED",
  "payload": {
    "actorCardId": "...",
    "targetCardId": "...",
    "damage": 340,
    "isCrit": false,
    "targetRemainingHp": 620,
    "animations": ["SPARK_BURST", "SHAKE"]
  }
}

```



---

## 6. Generative Asset Pipeline & Slice Loader (`packages/asset-pipeline`)

### 6.1 Structured Prompt Generation (Nano Banana / Imagen)

The pipeline generates prompts dynamically based on card attributes and ensures slice consistency:

```typescript
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

```

### 6.2 Storage & Loading Layout

Assets are cached and loaded from local disk / public directory:

```
apps/web/public/assets/
├── frames/
│   ├── normal.png
│   ├── silver.png
│   ├── gold.png
│   ├── diamond.png
│   └── rainbow.png
├── races/
│   ├── dragon.png, elf.png, human.png, dwarf.png, orc.png, troll.png, goblin.png
└── elements/
    ├── fire.png, ice.png, lightning.png, void.png ...

```

### 6.3 Canvas Composite Engine with Procedural Fallback

If any generated slice is not found on disk, the engine falls back to a clean procedural canvas renderer to ensure tests never fail:

```typescript
export async function renderCardComposite(ctx: CanvasRenderingContext2D, card: CardEntity) {
  // 1. Render Background & Element Aura
  if (hasImageSlice(card.element)) {
    ctx.drawImage(getImage(card.element), 0, 0, 400, 560);
  } else {
    // Procedural Fallback: Elemental Gradient
    const grad = ctx.createLinearGradient(0, 0, 0, 560);
    grad.addColorStop(0, ELEMENT_COLORS[card.element] || '#1a1a2e');
    grad.addColorStop(1, '#0f0f1a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 400, 560);
  }

  // 2. Render Race Sprite
  if (hasImageSlice(card.race)) {
    ctx.drawImage(getImage(card.race), 50, 100, 300, 300);
  } else {
    // Procedural Fallback: Geometric Sigil
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(200, 250, 80, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(card.race.toUpperCase(), 200, 255);
  }

  // 3. Render Variant Frame Overlay
  if (hasImageSlice(card.variant)) {
    ctx.drawImage(getImage(card.variant), 0, 0, 400, 560);
  } else {
    // Procedural Fallback: Colored Stroke Border
    ctx.lineWidth = 12;
    ctx.strokeStyle = VARIANT_BORDER_COLORS[card.variant] || '#ffffff';
    ctx.strokeRect(6, 6, 388, 548);
  }

  // 4. Render Stat HUD & Typographic Labels
  renderCardHeader(ctx, card);
}

```

---

## 7. Testing & Verification Strategy (TDD)

Every subagent task must adhere to Red-Green-Refactor:

1. **`packages/game-logic` Unit Tests:**
* Verify base stat calculations for all 7 races with all 5 variants.
* Verify mitigation formula: 1000 DEF halves incoming damage; 0 DEF causes full damage.
* Verify that an evolved Stage 4 Rainbow Goblin's power score strictly exceeds a Stage 1 Normal Dragon.


2. **`apps/game-server` State Machine Tests:**
* Test two-player room connection flow.
* Test turn advancement when 15-second timer expires (verify fallback action execution).
* Test match completion when 3 cards on one team reach 0 HP.


3. **`apps/bot` Interaction Tests:**
* Mock Discord slash command context for `/hunt`, ensuring inventory correctly increases and embeds return valid image buffers.
* Mock `/duel` command validating error response if either player lacks 3 cards in active lineup.



---

## 8. Antigravity Implementation Roadmap (Phase 1)

Break down into small, verifiable tasks:

* **Task 1: Monorepo Foundation & Shared Types**
* Initialize Turborepo with TypeScript configs, ESLint, and Prettier.
* Create `packages/game-logic` containing all enums, stat formulas, damage formulas, and test suite.


* **Task 2: Database Layer (`packages/db`)**
* Configure Drizzle ORM connected to Supabase PostgreSQL.
* Define `users`, `cards`, and `matchRooms` tables with migrations.


* **Task 3: Asset Pipeline & Fallback Renderer (`packages/asset-pipeline`)**
* Implement prompt generator for Nano Banana.
* Implement procedural canvas composite renderer with image slice fallback.


* **Task 4: Discord Bot Core (`apps/bot`)**
* Set up `discord.js` gateway client and command registration.
* Implement `/hunt`, `/inventory` (with lineup buttons), and `/duel`.


* **Task 5: Authoritative WebSocket Server (`apps/game-server`)**
* Implement room lifecycle (`WAITING` $\rightarrow$ `IN_PROGRESS` $\rightarrow$ `COMPLETED`).
* Implement initiative clock, turn timer, and automated fallback logic.


* **Task 6: Web Client Arena (`apps/web`)**
* Implement Discord OAuth2 callback session.
* Build Canvas duel arena connecting to WebSocket server, rendering card HP bars, action buttons, and Auto toggle.