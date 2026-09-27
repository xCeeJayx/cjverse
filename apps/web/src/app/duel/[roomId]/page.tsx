'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import { ArenaCanvas } from '../../../components/ArenaCanvas';
import { ArenaController, ArenaState } from '../../../lib/arena-controller';

export default function DuelRoomPage() {
  const params = useParams();
  const roomId = params?.roomId as string;
  const [controller] = useState(() => new ArenaController());
  const [state, setState] = useState<ArenaState>(() => controller.getState());
  const [isAuto, setIsAuto] = useState<boolean>(() => controller.isAutoBattleEnabled());

  const handleAction = (type: 'BASIC_ATTACK' | 'ELEMENTAL_BURST' | 'ULTIMATE') => {
    controller.executeAction(type, 'target-id');
  };

  const handleToggleAuto = () => {
    const updated = controller.toggleAutoBattle();
    setIsAuto(updated);
  };

  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-6 bg-slate-950 text-white">
      <div className="mb-4 text-center">
        <h1 className="text-3xl font-extrabold text-amber-400">CJVerse Skirmish Arena</h1>
        <p className="text-slate-400 text-sm mt-1">Room ID: <span className="font-mono text-indigo-400">{roomId}</span></p>
      </div>

      <ArenaCanvas
        arenaState={state}
        onAction={handleAction}
        isAuto={isAuto}
        onToggleAuto={handleToggleAuto}
      />
    </main>
  );
}
