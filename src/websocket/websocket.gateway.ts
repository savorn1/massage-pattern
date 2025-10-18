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
import { Logger, UseGuards } from '@nestjs/common';
import { WsAuthGuard } from './auth.guard';
import { MessageDto, JoinRoomDto } from './dto/message.dto';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class WebsocketGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private logger: Logger = new Logger('WebsocketGateway');
  private connectedClients = new Map<
    string,
    { username: string; rooms: Set<string> }
  >();

  afterInit() {
    this.logger.log('WebSocket Gateway Initialized');
  }

  handleConnection(client: Socket) {
    const authUsername: unknown = client.handshake.auth?.username;
    const username =
      typeof authUsername === 'string'
        ? authUsername
        : `User-${client.id.substring(0, 5)}`;
    this.connectedClients.set(client.id, { username, rooms: new Set() });

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

  handleDisconnect(client: Socket) {
    const clientInfo = this.connectedClients.get(client.id);

    if (clientInfo) {
      // Leave all rooms
      clientInfo.rooms.forEach((room) => {
        void client.leave(room);
        this.server.to(room).emit('userLeftRoom', {
          userId: client.id,
          username: clientInfo.username,
          room,
          timestamp: new Date().toISOString(),
        });
      });

      this.connectedClients.delete(client.id);
      this.logger.log(
        `Client disconnected: ${client.id} (${clientInfo.username})`,
      );

      // Notify all clients about disconnection
      this.server.emit('userDisconnected', {
        userId: client.id,
        username: clientInfo.username,
        totalUsers: this.connectedClients.size,
        timestamp: new Date().toISOString(),
      });
    }
  }

  @SubscribeMessage('message')
  handleMessage(
    @MessageBody() data: MessageDto,
    @ConnectedSocket() client: Socket,
  ) {
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
  }

  @SubscribeMessage('privateMessage')
  handlePrivateMessage(
    @MessageBody() data: { targetId: string; message: string },
    @ConnectedSocket() client: Socket,
  ) {
    const clientInfo = this.connectedClients.get(client.id);

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
  }

  @SubscribeMessage('joinRoom')
  handleJoinRoom(
    @MessageBody() data: JoinRoomDto,
    @ConnectedSocket() client: Socket,
  ) {
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
  }

  @SubscribeMessage('leaveRoom')
  handleLeaveRoom(
    @MessageBody() data: JoinRoomDto,
    @ConnectedSocket() client: Socket,
  ) {
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
  }

  @SubscribeMessage('roomMessage')
  handleRoomMessage(
    @MessageBody() data: MessageDto,
    @ConnectedSocket() client: Socket,
  ) {
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
