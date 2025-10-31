import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';

@Injectable()
export class WsAuthGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    try {
      const client: Socket = context.switchToWs().getClient<Socket>();
      const token: unknown =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '');

      const expectedToken = this.configService.get<string>('WS_TOKEN_SECRET');

      // Validate token exists and matches expected value
      if (!token || typeof token !== 'string') {
        throw new WsException('Unauthorized: Token missing');
      }

      if (!expectedToken) {
        throw new WsException(
          'Server configuration error: WS_TOKEN_SECRET not set',
        );
      }

      if (token !== expectedToken) {
        throw new WsException('Unauthorized: Invalid token');
      }

      // Attach user info to socket
      const username: unknown = client.handshake.auth?.username;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      client.data.user = {
        id: client.id,
        username: typeof username === 'string' ? username : 'Anonymous',
      };

      return true;
    } catch (error) {
      if (error instanceof WsException) {
        throw error;
      }
      throw new WsException('Authentication failed');
    }
  }
}
