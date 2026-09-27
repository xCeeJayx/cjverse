export interface CombatCardState {
  id: string;
  playerId: string;
  spd: number;
  initiative: number;
  isAlive: boolean;
}

export class InitiativeClock {
  private cards: CombatCardState[];

  constructor(cards: CombatCardState[]) {
    this.cards = cards;
  }

  tick(): { activeCard: CombatCardState | null } {
    for (const card of this.cards) {
      if (!card.isAlive) continue;

      card.initiative += card.spd;
      if (card.initiative >= 100) {
        card.initiative = 0;
        return { activeCard: card };
      }
    }

    return { activeCard: null };
  }
}
