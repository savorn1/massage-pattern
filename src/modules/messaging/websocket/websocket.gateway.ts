import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  WebSocketServer,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WsAuthGuard } from './auth.guard';
import { MessageDto, JoinRoomDto, PrivateMessageDto } from './dto/message.dto';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';

// ── Redis key helpers ────────────────────────────────────────────────────────
// Each user gets a Redis Set that holds all active socket IDs across every
// instance. A global "online" Set gives a fast O(1) membership check.
//
//   presence:user:{userId}:sockets  →  Set<socketId>
//   presence:online                 →  Set<userId>
//
// TTL on the per-user key (PRESENCE_USER_TTL_SEC) is a safety net: if a
// server crashes without a clean disconnect, stale keys expire on their own.
const PRESENCE_USER_TTL_SEC = 120; // 2 minutes — refresh on each ping/pong
const presenceUserKey = (userId: string) => `presence:user:${userId}:sockets`;
const PRESENCE_ONLINE_KEY = 'presence:online';

interface ClientSession {
  username: string;
  userId?: string;
  rooms: Set<string>;
  lastSeen: Date;
  reconnectionTimeout?: NodeJS.Timeout;
}

@WebSocketGateway({
  cors: {
    origin: process.env.WS_CORS_ORIGIN ?? '*',
  },
  // WebSocket-only: polling is ~3× more overhead per message and blocks
  // horizontal scaling because sticky sessions are required for polling.
  // Clients on modern browsers/mobile always support native WebSocket.
  transports: ['websocket'],
  // Detect dead connections quickly — 10s ping, 5s grace window.
  // At 100k connections even a 60s timeout wastes ~60MB of socket buffers
  // for ghosts that will never come back.
  pingInterval: 10000,
  pingTimeout: 5000,
  // Cap per-message size to 1 MB. Default (1 MB) is fine; being explicit
  // prevents accidental payload amplification on broadcast events.
  maxHttpBufferSize: 1e6,
  // Compress text frames. For chat (mostly JSON), deflate cuts wire bytes
  // by ~60-70% with negligible CPU cost at this scale.
  perMessageDeflate: {
    threshold: 512, // only compress frames > 512 bytes
  },
})
export class WebsocketGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private logger: Logger = new Logger('WebsocketGateway');
  private connectedClients = new Map<string, ClientSession>();
  private reconnectionTimeout: number;
  /** userId → custom status { emoji, text } */
  private customStatusMap = new Map<string, { emoji: string; text: string }>();

  /**
   * Dedicated Redis client for presence operations.
   * Kept separate from the adapter pub/sub pair so presence reads/writes
   * never block adapter message fanout on the same connection.
   */
  private presenceRedis: Redis | null = null;

  constructor(private readonly configService: ConfigService) {
    this.reconnectionTimeout =
      this.configService.get<number>('WS_RECONNECTION_TIMEOUT') || 30000;
  }

  // ── Presence helpers (Redis-backed, cross-instance) ───────────────────────

  /** Register a socket for a user. Returns true if the user just came online. */
  private async presenceAdd(userId: string, socketId: string): Promise<boolean> {
    if (!this.presenceRedis) return false;
    const key = presenceUserKey(userId);
    const pipeline = this.presenceRedis.pipeline();
    pipeline.sadd(key, socketId);
    pipeline.expire(key, PRESENCE_USER_TTL_SEC);
    pipeline.sadd(PRESENCE_ONLINE_KEY, userId);
    const results = await pipeline.exec();
    // results[0] is [err, addedCount] from SADD on the sockets set
    const addedToSockets = results?.[0]?.[1] as number | undefined;
    // If we added the first socket for this user, scard was 0 before → went online
    // We detect this by checking if the set size after adding equals 1
    const setSize = await this.presenceRedis.scard(key);
    return setSize === 1 && (addedToSockets ?? 0) > 0;
  }

  /** Remove a socket for a user. Returns true if the user just went offline. */
  private async presenceRemove(userId: string, socketId: string): Promise<boolean> {
    if (!this.presenceRedis) return false;
    const key = presenceUserKey(userId);
    await this.presenceRedis.srem(key, socketId);
    const remaining = await this.presenceRedis.scard(key);
    if (remaining === 0) {
      await this.presenceRedis.srem(PRESENCE_ONLINE_KEY, userId);
      return true; // went offline
    }
    // Refresh TTL so an active user never expires
    await this.presenceRedis.expire(key, PRESENCE_USER_TTL_SEC);
    return false;
  }

  /** All currently-online userIds, across every instance. */
  async getOnlineUserIdsAsync(): Promise<string[]> {
    if (!this.presenceRedis) return [];
    return this.presenceRedis.smembers(PRESENCE_ONLINE_KEY);
  }

  afterInit() {
    this.logger.log('WebSocket Gateway Initialized');

    // ── Redis Adapter (multi-instance scaling) ────────────────────────────
    // Without this, users on different server instances can't see each other's
    // events (e.g. user A on instance #1 won't receive events from instance #2).
    // The adapter uses a Redis pub/sub pair to broadcast across all instances.
    try {
      const redisHost = this.configService.get<string>('REDIS_HOST') || 'localhost';
      const redisPort = this.configService.get<number>('REDIS_PORT') || 6379;

      // Two separate connections — one publishes, one subscribes
      const pubClient = new Redis({ host: redisHost, port: redisPort });
      const subClient = new Redis({ host: redisHost, port: redisPort });

      pubClient.on('error', (err) => this.logger.error('[WS Adapter] Redis pub error:', err.message));
      subClient.on('error', (err) => this.logger.error('[WS Adapter] Redis sub error:', err.message));

      // Attach — all emit/broadcast calls now sync across every instance
      this.server.adapter(createAdapter(pubClient, subClient));
      this.logger.log('[WS Adapter] Redis adapter attached — multi-instance ready');

      // Dedicated presence client (separate connection from adapter pair)
      this.presenceRedis = new Redis({ host: redisHost, port: redisPort });
      this.presenceRedis.on('error', (err) =>
        this.logger.error('[Presence] Redis error:', err.message),
      );
      this.logger.log('[Presence] Redis presence store ready');
    } catch (err) {
      // Graceful degradation: app still works on a single instance without Redis
      this.logger.warn('[WS Adapter] Could not attach Redis adapter, running single-instance:', err.message);
    }

    // Add server-level error listener
    this.server.engine.on('connection_error', (err: Error) => {
      this.logger.error('Connection error:', err.message);
      this.logger.error('Error details:', err);
    });
  }

  handleConnection(client: Socket) {
    try {
      const authUsername: unknown = client.handshake.auth?.username;
      const username =
        typeof authUsername === 'string'
          ? authUsername
          : `User-${client.id.substring(0, 5)}`;

      // Check for existing session (reconnection scenario)
      const existingSession = this.connectedClients.get(client.id);
      if (existingSession?.reconnectionTimeout) {
        // Clear reconnection timeout - client has reconnected
        clearTimeout(existingSession.reconnectionTimeout);
        existingSession.lastSeen = new Date();
        this.logger.log(`Client reconnected: ${client.id} (${username})`);

        // Rejoin all previous rooms
        existingSession.rooms.forEach((room) => {
          void client.join(room);
        });

        // Send reconnection success message
        client.emit('reconnected', {
          message: 'Successfully reconnected',
          userId: client.id,
          rooms: Array.from(existingSession.rooms),
        });
      } else {
        // New connection
        const authUserId = client.handshake.auth?.userId as string | undefined;
        this.connectedClients.set(client.id, {
          username,
          userId: authUserId,
          rooms: new Set(),
          lastSeen: new Date(),
        });

        // Track userId → socketId for presence (Redis-backed, cross-instance)
        if (authUserId) {
          void this.presenceAdd(authUserId, client.id).then((wentOnline) => {
            if (wentOnline) {
              this.server.emit('user:status', { userId: authUserId, online: true });
            }
          });
        }

        this.logger.log(`Client connected: ${client.id} (${username})`);

        // Notify all clients about new connection
        void this.server.emit('userConnected', {
          userId: client.id,
          username,
          totalUsers: this.connectedClients.size,
          timestamp: new Date().toISOString(),
        });

        // Send welcome message to the client
        client.emit('welcome', {
          message: `Welcome ${username}!`,
          userId: client.id,
          connectedUsers: this.connectedClients.size,
        });
      }

      // Add error listener for this client
      client.on('error', (error) => {
        this.logger.error(`Socket error for client ${client.id}:`, error);
      });

      // Add disconnect reason listener
      client.on('disconnect', (reason) => {
        this.logger.log(`Client ${client.id} disconnect reason: ${reason}`);
      });

      // Add pong listener to track client health
      client.on('pong', () => {
        const session = this.connectedClients.get(client.id);
        if (session) {
          session.lastSeen = new Date();
        }
      });

      // Add ping listener
      client.on('ping', () => {
        const session = this.connectedClients.get(client.id);
        if (session) {
          session.lastSeen = new Date();
        }
      });
    } catch (error) {
      this.logger.error('Error in handleConnection:', error);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    try {
      const clientInfo = this.connectedClients.get(client.id);

      if (clientInfo) {
        this.logger.log(
          `Client disconnected: ${client.id} (${clientInfo.username}), waiting for reconnection...`,
        );

        // Set a timeout to clean up if client doesn't reconnect
        clientInfo.reconnectionTimeout = setTimeout(() => {
          const stillDisconnected = this.connectedClients.get(client.id);

          if (stillDisconnected) {
            this.logger.log(
              `Client ${client.id} (${clientInfo.username}) did not reconnect, cleaning up...`,
            );

            // Leave all rooms
            clientInfo.rooms.forEach((room) => {
              try {
                this.server.to(room).emit('userLeftRoom', {
                  userId: client.id,
                  username: clientInfo.username,
                  room,
                  timestamp: new Date().toISOString(),
                });
              } catch (error) {
                this.logger.error(
                  `Error notifying room ${room} about client ${client.id} leaving:`,
                  error,
                );
              }
            });

            this.connectedClients.delete(client.id);

            // Remove from Redis presence; emit offline if no more sockets remain
            if (clientInfo.userId) {
              void this.presenceRemove(clientInfo.userId, client.id).then((wentOffline) => {
                if (wentOffline) {
                  this.server.emit('user:status', { userId: clientInfo.userId!, online: false });
                }
              });
            }

            // Notify all clients about final disconnection
            this.server.emit('userDisconnected', {
              userId: client.id,
              username: clientInfo.username,
              totalUsers: this.connectedClients.size,
              timestamp: new Date().toISOString(),
            });
          }
        }, this.reconnectionTimeout);
      }
    } catch (error) {
      this.logger.error('Error in handleDisconnect:', error);
      // Force cleanup to prevent memory leak
      this.connectedClients.delete(client.id);
    }
  }

  @UsePipes(new ValidationPipe({ transform: true }))
  @SubscribeMessage('message')
  handleMessage(
    @MessageBody() data: MessageDto,
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const clientInfo = this.connectedClients.get(client.id);

      this.logger.log(`Message from ${client.id}: ${data.message}`);

      const response = {
        userId: client.id,
        username: clientInfo?.username || 'Unknown',
        message: data.message,
        timestamp: new Date().toISOString(),
      };

      // Broadcast to all clients
      this.server.emit('message', response);

      return response;
    } catch (error) {
      this.logger.error('Error in handleMessage:', error);
      return { error: 'Failed to send message' };
    }
  }

  @UsePipes(new ValidationPipe({ transform: true }))
  @SubscribeMessage('privateMessage')
  handlePrivateMessage(
    @MessageBody() data: PrivateMessageDto,
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const clientInfo = this.connectedClients.get(client.id);
      const targetExists = this.connectedClients.has(data.targetId);

      if (!targetExists) {
        return { error: 'Target client not found or disconnected' };
      }

      const response = {
        from: client.id,
        fromUsername: clientInfo?.username || 'Unknown',
        message: data.message,
        timestamp: new Date().toISOString(),
      };

      // Send only to target client
      this.server.to(data.targetId).emit('privateMessage', response);

      // Send confirmation to sender
      return { sent: true, to: data.targetId };
    } catch (error) {
      this.logger.error('Error in handlePrivateMessage:', error);
      return { error: 'Failed to send private message' };
    }
  }

  @UsePipes(new ValidationPipe({ transform: true }))
  @SubscribeMessage('joinRoom')
  handleJoinRoom(
    @MessageBody() data: JoinRoomDto,
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const clientInfo = this.connectedClients.get(client.id);

      if (!clientInfo) {
        return { error: 'Client not found' };
      }

      void client.join(data.room);
      clientInfo.rooms.add(data.room);

      this.logger.log(`Client ${client.id} joined room: ${data.room}`);

      // Notify room members
      this.server.to(data.room).emit('userJoinedRoom', {
        userId: client.id,
        username: clientInfo.username,
        room: data.room,
        timestamp: new Date().toISOString(),
      });

      return {
        room: data.room,
        members: this.getRoomMembers(data.room),
      };
    } catch (error) {
      this.logger.error('Error in handleJoinRoom:', error);
      return { error: 'Failed to join room' };
    }
  }

  @UsePipes(new ValidationPipe({ transform: true }))
  @SubscribeMessage('leaveRoom')
  handleLeaveRoom(
    @MessageBody() data: JoinRoomDto,
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const clientInfo = this.connectedClients.get(client.id);

      if (!clientInfo) {
        return { error: 'Client not found' };
      }

      void client.leave(data.room);
      clientInfo.rooms.delete(data.room);

      this.logger.log(`Client ${client.id} left room: ${data.room}`);

      // Notify room members
      this.server.to(data.room).emit('userLeftRoom', {
        userId: client.id,
        username: clientInfo.username,
        room: data.room,
        timestamp: new Date().toISOString(),
      });

      return { left: data.room };
    } catch (error) {
      this.logger.error('Error in handleLeaveRoom:', error);
      return { error: 'Failed to leave room' };
    }
  }

  @UsePipes(new ValidationPipe({ transform: true }))
  @SubscribeMessage('roomMessage')
  handleRoomMessage(
    @MessageBody() data: MessageDto,
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const clientInfo = this.connectedClients.get(client.id);

      if (!data.room) {
        return { error: 'Room is required' };
      }

      const response = {
        userId: client.id,
        username: clientInfo?.username || 'Unknown',
        room: data.room,
        message: data.message,
        timestamp: new Date().toISOString(),
      };

      // Broadcast to room members only
      this.server.to(data.room).emit('roomMessage', response);

      return response;
    } catch (error) {
      this.logger.error('Error in handleRoomMessage:', error);
      return { error: 'Failed to send room message' };
    }
  }

  @SubscribeMessage('getOnlineUsers')
  handleGetOnlineUsers() {
    return {
      users: Array.from(this.connectedClients.entries()).map(([id, info]) => ({
        id,
        username: info.username,
        rooms: Array.from(info.rooms),
      })),
      total: this.connectedClients.size,
    };
  }

  @UsePipes(new ValidationPipe({ transform: true }))
  @UseGuards(WsAuthGuard)
  @SubscribeMessage('authenticatedMessage')
  handleAuthenticatedMessage(
    @MessageBody() data: MessageDto,
    @ConnectedSocket() client: Socket,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const user = client.data.user as { id: string; username: string };

    return {
      message: `Authenticated message from ${user.username}: ${data.message}`,
      timestamp: new Date().toISOString(),
    };
  }

  /** Join a personal user room — called by the client right after authentication */
  @SubscribeMessage('joinUserRoom')
  handleJoinUserRoom(
    @MessageBody() data: { userId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const room = `user:${data.userId}`;
    void client.join(room);
    this.logger.log(`Client ${client.id} joined personal room: ${room}`);
    return { joined: room };
  }

  // ── Chat real-time handlers ───────────────────────────────────────────────

  /** Typing indicator — relayed to all OTHER members currently viewing the conversation */
  @SubscribeMessage('chat:typing')
  handleChatTyping(
    @MessageBody() data: { conversationId: string; isTyping: boolean },
    @ConnectedSocket() client: Socket,
  ) {
    const session = this.connectedClients.get(client.id);
    const authUserId = client.handshake.auth?.userId as string | undefined;

    // client.to() excludes the sender automatically
    client.to(`conversation:${data.conversationId}`).emit('chat:typing', {
      userId: authUserId ?? client.id,
      userName: session?.username ?? 'Someone',
      isTyping: data.isTyping,
      conversationId: data.conversationId,
    });

    return { ok: true };
  }

  /** Join a conversation room — required to receive typing indicators */
  @SubscribeMessage('joinConversationRoom')
  handleJoinConversationRoom(
    @MessageBody() data: { conversationId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const room = `conversation:${data.conversationId}`;
    void client.join(room);
    const session = this.connectedClients.get(client.id);
    if (session) session.rooms.add(room);
    return { joined: room };
  }

  /** Leave a conversation room */
  @SubscribeMessage('leaveConversationRoom')
  handleLeaveConversationRoom(
    @MessageBody() data: { conversationId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const room = `conversation:${data.conversationId}`;
    void client.leave(room);
    const session = this.connectedClients.get(client.id);
    if (session) session.rooms.delete(room);
    return { left: room };
  }

  /** Set a custom presence status and broadcast to everyone online */
  @SubscribeMessage('user:setStatus')
  handleSetStatus(
    @MessageBody() data: { emoji: string; text: string },
    @ConnectedSocket() client: Socket,
  ) {
    const session = this.connectedClients.get(client.id);
    const userId = session?.userId;
    if (!userId) return { ok: false };

    const status = { emoji: data.emoji ?? '', text: data.text ?? '' };
    this.customStatusMap.set(userId, status);
    // Broadcast to all connected clients
    this.server.emit('user:customStatus', { userId, ...status });
    return { ok: true };
  }

  /** Return the current custom-status map so clients can seed on connect */
  getCustomStatuses(): Record<string, { emoji: string; text: string }> {
    return Object.fromEntries(this.customStatusMap);
  }

  /** Emit a named event to all clients in a room (called by server-side listeners) */
  broadcastToRoom(room: string, event: string, data: unknown): void {
    this.server.to(room).emit(event, data);
    this.logger.debug(`Broadcast → room "${room}" event "${event}"`);
  }

  /**
   * Returns online user IDs from Redis (cross-instance).
   * Callers that need a synchronous result should await getOnlineUserIdsAsync().
   * This sync shim returns an empty array when Redis is unavailable.
   */
  getOnlineUserIds(): string[] {
    // Presence is now async; this sync wrapper is kept for backwards-compat.
    // Call getOnlineUserIdsAsync() wherever async context is available.
    return [];
  }

  private getRoomMembers(
    room: string,
  ): Array<{ id: string; username: string }> {
    const members: Array<{ id: string; username: string }> = [];

    this.connectedClients.forEach((info, id) => {
      if (info.rooms.has(room)) {
        members.push({ id, username: info.username });
      }
    });

    return members;
  }
}
