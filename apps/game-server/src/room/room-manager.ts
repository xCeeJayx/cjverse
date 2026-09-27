import { db, matchRooms, users, cards, UserActiveLineup, eq, inArray } from '@cjverse/db';
import { calculateStats, generateCardFromSeed, generateCardId } from '@cjverse/game-logic';
import { InitiativeClock, CombatCardState } from '../engine/initiative-clock';
import { resolveAction } from '../engine/action-resolver';
import { determineFallbackAction } from '../engine/auto-battle';
import {
  RoomStatus,
  RoomStatePayload,
  ActionType,
  WebSocketServerMessage,
  ActionResolvedPayload,
} from '../types/protocol';

export interface CombatCard extends CombatCardState {
  name: string;
  role: 'vanguard' | 'striker' | 'conduit';
  race: string;
  variant: string;
  element: string;
  elementTier: string;
  level: number;
  powerScore: number;
  maxHp: number;
  currentHp: number;
  atk: number;
  def: number;
  spd: number;
  maxMana: number;
  currentMana: number;
  initiative: number;
  isAlive: boolean;
  playerId: string;
}

export interface GameRoom {
  id: string;
  player1Id: string;
  player2Id: string;
  status: RoomStatus;
  connectedPlayers: Set<string>;
  activeCardId: string | null;
  timeRemaining: number;
  p1Cards: CombatCard[];
  p2Cards: CombatCard[];
  winnerId?: string | null;
  combatLog: string[];
  initiativeClock?: InitiativeClock;
  turnTimer?: NodeJS.Timeout | null;
  autoBattlePlayers: Set<string>;
  sockets: Map<string, any>;
}

export function isBotPlayer(playerId?: string | null): boolean {
  if (!playerId) return false;
  const upper = playerId.toUpperCase();
  return (
    upper === 'BOT' ||
    upper === 'BOT-AI-TRAINER' ||
    upper.startsWith('BOT') ||
    upper.includes('TRAINER') ||
    upper.includes('AI')
  );
}

export class RoomManager {
  private rooms = new Map<string, GameRoom>();

  createRoom(id: string, player1Id: string, player2Id: string): GameRoom {
    const room: GameRoom = {
      id,
      player1Id,
      player2Id,
      status: 'WAITING',
      connectedPlayers: new Set<string>(),
      activeCardId: null,
      timeRemaining: 15,
      p1Cards: [],
      p2Cards: [],
      winnerId: null,
      combatLog: [],
      autoBattlePlayers: new Set<string>(),
      sockets: new Map(),
    };
    this.rooms.set(id, room);
    return room;
  }

  getRoom(id: string): GameRoom | undefined {
    return this.rooms.get(id);
  }

  connectPlayer(roomId: string, playerId: string): GameRoom {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error(`Room ${roomId} not found`);
    }

    const isBotOpponent = isBotPlayer(room.player2Id);

    // In local dev/practice mode, allow dev-player-1 / dev-player-2 or bot
    const isAuthorized =
      playerId === room.player1Id ||
      playerId === room.player2Id ||
      playerId.startsWith('dev-player') ||
      playerId === 'p1' ||
      playerId === 'p2' ||
      room.player1Id.startsWith('dev-player') ||
      room.player2Id.startsWith('dev-player') ||
      isBotOpponent;

    if (!isAuthorized) {
      throw new Error('Unauthorized');
    }

    room.connectedPlayers.add(playerId);

    // Map dev aliases to canonical room player slots
    if (playerId === 'dev-player-1' || playerId === 'p1') {
      room.connectedPlayers.add(room.player1Id);
    } else if (playerId === 'dev-player-2' || playerId === 'p2') {
      room.connectedPlayers.add(room.player2Id);
    }

    // If opponent is a bot (or practice match), do not wait for a second WebSocket connection.
    // Immediately transition room.status from 'WAITING' to 'IN_PROGRESS'.
    const bothHumansJoined =
      room.connectedPlayers.has(room.player1Id) && room.connectedPlayers.has(room.player2Id);

