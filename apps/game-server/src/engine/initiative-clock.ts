export interface CombatCardState {
  id: string;
  playerId: string;
  spd: number;
  initiative: number;
  isAlive: boolean;
}

export class InitiativeClock {
  private cards: CombatCardState[];
  private timeRemaining: number = 15;

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

  getTimeRemaining(): number {
    return this.timeRemaining;
  }

  resetTimer(seconds: number = 15): number {
    this.timeRemaining = seconds;
    return this.timeRemaining;
  }

  decrementTimer(): number {
    this.timeRemaining = Math.max(0, this.timeRemaining - 1);
    return this.timeRemaining;
  }
}
