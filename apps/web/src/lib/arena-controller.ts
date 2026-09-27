export interface ArenaState {
  status: string;
  activeCardId: string | null;
  timeRemaining: number;
  p1: { id: string; name: string; cards: any[] };
  p2: { id: string; name: string; cards: any[] };
  winnerId?: string | null;
  combatLog?: string[];
  lastAction?: any;
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