    if (
      bothHumansJoined ||
      (isBotOpponent && (room.connectedPlayers.has(room.player1Id) || room.connectedPlayers.size >= 1))
    ) {
      room.status = 'IN_PROGRESS';
      if (!room.turnTimer && room.activeCardId) {
        this.startTurnCountdown(roomId);
      }

      // Start initiative clock immediately and broadcast updated ROOM_STATE with status: 'IN_PROGRESS'
      this.broadcast(roomId, {
        type: 'ROOM_STATE',
        payload: this.getRoomState(roomId)!,
      });

      // When it is the bot's active turn, trigger AutoBattleEngine after a brief natural delay (1000ms)
      const active = [...room.p1Cards, ...room.p2Cards].find((c) => c.id === room.activeCardId);
      if (active && (isBotPlayer(active.playerId) || room.autoBattlePlayers.has(active.playerId))) {
        setTimeout(() => {
          this.executeAutoAction(roomId, active.playerId);
        }, 1000);
      }
    }

    return room;
  }

  disconnectPlayer(roomId: string, playerId: string): void {
    const room = this.rooms.get(roomId);
    if (room) {
      room.connectedPlayers.delete(playerId);
      room.sockets.delete(playerId);
    }
  }

  getRoomState(roomId: string): RoomStatePayload | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    return {
      status: room.status,
      activeCardId: room.activeCardId,
      timeRemaining: room.timeRemaining,
      p1: { id: room.player1Id, name: 'Player 1', cards: room.p1Cards },
      p2: { id: room.player2Id, name: 'Player 2', cards: room.p2Cards },
      winnerId: room.winnerId,
      combatLog: room.combatLog,
    };
  }

  setSocket(roomId: string, playerId: string, socket: any): void {
    const room = this.rooms.get(roomId);
    if (room) {
      room.sockets.set(playerId, socket);
    }
  }

  broadcast(roomId: string, message: WebSocketServerMessage): void {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const msgString = JSON.stringify(message);
    room.sockets.forEach((sock) => {
      try {
        if (sock && sock.readyState === 1 /* OPEN */) {
          sock.send(msgString);
        }
      } catch (err) {
        console.warn('[RoomManager] Failed to send socket message:', err);
      }
    });
  }

  async hydrateRoomFromDb(roomId: string, fallbackUserId?: string): Promise<GameRoom> {
    const existing = this.rooms.get(roomId);
    if (existing && existing.p1Cards.length > 0 && existing.p2Cards.length > 0) {
      return existing;
    }

    let p1Id = 'dev-player-1';
    let p2Id = 'dev-player-2';

    try {
      const [matchRecord] = await db
        .select()
        .from(matchRooms)
        .where(eq(matchRooms.id, roomId))
        .limit(1);

      if (matchRecord) {
        p1Id = matchRecord.player1Id;
        p2Id = matchRecord.player2Id;
      }
    } catch (err) {
      console.warn('[RoomManager] DB room query error, using local fallback:', err);
    }

    const room = existing || this.createRoom(roomId, p1Id, p2Id);

    // Fetch and hydrate P1 and P2 lineups
    const p1Cards = await this.fetchPlayerLineupCards(p1Id, 1001);
    const p2Cards = await this.fetchPlayerLineupCards(p2Id, 2001);

    room.p1Cards = p1Cards;
    room.p2Cards = p2Cards;

    // Initialize Initiative Clock with all 6 combat cards
    const allCombatCards = [...p1Cards, ...p2Cards];
    room.initiativeClock = new InitiativeClock(allCombatCards);

    // Determine initial active card
    this.advanceTurn(roomId, false);

    return room;
  }

  private async fetchPlayerLineupCards(playerId: string, defaultSeedBase: number): Promise<CombatCard[]> {
    const roles: ('vanguard' | 'striker' | 'conduit')[] = ['vanguard', 'striker', 'conduit'];
    try {
      const [userRecord] = await db.select().from(users).where(eq(users.id, playerId)).limit(1);
      const lineup = userRecord?.activeLineup as UserActiveLineup | null;

      const cardIds = [
        lineup?.vanguardCardId,
        lineup?.strikerCardId,
        lineup?.conduitCardId,
      ].filter((id): id is string => Boolean(id));

      if (cardIds.length > 0) {
        const dbCards = await db.select().from(cards).where(inArray(cards.id, cardIds));
        if (dbCards && dbCards.length > 0) {
          const cardMap = new Map(dbCards.map((c) => [c.id, c]));

          return roles.map((role, idx) => {
            const slotId =
              role === 'vanguard'
                ? lineup?.vanguardCardId
                : role === 'striker'
                ? lineup?.strikerCardId
                : lineup?.conduitCardId;

            const entity = slotId ? cardMap.get(slotId) : null;
            if (entity) {
              const stats = calculateStats(entity as any);
              return {
                id: entity.id,
                name: `${entity.variant.toUpperCase()} ${entity.race.toUpperCase()}`,
                role,
                race: entity.race,
                variant: entity.variant,
                element: entity.element,
                elementTier: entity.elementTier,
                level: entity.level,
                powerScore: entity.powerScore,
                maxHp: stats.maxHp,
                currentHp: stats.currentHp,
                atk: stats.atk,
                def: stats.def,
                spd: stats.spd,
                maxMana: stats.maxMana,
                currentMana: stats.currentMana,
                initiative: 0,
                isAlive: true,
                playerId,
              };
            }

            // Fallback for empty slot
            const generated = generateCardFromSeed(defaultSeedBase + idx, 1);
            const stats = calculateStats(generated);
            return {
              id: generateCardId(),
              name: `${generated.variant.toUpperCase()} ${generated.race.toUpperCase()}`,
              role,
              race: generated.race,
              variant: generated.variant,
              element: generated.element,
              elementTier: generated.elementTier,
              level: generated.level,
              powerScore: generated.powerScore,
              maxHp: stats.maxHp,
              currentHp: stats.currentHp,
              atk: stats.atk,
              def: stats.def,
              spd: stats.spd,
              maxMana: stats.maxMana,
              currentMana: stats.currentMana,
              initiative: 0,
              isAlive: true,
              playerId,
            };
          });
        }
      }
    } catch (err) {
      console.warn(`[RoomManager] DB card lookup failed for ${playerId}, using procedurals:`, err);
    }

    // Default generated lineup for test/dev bots
    return roles.map((role, idx) => {
      const generated = generateCardFromSeed(defaultSeedBase + idx, 1);
      const stats = calculateStats(generated);
      return {
        id: generateCardId(),
        name: `${generated.variant.toUpperCase()} ${generated.race.toUpperCase()}`,
        role,
        race: generated.race,
        variant: generated.variant,
        element: generated.element,
        elementTier: generated.elementTier,
        level: generated.level,
        powerScore: generated.powerScore,
        maxHp: stats.maxHp,
        currentHp: stats.currentHp,
        atk: stats.atk,
        def: stats.def,
        spd: stats.spd,
        maxMana: stats.maxMana,
        currentMana: stats.currentMana,
        initiative: 0,
        isAlive: true,
        playerId,
      };
    });
  }

  advanceTurn(roomId: string, broadcastUpdate = true): RoomStatePayload | null {
    const room = this.rooms.get(roomId);
    if (!room || !room.initiativeClock) return null;

    if (room.turnTimer) {
      clearInterval(room.turnTimer);
      room.turnTimer = null;
    }

    // Check game over
    const p1Alive = room.p1Cards.some((c) => c.isAlive && c.currentHp > 0);
    const p2Alive = room.p2Cards.some((c) => c.isAlive && c.currentHp > 0);

    if (!p1Alive || !p2Alive) {
      this.handleMatchConclusion(roomId, p1Alive);
      return this.getRoomState(roomId);
    }

    // Tick clock until a living card reaches 100
    let nextCard = null;
    for (let attempts = 0; attempts < 100; attempts++) {
      const res = room.initiativeClock.tick();
      if (res.activeCard && res.activeCard.isAlive) {
        nextCard = res.activeCard;
        break;
      }
    }

    if (nextCard) {
      room.activeCardId = nextCard.id;
    } else {
      // Fallback: pick first alive card
      const fallback = [...room.p1Cards, ...room.p2Cards].find((c) => c.isAlive);
      room.activeCardId = fallback ? fallback.id : null;
    }

    room.timeRemaining = 15;
    if (room.initiativeClock) {
      room.initiativeClock.resetTimer(15);
    }

    if (room.status === 'IN_PROGRESS') {
      this.startTurnCountdown(roomId);
    }

    const state = this.getRoomState(roomId)!;
    if (broadcastUpdate) {
      this.broadcast(roomId, {
        type: 'ROOM_STATE',
        payload: state,
      });
    }

    // Auto-attack for bot opponent or players with auto enabled (natural 1000ms delay)
    const active = [...room.p1Cards, ...room.p2Cards].find((c) => c.id === room.activeCardId);
    if (active && (isBotPlayer(active.playerId) || room.autoBattlePlayers.has(active.playerId))) {
      setTimeout(() => {
        this.executeAutoAction(roomId, active.playerId);
      }, 1000);
    }

    return state;
  }

  private startTurnCountdown(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;

    if (room.turnTimer) {
      clearInterval(room.turnTimer);
      room.turnTimer = null;
    }

    room.turnTimer = setInterval(() => {
      const r = this.rooms.get(roomId);
      if (!r || r.status !== 'IN_PROGRESS') {
        if (r?.turnTimer) {
          clearInterval(r.turnTimer);
          r.turnTimer = null;
        }
        return;
      }

      r.timeRemaining -= 1;
      if (r.initiativeClock) {
        r.initiativeClock.decrementTimer();
      }

      // Actively broadcast TIMER_TICK to all room sockets every second while status === 'IN_PROGRESS'
      this.broadcast(roomId, {
        type: 'TIMER_TICK',
        payload: {
          timeRemaining: r.timeRemaining,
          activeCardId: r.activeCardId,
        },
      });

      // Broadcast periodic updated room state
      this.broadcast(roomId, {
        type: 'ROOM_STATE',
        payload: this.getRoomState(roomId)!,
      });

      if (r.timeRemaining <= 0) {
        clearInterval(r.turnTimer!);
        r.turnTimer = null;

        // When the 15-second timer reaches 0, invoke ActionResolver to force an automatic basic attack
        // for whoever's turn is active, advance the turn, and reset the clock to 15 seconds.
        const active = [...r.p1Cards, ...r.p2Cards].find((c) => c.id === r.activeCardId);
        if (active) {
          const enemyTeam = active.playerId === r.player1Id ? r.p2Cards : r.p1Cards;
          const aliveEnemies = enemyTeam.filter((c) => c.isAlive && c.currentHp > 0);
          const target = aliveEnemies[0];
          if (target) {
            this.executeAction(roomId, active.playerId, 'BASIC_ATTACK', target.id);
          }
        }
      }
    }, 1000);
  }

  executeAutoAction(roomId: string, playerId: string): void {
    const room = this.rooms.get(roomId);
    if (!room || room.status !== 'IN_PROGRESS') return;

    const active = [...room.p1Cards, ...room.p2Cards].find((c) => c.id === room.activeCardId);
    if (!active || (active.playerId !== playerId && !isBotPlayer(playerId))) return;

    const enemyTeam = active.playerId === room.player1Id ? room.p2Cards : room.p1Cards;
    const fallback = determineFallbackAction(active, enemyTeam);

    this.executeAction(roomId, active.playerId, fallback.actionType, fallback.targetCardId);
  }

  executeAction(
    roomId: string,
    playerId: string,
    actionType: ActionType,
    targetCardId?: string
  ): { resolved: ActionResolvedPayload; state: RoomStatePayload } | null {
    const room = this.rooms.get(roomId);
    if (!room || room.status !== 'IN_PROGRESS') return null;

    const active = [...room.p1Cards, ...room.p2Cards].find((c) => c.id === room.activeCardId);
    if (!active) return null;

    const isP1 = active.playerId === room.player1Id;
    const enemyTeam = isP1 ? room.p2Cards : room.p1Cards;
    const aliveEnemies = enemyTeam.filter((c) => c.isAlive && c.currentHp > 0);

    if (aliveEnemies.length === 0) return null;

    // Resolve target
    let target = aliveEnemies.find((c) => c.id === targetCardId);
    if (!target) {
      const fallback = determineFallbackAction(active, aliveEnemies);
      target = aliveEnemies.find((c) => c.id === fallback.targetCardId) || aliveEnemies[0];
    }

    // Resolve authoritative damage & mana
    const resolved = resolveAction(actionType, active, target);

    // Format combat log message
    const actorSide = isP1 ? 'P1' : 'P2';
    const targetSide = isP1 ? 'P2' : 'P1';
    const logMsg = `[${actorSide}] ${active.name} used ${actionType.replace('_', ' ')} on [${targetSide}] ${target.name} for ${resolved.damage} DMG!`;
    resolved.combatLog = logMsg;

    room.combatLog.push(logMsg);

    if (target.currentHp <= 0) {
      target.isAlive = false;
      target.currentHp = 0;
      room.combatLog.push(`💀 [${targetSide}] ${target.name} was defeated!`);
    }

    // Check game completion
    const p1Alive = room.p1Cards.some((c) => c.isAlive && c.currentHp > 0);
    const p2Alive = room.p2Cards.some((c) => c.isAlive && c.currentHp > 0);

    // Broadcast ACTION_RESOLVED
    this.broadcast(roomId, {
      type: 'ACTION_RESOLVED',
      payload: resolved,
    });

    if (!p1Alive || !p2Alive) {
      this.handleMatchConclusion(roomId, p1Alive);
    } else {
      // Advance clock to next turn if match still ongoing
      this.advanceTurn(roomId, true);
    }

    return {
      resolved,
      state: this.getRoomState(roomId)!,
    };
  }

  async handleMatchConclusion(roomId: string, p1Alive: boolean): Promise<void> {
    const room = this.rooms.get(roomId);
    if (!room) return;

    if (room.turnTimer) {
      clearInterval(room.turnTimer);
      room.turnTimer = null;
    }

    room.status = 'COMPLETED';
    const winnerId = p1Alive ? room.player1Id : room.player2Id;
    const loserId = p1Alive ? room.player2Id : room.player1Id;
    room.winnerId = winnerId;

    const winnerName = p1Alive ? 'Player 1' : 'Player 2';
    room.combatLog.push(`🏆 ${winnerName} has won the duel!`);

    const crystalsAwarded = 50;

    // 1. Broadcast MATCH_END WebSocket payload containing { winnerId, loserId, crystalsAwarded: 50 }
    this.broadcast(roomId, {
      type: 'MATCH_END',
      payload: {
        winnerId,
        loserId,
        crystalsAwarded,
      },
    });

    // 2. Broadcast updated ROOM_STATE with COMPLETED status
    this.broadcast(roomId, {
      type: 'ROOM_STATE',
      payload: this.getRoomState(roomId)!,
    });

    // 3. Award 50 crystals to the winning player in users.crystals via Supabase update (if registered, not BOT)
    let validWinnerId: string | null = null;
    if (winnerId && !isBotPlayer(winnerId) && !winnerId.startsWith('dev-player')) {
      try {
        const [winnerRecord] = await db
          .select({ id: users.id, crystals: users.crystals })
          .from(users)
          .where(eq(users.id, winnerId))
          .limit(1);

        if (winnerRecord) {
          validWinnerId = winnerRecord.id;
          await db
            .update(users)
            .set({ crystals: (winnerRecord.crystals || 0) + crystalsAwarded })
            .where(eq(users.id, winnerId));
        }
      } catch (err) {
        console.warn(`[RoomManager] Failed to award crystals to winner ${winnerId}:`, err);
      }
    }

    // 4. Update match_rooms in Supabase: set status = 'COMPLETED' and winnerId = winnerId
    try {
      await db
        .update(matchRooms)
        .set({
          status: 'COMPLETED',
          winnerId: validWinnerId,
        })
        .where(eq(matchRooms.id, roomId));
    } catch (err) {
      console.warn(`[RoomManager] Failed to update match_rooms for ${roomId}:`, err);
    }
  }

  toggleAuto(roomId: string, playerId: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room) return false;

    if (room.autoBattlePlayers.has(playerId)) {
      room.autoBattlePlayers.delete(playerId);
      return false;
    } else {
      room.autoBattlePlayers.add(playerId);
      // Trigger immediate auto-attack if it's currently their turn
      const active = [...room.p1Cards, ...room.p2Cards].find((c) => c.id === room.activeCardId);
      if (active && active.playerId === playerId) {
        setTimeout(() => this.executeAutoAction(roomId, playerId), 300);
      }
      return true;
    }
  }
}
