import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';

@Injectable()
export class WsAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const client: Socket = context.switchToWs().getClient();
    const token =
      client.handshake.auth?.token || client.handshake.headers?.authorization;

    // Simple token validation (in real app, use JWT)
    if (!token || token !== 'secret-token') {
      throw new WsException('Unauthorized');
    }

    // Attach user info to socket
    client.data.user = {
      id: client.id,
      username: client.handshake.auth?.username || 'Anonymous',
    };

    return true;
  }
}
