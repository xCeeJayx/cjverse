export interface MatchEndData {
  winnerId: string;
  loserId: string;
  crystalsAwarded: number;
  winnerDelta?: number;
  loserDelta?: number;
  newWinnerRating?: number;
  newLoserRating?: number;
}

export interface ArenaState {
  status: string;
  activeCardId: string | null;
  timeRemaining: number;
  p1: { id: string; name: string; cards: any[] };
  p2: { id: string; name: string; cards: any[] };
  winnerId?: string | null;
  combatLog?: string[];
  lastAction?: any;
  matchEnd?: MatchEndData | null;
}

export class ArenaController {
  private state: ArenaState = {
    status: 'WAITING',
    activeCardId: null,
    timeRemaining: 15,
    p1: { id: '', name: '', cards: [] },
    p2: { id: '', name: '', cards: [] },
    combatLog: [],
    winnerId: null,
  };

  private autoBattleEnabled = false;

  handleMessage(msg: { type: string; payload: any }): void {
    if (msg.type === 'ROOM_STATE') {
      this.state = {
        ...this.state,
        ...msg.payload,
        combatLog: msg.payload.combatLog || this.state.combatLog || [],
      };
    } else if (msg.type === 'ACTION_RESOLVED') {
      const logs = [...(this.state.combatLog || [])];
      if (msg.payload.combatLog) {
        logs.push(msg.payload.combatLog);
      }
      this.state = {
        ...this.state,
        lastAction: msg.payload,
        combatLog: logs,
      };
    } else if (msg.type === 'TIMER_TICK') {
      this.state = {
        ...this.state,
        timeRemaining: msg.payload?.timeRemaining ?? this.state.timeRemaining,
        activeCardId: msg.payload?.activeCardId !== undefined ? msg.payload.activeCardId : this.state.activeCardId,
      };
    } else if (msg.type === 'MATCH_END') {
      this.state = {
        ...this.state,
        status: 'COMPLETED',
        winnerId: msg.payload?.winnerId,
        matchEnd: msg.payload,
      };
    }
  }

  getState(): ArenaState {
    return this.state;
  }

  isAutoBattleEnabled(): boolean {
    return this.autoBattleEnabled;
  }

  toggleAutoBattle(): boolean {
    this.autoBattleEnabled = !this.autoBattleEnabled;
    return this.autoBattleEnabled;
  }

  executeAction(actionType: 'BASIC_ATTACK' | 'ELEMENTAL_BURST' | 'ULTIMATE', targetCardId: string) {
    return {
      type: 'EXECUTE_ACTION',
      payload: { actionType, targetCardId }
    };
  }
}
