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

interface ClientSession {
  username: string;
  rooms: Set<string>;
  lastSeen: Date;
  reconnectionTimeout?: NodeJS.Timeout;
}

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  pingInterval: 25000, // Send ping every 25 seconds
  pingTimeout: 60000, // Close connection if no pong after 60 seconds
  transports: ['websocket', 'polling'],
})
export class WebsocketGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private logger: Logger = new Logger('WebsocketGateway');
  private connectedClients = new Map<string, ClientSession>();
  private reconnectionTimeout: number;

  constructor(private readonly configService: ConfigService) {
    // Get reconnection timeout from env, default to 30 seconds
    this.reconnectionTimeout =
      this.configService.get<number>('WS_RECONNECTION_TIMEOUT') || 30000;
  }

  afterInit() {
    this.logger.log('WebSocket Gateway Initialized');

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
        this.connectedClients.set(client.id, {
          username,
          rooms: new Set(),
          lastSeen: new Date(),
        });

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
