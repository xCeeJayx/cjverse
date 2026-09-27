import { WebSocketServer, WebSocket } from 'ws';
import dotenv from 'dotenv';
import path from 'node:path';
import { RoomManager } from './room/room-manager';
import { WebSocketClientMessage } from './types/protocol';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

export * from './types/protocol';
export * from './room/room-manager';
export * from './engine/initiative-clock';
export * from './engine/action-resolver';
export * from './engine/auto-battle';

export const roomManager = new RoomManager();

export function createGameServer(port = Number(process.env.GAME_SERVER_PORT || 8080)): WebSocketServer {
  const wss = new WebSocketServer({ port });

  console.log(`[Game Server] Authoritative WebSocket Combat Server listening on ws://localhost:${port}`);

  wss.on('connection', (ws: WebSocket) => {
    let currentRoomId: string | null = null;
    let currentUserId: string | null = null;

    ws.on('message', async (raw: string | Buffer) => {
      try {
        const msg = JSON.parse(raw.toString()) as WebSocketClientMessage;

        if (msg.type === 'JOIN_ROOM') {
          const roomId = msg.roomId || msg.payload?.roomId;
          let userId = msg.userId || msg.payload?.userId;

          if (!roomId) {
            ws.send(JSON.stringify({ type: 'ERROR', payload: { message: 'Missing roomId in JOIN_ROOM' } }));
            return;
          }

          currentRoomId = roomId;
          currentUserId = userId || 'dev-player-1';

          // Hydrate room from database if not cached
          const room = await roomManager.hydrateRoomFromDb(roomId, currentUserId);

          // If userId was not specified, match to available slot (player1 or player2)
          if (!userId) {
            currentUserId = room.connectedPlayers.has(room.player1Id) ? room.player2Id : room.player1Id;
          }

          try {
            roomManager.connectPlayer(roomId, currentUserId!);
            roomManager.setSocket(roomId, currentUserId!, ws);

            const state = roomManager.getRoomState(roomId);
            // Send initial ROOM_STATE directly to connecting client
            ws.send(JSON.stringify({ type: 'ROOM_STATE', payload: state }));

            // Broadcast updated ROOM_STATE to both players
            roomManager.broadcast(roomId, { type: 'ROOM_STATE', payload: state! });
          } catch (err: any) {
            ws.send(JSON.stringify({ type: 'ERROR', payload: { message: err?.message || 'Join room failed' } }));
          }
          return;
        }

        if (msg.type === 'EXECUTE_ACTION') {
          if (!currentRoomId || !currentUserId) {
            ws.send(JSON.stringify({ type: 'ERROR', payload: { message: 'Not connected to any active room' } }));
            return;
          }

          const actionType = msg.payload?.actionType || 'BASIC_ATTACK';
          const targetCardId = msg.payload?.targetCardId;

          roomManager.executeAction(currentRoomId, currentUserId, actionType, targetCardId);
          return;
        }

        if (msg.type === 'TOGGLE_AUTO') {
          if (currentRoomId && currentUserId) {
            const isAuto = roomManager.toggleAuto(currentRoomId, currentUserId);
            ws.send(JSON.stringify({ type: 'AUTO_TOGGLED', payload: { isAuto } }));
          }
          return;
        }
      } catch (err) {
        console.error('[Game Server] Error processing message:', err);
      }
    });

    ws.on('close', () => {
      if (currentRoomId && currentUserId) {
        roomManager.disconnectPlayer(currentRoomId, currentUserId);
      }
    });
  });

  return wss;
}

// Auto-start server in runtime when executed directly or not in test mode
if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
  createGameServer();
}
